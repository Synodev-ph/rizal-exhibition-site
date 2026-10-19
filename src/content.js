import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCALE_VARIANT_MD = /\.(?:fil|de)\.md$/;
const IMAGE_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.(?:avif|jpe?g|png|webp)$/;
const MODEL_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.glb$/;
const VIDEO_PATH = /^video\/[a-z0-9]+(?:-[a-z0-9]+)*\.mp4$/;
const MODEL_MAX_MB = 8;
// TODO/TBD are case-sensitive: "todo" is a Spanish word.
const PLACEHOLDER_PATTERNS = [
  { re: /\blorem\b/i, label: "lorem" },
  { re: /\bTODO\b/, label: "TODO" },
  { re: /\bTBD\b/, label: "TBD" },
  { re: /\bFIXME\b/i, label: "FIXME" },
  { re: /\[open question/i, label: "[OPEN QUESTION]" },
  { re: /\bplaceholder\b/i, label: "placeholder" },
];

class ContentErrors {
  constructor() {
    this.list = [];
  }
  add(file, field, message) {
    this.list.push(`${file} → ${field}: ${message}`);
  }
  throwIfAny() {
    if (!this.list.length) return;
    throw new Error(
      `Content validation failed (${this.list.length} error${this.list.length === 1 ? "" : "s"}):\n` +
        this.list.map((e) => `  - ${e}`).join("\n"),
    );
  }
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

function reqString(errors, file, obj, field) {
  if (!isNonEmptyString(obj[field])) {
    errors.add(file, field, "missing or empty (required non-empty string)");
    return false;
  }
  return true;
}

function optString(errors, file, obj, field) {
  if (obj[field] === undefined) return true;
  if (!isNonEmptyString(obj[field])) {
    errors.add(file, field, "present but empty — omit the field or fill it in");
    return false;
  }
  return true;
}

function reqLocalized(errors, file, obj, field) {
  const v = obj[field];
  if (isNonEmptyString(v)) return true;
  if (typeof v === "object" && v !== null && !Array.isArray(v)) {
    checkKeys(errors, file, v, ["en", "fil", "de"], field);
    let ok = reqString(errors, file, v, "en");
    for (const loc of ["fil", "de"]) {
      if (v[loc] !== undefined && !isNonEmptyString(v[loc])) {
        errors.add(file, `${field}.${loc}`, "present but empty — omit the locale or fill it in");
        ok = false;
      }
    }
    return ok;
  }
  errors.add(file, field, "missing — expected a non-empty string or a locale map { en, fil?, de? }");
  return false;
}

function optLocalized(errors, file, obj, field) {
  if (obj[field] === undefined) return true;
  return reqLocalized(errors, file, obj, field);
}

function reqNumber(errors, file, obj, field) {
  if (typeof obj[field] !== "number" || !Number.isFinite(obj[field])) {
    errors.add(file, field, "missing or not a number");
    return false;
  }
  return true;
}

function reqBool(errors, file, obj, field) {
  if (typeof obj[field] !== "boolean") {
    errors.add(file, field, "missing or not a boolean");
    return false;
  }
  return true;
}

function reqArray(errors, file, obj, field) {
  if (!Array.isArray(obj[field])) {
    errors.add(file, field, "missing or not an array");
    return false;
  }
  return true;
}

function checkKeys(errors, file, obj, allowed, context = "") {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      errors.add(file, context ? `${context}.${key}` : key, "unknown field (typo?)");
    }
  }
}

function checkKebab(errors, file, field, value) {
  if (isNonEmptyString(value) && !KEBAB.test(value)) {
    errors.add(file, field, `"${value}" is not kebab-case`);
  }
}

function checkImagePath(errors, file, field, src, assetsDir) {
  const segments = src.split("/");
  const fileName = segments.pop() ?? "";
  const badDir = segments.some((s) => !KEBAB.test(s));
  if (badDir || !IMAGE_FILE.test(fileName)) {
    errors.add(file, field, `"${src}" is not a kebab-case image path (avif/jpg/png/webp)`);
    return;
  }
  if (!existsSync(path.join(assetsDir, "images", src))) {
    errors.add(file, field, `referenced image "${src}" not found in assets-src/images/`);
  }
}

function checkVideoPath(errors, file, field, src, staticDir) {
  if (!VIDEO_PATH.test(src)) {
    errors.add(file, field, `"${src}" is not a kebab-case video path ("video/<name>.mp4")`);
    return;
  }
  if (staticDir && !existsSync(path.join(staticDir, src))) {
    errors.add(file, field, `referenced video "${src}" not found in static/`);
  }
}

const IMAGE_POSITIONS = ["top", "upper", "bottom"];

function validateImage(errors, file, field, img, assetsDir) {
  if (typeof img !== "object" || img === null || Array.isArray(img)) {
    errors.add(file, field, "must be an object { src, alt, credit?, deepZoom?, position? }");
    return;
  }
  checkKeys(errors, file, img, ["src", "alt", "credit", "deepZoom", "position"], field);
  if (reqString(errors, file, img, "src") === false) {
    errors.add(file, `${field}.src`, "missing image source");
  } else {
    checkImagePath(errors, file, `${field}.src`, img.src, assetsDir);
  }
  if (!isNonEmptyString(img.alt)) {
    errors.add(file, `${field}.alt`, "missing or empty alt text — every image needs alt from data");
  }
  if (img.credit !== undefined && !isNonEmptyString(img.credit)) {
    errors.add(file, `${field}.credit`, "present but empty — omit the field or fill it in");
  }
  if (img.deepZoom !== undefined && typeof img.deepZoom !== "boolean") {
    errors.add(file, `${field}.deepZoom`, "must be a boolean");
  }
  if (img.position !== undefined && !IMAGE_POSITIONS.includes(img.position)) {
    errors.add(file, `${field}.position`, `must be one of ${IMAGE_POSITIONS.join(", ")}`);
  }
}

const OBJECT_KEYS = [
  "id", "section", "category", "order", "title", "objectType", "materials",
  "dimensions", "accession", "description", "seoDescription", "condition", "images", "rights",
  "model3d", "related", "featured", "hotspots", "author", "draft",
];

function validateObject(errors, file, obj, assetsDir) {
  checkKeys(errors, file, obj, OBJECT_KEYS);
  reqString(errors, file, obj, "id") && checkKebab(errors, file, "id", obj.id);
  reqString(errors, file, obj, "section");
  optString(errors, file, obj, "category") && obj.category !== undefined &&
    checkKebab(errors, file, "category", obj.category);
  reqNumber(errors, file, obj, "order");

  if (typeof obj.title === "object" && obj.title !== null) {
    checkKeys(errors, file, obj.title, ["en", "tl", "es", "note"], "title");
    if (!isNonEmptyString(obj.title.en)) {
      errors.add(file, "title.en", "missing or empty — the English name is required");
    }
    for (const slot of ["tl", "es", "note"]) {
      if (obj.title[slot] !== undefined && !isNonEmptyString(obj.title[slot])) {
        errors.add(file, `title.${slot}`, "present but empty — omit the slot or fill it in");
      }
    }
  } else {
    errors.add(file, "title", "missing or not a locale-keyed object { en, tl?, es? }");
  }

  reqLocalized(errors, file, obj, "objectType");
  optLocalized(errors, file, obj, "materials");
  optLocalized(errors, file, obj, "dimensions");
  optString(errors, file, obj, "accession");
  (obj.draft === true ? optLocalized : reqLocalized)(errors, file, obj, "description");
  optLocalized(errors, file, obj, "seoDescription");
  optLocalized(errors, file, obj, "condition");
  optString(errors, file, obj, "author");
  checkDraft(errors, file, obj);
  reqString(errors, file, obj, "rights");
  reqBool(errors, file, obj, "featured");

  if (reqArray(errors, file, obj, "images")) {
    if (obj.images.length === 0) errors.add(file, "images", "must contain at least one image");
    obj.images.forEach((img, i) => validateImage(errors, file, `images[${i}]`, img, assetsDir));
  }

  if (obj.model3d !== undefined) {
    const m = obj.model3d;
    if (typeof m !== "object" || m === null) {
      errors.add(file, "model3d", "must be an object { src, poster, altText }");
    } else {
      checkKeys(errors, file, m, ["src", "poster", "cardPoster", "altText", "credit", "note"], "model3d");
      if (reqString(errors, file, m, "src")) {
        const modelPath = path.join(assetsDir, "models", m.src);
        if (!MODEL_FILE.test(m.src)) {
          errors.add(file, "model3d.src", `"${m.src}" is not a kebab-case .glb filename`);
        } else if (!existsSync(modelPath)) {
          errors.add(file, "model3d.src", `referenced model "${m.src}" not found in assets-src/models/`);
        } else {
          const mb = statSync(modelPath).size / (1024 * 1024);
          if (mb > MODEL_MAX_MB) {
            errors.add(
              file,
              "model3d.src",
              `"${m.src}" is ${mb.toFixed(1)} MB — over the ${MODEL_MAX_MB} MB budget; re-optimise it`,
            );
          }
        }
      }
      if (reqString(errors, file, m, "poster")) {
        checkImagePath(errors, file, "model3d.poster", m.poster, assetsDir);
      }
      if (m.cardPoster !== undefined && optString(errors, file, m, "cardPoster")) {
        checkImagePath(errors, file, "model3d.cardPoster", m.cardPoster, assetsDir);
      }
      reqString(errors, file, m, "altText");
      optString(errors, file, m, "credit");
      optString(errors, file, m, "note");
    }
  }

  if (reqArray(errors, file, obj, "related")) {
    obj.related.forEach((id, i) => {
      if (!isNonEmptyString(id)) errors.add(file, `related[${i}]`, "must be an object id string");
    });
  }

  if (obj.hotspots !== undefined) {
    if (!Array.isArray(obj.hotspots)) {
      errors.add(file, "hotspots", "must be an array");
    } else {
      obj.hotspots.forEach((h, i) => {
        if (typeof h !== "object" || h === null || !isNonEmptyString(h.label)) {
          errors.add(file, `hotspots[${i}].label`, "each hotspot needs a non-empty label");
        }
      });
    }
  }
}

const PERSON_KEYS = [
  "id", "section", "category", "order", "name", "role", "lifespan", "birthplace", "portrait",
  "author", "quote", "quoteSource", "bio", "seoDescription", "relatedObjects", "relatedPeople", "draft",
];

function validatePerson(errors, file, person, assetsDir) {
  checkKeys(errors, file, person, PERSON_KEYS);
  reqString(errors, file, person, "id") && checkKebab(errors, file, "id", person.id);
  reqString(errors, file, person, "section");
  optString(errors, file, person, "category") && person.category !== undefined &&
    checkKebab(errors, file, "category", person.category);
  reqNumber(errors, file, person, "order");
  reqString(errors, file, person, "name");
  const reqUnlessDraft = person.draft === true ? optLocalized : reqLocalized;
  optLocalized(errors, file, person, "role");
  optLocalized(errors, file, person, "lifespan");
  optLocalized(errors, file, person, "birthplace");
  reqUnlessDraft(errors, file, person, "bio");
  optLocalized(errors, file, person, "seoDescription");
  optString(errors, file, person, "author");
  optLocalized(errors, file, person, "quote");
  optLocalized(errors, file, person, "quoteSource");
  if (Boolean(person.quote) !== Boolean(person.quoteSource)) {
    errors.add(file, "quote", "`quote` and `quoteSource` go together — supply both or neither");
  }
  checkDraft(errors, file, person);
  validateImage(errors, file, "portrait", person.portrait, assetsDir);
  for (const field of ["relatedObjects", "relatedPeople"]) {
    if (reqArray(errors, file, person, field)) {
      person[field].forEach((id, i) => {
        if (!isNonEmptyString(id)) errors.add(file, `${field}[${i}]`, "must be an id string");
      });
    }
  }
}

const SECTION_KEYS = ["id", "title", "heroTitle", "intro", "seoDescription", "heroImage", "cardImage", "heroScrim", "categories", "status"];

function validateSection(errors, file, section, assetsDir) {
  checkKeys(errors, file, section, SECTION_KEYS);
  reqString(errors, file, section, "id") && checkKebab(errors, file, "id", section.id);
  reqLocalized(errors, file, section, "title");
  optLocalized(errors, file, section, "heroTitle");
  reqLocalized(errors, file, section, "intro");
  optLocalized(errors, file, section, "seoDescription");
  validateImage(errors, file, "heroImage", section.heroImage, assetsDir);
  if (section.cardImage !== undefined) {
    validateImage(errors, file, "cardImage", section.cardImage, assetsDir);
  }
  if (section.heroScrim !== undefined && section.heroScrim !== "full" && section.heroScrim !== "light") {
    errors.add(file, "heroScrim", `must be "full" or "light", got ${JSON.stringify(section.heroScrim)}`);
  }
  if (section.status !== "live" && section.status !== "upcoming") {
    errors.add(file, "status", `must be "live" or "upcoming", got ${JSON.stringify(section.status)}`);
  }
  if (reqArray(errors, file, section, "categories")) {
    section.categories.forEach((c, i) => {
      if (typeof c !== "object" || c === null) {
        errors.add(file, `categories[${i}]`, "must be an object { id, label }");
        return;
      }
      checkKeys(errors, file, c, ["id", "label"], `categories[${i}]`);
      reqString(errors, file, c, "id") && checkKebab(errors, file, `categories[${i}].id`, c.id);
      reqLocalized(errors, file, c, "label");
    });
  }
}

const SITE_KEYS = [
  "siteTitle", "siteSubtitle", "exhibitionTitle", "exhibitionSubtitle", "homeTitle",
  "baseUrl", "basePath", "language", "description", "seoDescription", "heroCtas", "home3dObjects", "homeQuote", "homeSocialImage",
  "homeTeasers", "nav", "footerNav", "footerCtas",
  "footer", "contact", "partners", "social", "analytics", "copyright",
];

function validateSite(errors, file, site, assetsDir, staticDir) {
  checkKeys(errors, file, site, SITE_KEYS);
  reqString(errors, file, site, "language");
  for (const field of [
    "siteTitle", "siteSubtitle", "exhibitionTitle", "exhibitionSubtitle",
    "homeTitle", "description", "copyright",
  ]) {
    reqLocalized(errors, file, site, field);
  }
  optLocalized(errors, file, site, "seoDescription");

  if (reqString(errors, file, site, "baseUrl")) {
    if (!/^https:\/\/[^/]+$/.test(site.baseUrl)) {
      errors.add(file, "baseUrl", `must be "https://<host>" without a trailing slash, got "${site.baseUrl}"`);
    }
  }
  if (reqString(errors, file, site, "basePath")) {
    if (!site.basePath.startsWith("/") || !site.basePath.endsWith("/")) {
      errors.add(file, "basePath", `must start and end with "/", got "${site.basePath}"`);
    }
  }

  if (site.heroCtas !== undefined && reqArray(errors, file, site, "heroCtas")) {
    site.heroCtas.forEach((item, i) => {
      checkKeys(errors, file, item, ["label", "href", "video", "videoSmall"], `heroCtas[${i}]`);
      reqLocalized(errors, file, item, "label");
      optString(errors, file, item, "video");
      optString(errors, file, item, "videoSmall");
      for (const key of ["video", "videoSmall"]) {
        if (isNonEmptyString(item[key])) {
          checkVideoPath(errors, file, `heroCtas[${i}].${key}`, item[key], staticDir);
        }
      }
      if (item.video === undefined) reqString(errors, file, item, "href");
      else optString(errors, file, item, "href");
      if (item.videoSmall !== undefined && item.video === undefined) {
        errors.add(file, `heroCtas[${i}].videoSmall`, "needs a `video` (the full-size rung) beside it");
      }
    });
  }
  if (site.home3dObjects !== undefined && reqArray(errors, file, site, "home3dObjects")) {
    site.home3dObjects.forEach((id, i) => {
      if (!isNonEmptyString(id)) errors.add(file, `home3dObjects[${i}]`, "must be an object id string");
    });
  }
  if (site.homeQuote !== undefined) {
    const q = site.homeQuote;
    if (typeof q !== "object" || q === null || Array.isArray(q)) {
      errors.add(file, "homeQuote", "must be an object { attribution, text?, lang? }");
    } else {
      checkKeys(errors, file, q, ["text", "attribution", "lang"], "homeQuote");
      reqString(errors, file, q, "attribution");
      optString(errors, file, q, "text");
      optString(errors, file, q, "lang");
    }
  }
  if (site.homeTeasers !== undefined && reqArray(errors, file, site, "homeTeasers")) {
    site.homeTeasers.forEach((t, i) => {
      if (typeof t !== "object" || t === null || Array.isArray(t)) {
        errors.add(file, `homeTeasers[${i}]`, "must be an object { heading, href, text?, image? }");
        return;
      }
      checkKeys(errors, file, t, ["heading", "href", "text", "image", "accent"], `homeTeasers[${i}]`);
      reqLocalized(errors, file, t, "heading");
      reqString(errors, file, t, "href");
      optLocalized(errors, file, t, "text");
      optString(errors, file, t, "accent");
      if (t.image !== undefined) validateImage(errors, file, `homeTeasers[${i}].image`, t.image, assetsDir);
    });
  }
  if (site.homeSocialImage !== undefined) {
    validateImage(errors, file, "homeSocialImage", site.homeSocialImage, assetsDir);
  }

  if (reqArray(errors, file, site, "nav")) {
    site.nav.forEach((item, i) => {
      checkKeys(errors, file, item, ["label", "href", "children"], `nav[${i}]`);
      reqLocalized(errors, file, item, "label");
      if (reqString(errors, file, item, "href") && !/^\/([a-z0-9-]+\/)*$/.test(item.href)) {
        errors.add(file, `nav[${i}].href`, `internal routes are kebab-case with trailing slash, got "${item.href}"`);
      }
      (item.children ?? []).forEach((c, j) => {
        checkKeys(errors, file, c, ["label", "href"], `nav[${i}].children[${j}]`);
        reqLocalized(errors, file, c, "label");
        reqString(errors, file, c, "href");
      });
    });
  }

  if (reqArray(errors, file, site, "footerNav")) {
    site.footerNav.forEach((item, i) => {
      checkKeys(errors, file, item, ["label", "href"], `footerNav[${i}]`);
      reqLocalized(errors, file, item, "label");
      if (reqString(errors, file, item, "href") && !/^\/([a-z0-9-]+\/)*$/.test(item.href)) {
        errors.add(file, `footerNav[${i}].href`, `internal routes are kebab-case with trailing slash, got "${item.href}"`);
      }
    });
  }

  if (reqArray(errors, file, site, "footerCtas")) {
    site.footerCtas.forEach((item, i) => {
      checkKeys(errors, file, item, ["label", "href"], `footerCtas[${i}]`);
      reqLocalized(errors, file, item, "label");
      reqString(errors, file, item, "href");
    });
  }

  if (typeof site.footer === "object" && site.footer !== null) {
    checkKeys(errors, file, site.footer, ["aboutHeading", "aboutText", "contactHeading"], "footer");
    for (const f of ["aboutHeading", "aboutText", "contactHeading"]) reqLocalized(errors, file, site.footer, f);
  } else {
    errors.add(file, "footer", "missing or not an object");
  }

  if (typeof site.contact === "object" && site.contact !== null) {
    checkKeys(errors, file, site.contact, ["address", "email", "phone"], "contact");
    for (const f of ["address", "email", "phone"]) reqString(errors, file, site.contact, f);
  } else {
    errors.add(file, "contact", "missing or not an object { address, email, phone }");
  }

  if (reqArray(errors, file, site, "partners")) {
    site.partners.forEach((p, i) => {
      checkKeys(errors, file, p, ["name", "logo", "chip", "caption"], `partners[${i}]`);
      reqString(errors, file, p, "name");
      reqString(errors, file, p, "logo");
      if ("chip" in p && typeof p.chip !== "boolean") {
        errors.add(file, `partners[${i}].chip`, "must be a boolean");
      }
      optLocalized(errors, file, p, "caption");
    });
  }
  if (reqArray(errors, file, site, "social")) {
    site.social.forEach((s, i) => {
      checkKeys(errors, file, s, ["name", "href"], `social[${i}]`);
      reqString(errors, file, s, "name");
      reqString(errors, file, s, "href");
    });
  }
  if (typeof site.analytics !== "object" || site.analytics === null ||
      typeof site.analytics.provider !== "string" || typeof site.analytics.id !== "string") {
    errors.add(file, "analytics", 'missing slot — expected { "provider": string, "id": string }');
  }
}

const ESSAY_KEYS = ["title", "slug", "section", "summary", "seoDescription", "heroImage", "heroImageAlt", "heroCaption", "order", "author", "category"];

function validateEssay(errors, file, essay, assetsDir) {
  const fm = essay.frontmatter;
  checkKeys(errors, file, fm, ESSAY_KEYS);
  reqString(errors, file, fm, "title");
  reqString(errors, file, fm, "slug") && checkKebab(errors, file, "slug", fm.slug);
  reqString(errors, file, fm, "section");
  optString(errors, file, fm, "summary");
  optLocalized(errors, file, fm, "seoDescription");
  reqString(errors, file, fm, "author");
  reqNumber(errors, file, fm, "order");
  optString(errors, file, fm, "category");
  optString(errors, file, fm, "heroCaption");
  if (reqString(errors, file, fm, "heroImage")) {
    checkImagePath(errors, file, "heroImage", fm.heroImage, assetsDir);
  }
  if (!isNonEmptyString(fm.heroImageAlt)) {
    errors.add(file, "heroImageAlt", "missing or empty alt text for heroImage");
  }
  if (!isNonEmptyString(essay.body)) {
    errors.add(file, "body", "essay has no body text");
  }
}

const INTERACTIVE_KEYS = ["id", "type", "object", "image", "cards", "sizes", "draft", "cardTitle", "seoDescription"];
export const INTERACTIVE_TYPES = ["puzzle", "match"];

function validateInteractive(errors, file, item, assetsDir) {
  checkKeys(errors, file, item, INTERACTIVE_KEYS);
  if (item.draft !== undefined && typeof item.draft !== "boolean") errors.add(file, "draft", "must be a boolean");
  if (item.cardTitle !== undefined && !isNonEmptyString(item.cardTitle)) errors.add(file, "cardTitle", "must be a non-empty string");
  reqString(errors, file, item, "id") && checkKebab(errors, file, "id", item.id);
  optLocalized(errors, file, item, "seoDescription");
  if (reqString(errors, file, item, "type") && !INTERACTIVE_TYPES.includes(item.type)) {
    errors.add(file, "type", `"${item.type}" is not a known type (${INTERACTIVE_TYPES.join(", ")})`);
  }
  if (item.type === "match") {
    const cards = Array.isArray(item.cards) ? item.cards : [];
    if (cards.length < 2) errors.add(file, "cards", "must list at least 2 { object, image } entries");
    cards.forEach((card, i) => {
      const key = `cards[${i}]`;
      if (!isNonEmptyString(card?.object)) errors.add(file, `${key}.object`, "required");
      if (!isNonEmptyString(card?.image)) errors.add(file, `${key}.image`, "required");
      else checkImagePath(errors, file, `${key}.image`, card.image, assetsDir);
    });
    if (item.sizes !== undefined) {
      const ok = Array.isArray(item.sizes) && item.sizes.length > 0 &&
        item.sizes.every((n) => Number.isInteger(n) && n >= 2 && n <= cards.length);
      if (!ok) errors.add(file, "sizes", `must be a non-empty array of pair counts from 2 to ${cards.length}`);
    }
    return;
  }
  reqString(errors, file, item, "object");
  if (reqString(errors, file, item, "image")) {
    checkImagePath(errors, file, "image", item.image, assetsDir);
  }
  if (item.sizes !== undefined) {
    const ok = Array.isArray(item.sizes) && item.sizes.length > 0 &&
      item.sizes.every((n) => Number.isInteger(n) && n >= 3 && n <= 6);
    if (!ok) errors.add(file, "sizes", "must be a non-empty array of integers from 3 to 6");
  }
}

const PAGE_KEYS = ["title", "slug", "intro", "seoDescription", "heroImage", "heroImageAlt", "bodyHeading", "author", "personaCards"];

function validatePage(errors, file, page, assetsDir) {
  const fm = page.frontmatter;
  checkKeys(errors, file, fm, PAGE_KEYS);
  reqString(errors, file, fm, "title");
  reqString(errors, file, fm, "slug") && checkKebab(errors, file, "slug", fm.slug);
  optString(errors, file, fm, "intro");
  optLocalized(errors, file, fm, "seoDescription");
  optString(errors, file, fm, "bodyHeading");
  optString(errors, file, fm, "author");
  if (fm.heroImage !== undefined && reqString(errors, file, fm, "heroImage")) {
    checkImagePath(errors, file, "heroImage", fm.heroImage, assetsDir);
    if (!isNonEmptyString(fm.heroImageAlt)) {
      errors.add(file, "heroImageAlt", "missing or empty alt text for heroImage");
    }
  }
  if (fm.personaCards !== undefined && typeof fm.personaCards !== "boolean") {
    errors.add(file, "personaCards", "must be a boolean");
  }
  if (!isNonEmptyString(page.body)) {
    errors.add(file, "body", "page has no body text");
  }
}

const ABOUT_KEYS = ["heroImage", "intro", "seoDescription", "blurbs", "messagesHeading", "messages"];

function validateAbout(errors, file, about, assetsDir, staticDir) {
  if (typeof about !== "object" || about === null || Array.isArray(about)) {
    errors.add(file, "(root)", "must be an object { intro, blurbs, messagesHeading, messages }");
    return;
  }
  checkKeys(errors, file, about, ABOUT_KEYS);
  validateImage(errors, file, "heroImage", about.heroImage, assetsDir);
  reqLocalized(errors, file, about, "intro");
  optLocalized(errors, file, about, "seoDescription");
  reqLocalized(errors, file, about, "messagesHeading");
  if (reqArray(errors, file, about, "blurbs")) {
    about.blurbs.forEach((b, i) => {
      if (typeof b !== "object" || b === null || Array.isArray(b)) {
        errors.add(file, `blurbs[${i}]`, "must be an object { heading, body }");
        return;
      }
      checkKeys(errors, file, b, ["heading", "body"], `blurbs[${i}]`);
      reqLocalized(errors, file, b, "heading");
      reqLocalized(errors, file, b, "body");
    });
  }
  if (reqArray(errors, file, about, "messages")) {
    about.messages.forEach((m, i) => {
      if (typeof m !== "object" || m === null || Array.isArray(m)) {
        errors.add(file, `messages[${i}]`, "must be an object { name, role, poster, video? }");
        return;
      }
      checkKeys(errors, file, m, ["name", "role", "poster", "video"], `messages[${i}]`);
      reqString(errors, file, m, "name");
      reqLocalized(errors, file, m, "role");
      validateImage(errors, file, `messages[${i}].poster`, m.poster, assetsDir);
      if (m.video !== undefined) {
        if (!isNonEmptyString(m.video)) {
          errors.add(file, `messages[${i}].video`, "present but empty — omit the field or give the path to the shipped MP4 (e.g. video/sll.mp4)");
        } else {
          checkVideoPath(errors, file, `messages[${i}].video`, m.video, staticDir);
        }
      }
    });
  }
}

function validateRedirects(errors, file, redirects) {
  if (!Array.isArray(redirects)) {
    errors.add(file, "(root)", "must be an array of { from, to }");
    return;
  }
  const seen = new Set();
  redirects.forEach((r, i) => {
    checkKeys(errors, file, r, ["from", "to"], `[${i}]`);
    if (reqString(errors, file, r, "from")) {
      if (r.from.startsWith("/")) {
        errors.add(file, `[${i}].from`, `legacy paths are relative (no leading "/"), got "${r.from}"`);
      }
      if (seen.has(r.from)) {
        errors.add(file, `[${i}].from`, `duplicate redirect source "${r.from}"`);
      }
      seen.add(r.from);
    }
    if (reqString(errors, file, r, "to") && !/^\/([a-z0-9-]+\/)*$/.test(r.to)) {
      errors.add(file, `[${i}].to`, `new URLs are clean kebab-case paths with trailing slash, got "${r.to}"`);
    }
  });
}

function checkDraft(errors, file, rec) {
  if (rec.draft !== undefined && typeof rec.draft !== "boolean") {
    errors.add(file, "draft", "must be a boolean");
  }
}

function scanPlaceholders(errors, file, value, fieldPath) {
  const inModel3d = /(^|\.)model3d(\.|$)/.test(fieldPath || "");
  if (typeof value === "string") {
    for (const { re, label } of PLACEHOLDER_PATTERNS) {
      if (inModel3d && label === "placeholder") continue;
      if (re.test(value)) {
        errors.add(file, fieldPath || "(root)", `contains placeholder text ("${label}") — committed content must be real`);
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => scanPlaceholders(errors, file, v, `${fieldPath}[${i}]`));
  } else if (typeof value === "object" && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      scanPlaceholders(errors, file, v, fieldPath ? `${fieldPath}.${k}` : k);
    }
  }
}

const ESSAY_TRANSLATABLE = ["title", "summary", "seoDescription", "heroCaption", "body"];
const PAGE_TRANSLATABLE = ["title", "intro", "seoDescription", "bodyHeading", "body"];

function readLocaleVariants(errors, contentDir, sub, base, translatable) {
  const variants = {};
  for (const locale of ["fil", "de"]) {
    const fileName = `${base}.${locale}.md`;
    const abs = path.join(contentDir, sub, fileName);
    if (!existsSync(abs)) continue;
    const file = `content/${sub}/${fileName}`;
    const { frontmatter, body } = parseFrontmatter(errors, file, readFileSync(abs, "utf8"));
    for (const key of Object.keys(frontmatter)) {
      if (!translatable.includes(key)) {
        errors.add(file, key, `not translatable — it is taken from ${base}.md (translatable: ${translatable.join(", ")})`);
      }
    }
    if (!isNonEmptyString(body)) errors.add(file, "body", "translation has no body text");
    scanPlaceholders(errors, file, frontmatter, "");
    scanPlaceholders(errors, file, body, "body");
    const fields = { body };
    for (const key of translatable) {
      if (key !== "body" && isNonEmptyString(frontmatter[key])) fields[key] = String(frontmatter[key]);
    }
    variants[locale] = fields;
  }
  return variants;
}

function localizeRecord({ frontmatter, body, variants }, translatable) {
  const out = { ...frontmatter, body };
  for (const key of translatable) {
    const en = out[key];
    if (!isNonEmptyString(en)) continue;
    const localized = { en: String(en) };
    for (const [locale, fields] of Object.entries(variants)) {
      if (fields[key] !== undefined) localized[locale] = fields[key];
    }
    out[key] = Object.keys(localized).length > 1 ? localized : en;
  }
  return out;
}

function parseFrontmatter(errors, file, raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    errors.add(file, "frontmatter", "missing --- YAML frontmatter block");
    return { frontmatter: {}, body: raw };
  }
  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) {
      errors.add(file, "frontmatter", `cannot parse line "${line}" — expected "key: value"`);
      continue;
    }
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();
    if (/^(["']).*\1$/.test(value)) value = value.slice(1, -1);
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      frontmatter[key] = Number(value);
    } else if (value === "true" || value === "false") {
      frontmatter[key] = value === "true";
    } else {
      frontmatter[key] = value;
    }
  }
  return { frontmatter, body: match[2].trim() };
}

function readDir(errors, contentDir, sub, ext) {
  const dir = path.join(contentDir, sub);
  if (!existsSync(dir)) {
    errors.add(`content/${sub}/`, "(directory)", "missing content directory");
    return [];
  }
  const entries = [];
  for (const fileName of readdirSync(dir).sort()) {
    if (!fileName.endsWith(ext)) continue;
    if (ext === ".md" && LOCALE_VARIANT_MD.test(fileName)) continue;
    const file = `content/${sub}/${fileName}`;
    const base = fileName.slice(0, -ext.length);
    if (!KEBAB.test(base)) {
      errors.add(file, "(filename)", `"${fileName}" is not kebab-case`);
    }
    entries.push({ file, base, raw: readFileSync(path.join(dir, fileName), "utf8") });
  }
  return entries;
}

function parseJson(errors, file, raw) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    errors.add(file, "(root)", `invalid JSON — ${(err).message}`);
    return null;
  }
}

function checkIdentity(errors, entries, idField) {
  const seen = new Map();
  for (const { file, base, data } of entries) {
    const id = data?.[idField];
    if (!isNonEmptyString(id)) continue;
    if (seen.has(id)) {
      errors.add(file, idField, `duplicate ${idField} "${id}" (also in ${seen.get(id)})`);
    } else {
      seen.set(id, file);
    }
    if (id !== base) {
      errors.add(file, idField, `"${id}" must match its filename "${base}"`);
    }
  }
}

export function loadContent({ contentDir, assetsDir, staticDir }) {
  const errors = new ContentErrors();

  const siteFile = "content/site.json";
  const siteRaw = existsSync(path.join(contentDir, "site.json"))
    ? readFileSync(path.join(contentDir, "site.json"), "utf8")
    : null;
  const site = siteRaw === null ? null : parseJson(errors, siteFile, siteRaw);
  if (site === null) {
    if (siteRaw === null) errors.add(siteFile, "(file)", "missing — the site cannot build without it");
  } else {
    validateSite(errors, siteFile, site, assetsDir, staticDir);
    scanPlaceholders(errors, siteFile, site, "");
  }

  const load = (sub, validate) =>
    readDir(errors, contentDir, sub, ".json").map(({ file, base, raw }) => {
      const data = parseJson(errors, file, raw);
      if (data !== null) {
        validate(errors, file, data, assetsDir);
        if (data.draft !== true) scanPlaceholders(errors, file, data, "");
      }
      return { file, base, data };
    }).filter((e) => e.data !== null);

  const sections = load("sections", validateSection);
  const objects = load("objects", validateObject);
  const people = load("people", validatePerson);
  const interactives = load("interactives", validateInteractive);

  const essays = readDir(errors, contentDir, "essays", ".md").map(({ file, base, raw }) => {
    const { frontmatter, body } = parseFrontmatter(errors, file, raw);
    const essay = {
      file,
      base,
      frontmatter,
      body,
      variants: readLocaleVariants(errors, contentDir, "essays", base, ESSAY_TRANSLATABLE),
    };
    validateEssay(errors, file, essay, assetsDir);
    scanPlaceholders(errors, file, frontmatter, "");
    scanPlaceholders(errors, file, body, "body");
    return essay;
  });

  const pages = readDir(errors, contentDir, "pages", ".md").map(({ file, base, raw }) => {
    const { frontmatter, body } = parseFrontmatter(errors, file, raw);
    const page = {
      file,
      base,
      frontmatter,
      body,
      variants: readLocaleVariants(errors, contentDir, "pages", base, PAGE_TRANSLATABLE),
    };
    validatePage(errors, file, page, assetsDir);
    scanPlaceholders(errors, file, frontmatter, "");
    scanPlaceholders(errors, file, body, "body");
    return page;
  });

  const aboutFile = "content/about.json";
  let about = null;
  if (!existsSync(path.join(contentDir, "about.json"))) {
    errors.add(aboutFile, "(file)", "missing — the About page needs its content");
  } else {
    const parsed = parseJson(errors, aboutFile, readFileSync(path.join(contentDir, "about.json"), "utf8"));
    if (parsed !== null) {
      validateAbout(errors, aboutFile, parsed, assetsDir, staticDir);
      scanPlaceholders(errors, aboutFile, parsed, "");
      about = parsed;
    }
  }

  checkIdentity(errors, sections, "id");
  checkIdentity(errors, objects, "id");
  checkIdentity(errors, people, "id");
  checkIdentity(errors, interactives, "id");
  checkIdentity(errors, essays.map((e) => ({ file: e.file, base: e.base, data: e.frontmatter })), "slug");
  checkIdentity(errors, pages.map((p) => ({ file: p.file, base: p.base, data: p.frontmatter })), "slug");

  const redirectsFile = "content/redirects.json";
  let redirects = [];
  if (!existsSync(path.join(contentDir, "redirects.json"))) {
    errors.add(redirectsFile, "(file)", "missing — legacy URLs need their redirect map");
  } else {
    const parsed = parseJson(errors, redirectsFile, readFileSync(path.join(contentDir, "redirects.json"), "utf8"));
    if (parsed !== null) {
      validateRedirects(errors, redirectsFile, parsed);
      redirects = Array.isArray(parsed) ? parsed : [];
    }
  }

  const sectionsById = new Map(sections.map((s) => [s.data.id, s.data]));
  const objectIds = new Set(objects.map((o) => o.data.id));
  const personIds = new Set(people.map((p) => p.data.id));

  const checkSectionRef = (file, data) => {
    const section = sectionsById.get(data.section);
    if (data.section !== undefined && !section) {
      errors.add(file, "section", `"${data.section}" is not a section in content/sections/`);
    }
    return section;
  };

  const checkCategoryRef = (file, data, section) => {
    const categoryIds = section.categories?.map((c) => c.id) ?? [];
    if (categoryIds.length > 0) {
      if (!data.category) {
        errors.add(file, "category", `required — section "${section.id}" declares categories (${categoryIds.join(", ")})`);
      } else if (!categoryIds.includes(data.category)) {
        errors.add(file, "category", `"${data.category}" is not declared in content/sections/${section.id}.json (${categoryIds.join(", ")})`);
      }
    } else if (data.category) {
      errors.add(file, "category", `section "${section.id}" declares no categories — remove the field`);
    }
  };

  if (site && Array.isArray(site.home3dObjects)) {
    const objectsById = new Map(objects.map((o) => [o.data.id, o.data]));
    site.home3dObjects.forEach((id, i) => {
      const obj = objectsById.get(id);
      if (!obj) {
        errors.add(siteFile, `home3dObjects[${i}]`, `"${id}" does not resolve to an object in content/objects/`);
      } else if (!obj.model3d) {
        errors.add(siteFile, `home3dObjects[${i}]`, `"${id}" has no model3d block — the 3D strip can only show objects with one`);
      }
    });
  }

  for (const { file, data } of objects) {
    const section = checkSectionRef(file, data);
    if (section) checkCategoryRef(file, data, section);
    (Array.isArray(data.related) ? data.related : []).forEach((id, i) => {
      if (id === data.id) errors.add(file, `related[${i}]`, "an object cannot relate to itself");
      else if (!objectIds.has(id)) errors.add(file, `related[${i}]`, `"${id}" does not resolve to an object in content/objects/`);
    });
  }

  for (const { file, data } of people) {
    const section = checkSectionRef(file, data);
    if (section) checkCategoryRef(file, data, section);
    (Array.isArray(data.relatedObjects) ? data.relatedObjects : []).forEach((id, i) => {
      if (!objectIds.has(id)) errors.add(file, `relatedObjects[${i}]`, `"${id}" does not resolve to an object in content/objects/`);
    });
    (Array.isArray(data.relatedPeople) ? data.relatedPeople : []).forEach((id, i) => {
      if (id === data.id) errors.add(file, `relatedPeople[${i}]`, "a person cannot relate to themselves");
      else if (!personIds.has(id)) errors.add(file, `relatedPeople[${i}]`, `"${id}" does not resolve to a person in content/people/`);
    });
  }

  for (const { file, data } of interactives) {
    if (isNonEmptyString(data.object) && !objectIds.has(data.object)) {
      errors.add(file, "object", `"${data.object}" does not resolve to an object in content/objects/`);
    }
    (Array.isArray(data.cards) ? data.cards : []).forEach((card, i) => {
      if (!isNonEmptyString(card?.object)) return;
      const obj = objects.find((o) => o.data.id === card.object)?.data;
      if (!obj) errors.add(file, `cards[${i}].object`, `"${card.object}" does not resolve to an object in content/objects/`);
      else if (!obj.images?.some((img) => img.src === card.image)) {
        errors.add(file, `cards[${i}].image`, `"${card.image}" is not one of ${card.object}'s images`);
      }
    });
  }

  for (const { file, frontmatter } of essays) {
    const section = checkSectionRef(file, frontmatter);
    if (section && frontmatter.category !== undefined) {
      const categoryIds = section.categories?.map((c) => c.id) ?? [];
      if (!categoryIds.includes(frontmatter.category)) {
        errors.add(file, "category", `"${frontmatter.category}" is not declared in content/sections/${section.id}.json`);
      }
    }
  }

  const i18n = { en: {}, fil: {}, de: {} };
  for (const loc of ["en", "fil", "de"]) {
    const rel = `content/i18n/${loc}.json`;
    const abs = path.join(contentDir, "i18n", `${loc}.json`);
    if (!existsSync(abs)) {
      errors.add(rel, "(file)", "missing UI message catalog");
      continue;
    }
    const parsed = parseJson(errors, rel, readFileSync(abs, "utf8"));
    if (parsed === null) continue;
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      errors.add(rel, "(root)", "must be a flat object of { key: string }");
      continue;
    }
    for (const [k, v] of Object.entries(parsed)) {
      if (!isNonEmptyString(v)) {
        errors.add(rel, k, "each catalog value must be a non-empty string");
      }
    }
    scanPlaceholders(errors, rel, parsed, "");
    i18n[loc] = parsed;
  }
  for (const loc of ["fil", "de"]) {
    for (const k of Object.keys(i18n[loc])) {
      if (!(k in i18n.en)) {
        errors.add(`content/i18n/${loc}.json`, k, "key not present in en.json (typo? en is the reference)");
      }
    }
  }

  errors.throwIfAny();

  return {
    site,
    i18n,
    sections: sections.map((s) => s.data),
    objects: objects.map((o) => o.data),
    people: people.map((p) => p.data),
    interactives: interactives.map((i) => i.data),
    essays: essays.map((e) => localizeRecord(e, ESSAY_TRANSLATABLE)),
    pages: pages.map((p) => localizeRecord(p, PAGE_TRANSLATABLE)),
    about,
    redirects,
  };
}
