import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadContent } from "./src/content.js";
import {
  LOCALES,
  localePrefix,
  pick,
  setCatalogs,
  setLocale,
  setSiteConfig,
  t,
} from "./src/i18n.js";
import { lintDistImages, lqipCss, processDeepZoom, processImages } from "./src/images.js";
import { ogImage, setDeepZoomManifest, setImageManifest } from "./src/templates/media.js";
import { renderPage } from "./src/templates/layout.js";
import { renderHome } from "./src/templates/home.js";
import { renderUpcoming } from "./src/templates/upcoming.js";
import { objectDescription, objectTitle, renderObject } from "./src/templates/object.js";
import { personDescription, personTitle, renderPerson } from "./src/templates/person.js";
import { renderSection, sectionDescription, sectionTitle } from "./src/templates/section.js";
import { essayDescription, essayTitle, renderEssay } from "./src/templates/essay.js";
import { pageDescription, pageTitle, renderContentPage } from "./src/templates/page.js";
import { aboutDescription, aboutTitle, renderAbout } from "./src/templates/about.js";
import { render404 } from "./src/templates/notfound.js";
import { renderSearch, searchDescription, searchTitle } from "./src/templates/search.js";
import {
  interactiveDescription,
  hubInteractives,
  interactiveHubDescription,
  interactiveHubTitle,
  interactiveTitle,
  renderInteractive,
  renderInteractiveHub,
} from "./src/templates/interactive.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, "dist");
const isDev = process.env.DEV === "1";

const CSS_ORDER = ["css/tokens.css", "css/base.css", "css/layout.css"];

function hash(content) {
  return createHash("md5").update(content).digest("hex").slice(0, 8);
}

function bundleCss() {
  const parts = CSS_ORDER.map((f) => readFileSync(path.join(root, f), "utf8"));
  const componentsDir = path.join(root, "css/components");
  for (const f of readdirSync(componentsDir).filter((f) => f.endsWith(".css")).sort()) {
    parts.push(readFileSync(path.join(componentsDir, f), "utf8"));
  }
  return parts.join("\n");
}

export async function build() {
  const started = Date.now();
  const assetsDir = path.join(root, "assets-src");

  const content = (
    loadContent({
      contentDir: path.join(root, "content"),
      assetsDir,
      staticDir: path.join(root, "static"),
    })
  );
  const site = content.site;

  setSiteConfig(site);
  setCatalogs(content.i18n);

  rmSync(dist, { recursive: true, force: true });
  mkdirSync(path.join(dist, "assets"), { recursive: true });

  cpSync(path.join(root, "static"), dist, { recursive: true });

  const imageManifest = await processImages({
    assetsDir,
    dist,
    cacheDir: path.join(root, ".cache/images"),
    log: (m) => console.log(m),
  });
  setImageManifest(imageManifest);

  const deepZoomSources = [
    ...new Set(
      content.objects.flatMap((o) => o.images.filter((img) => img.deepZoom).map((img) => img.src)),
    ),
  ];
  const dzManifest = await processDeepZoom({
    assetsDir,
    dist,
    cacheDir: path.join(root, ".cache/dz"),
    sources: deepZoomSources,
    log: (m) => console.log(m),
  });
  setDeepZoomManifest(dzManifest);

  const modelSources = [
    ...new Set(content.objects.flatMap((o) => (o.model3d ? [o.model3d.src] : []))),
  ];
  if (modelSources.length) {
    const modelsOut = path.join(dist, "media/models");
    mkdirSync(modelsOut, { recursive: true });
    for (const src of modelSources) {
      cpSync(path.join(assetsDir, "models", src), path.join(modelsOut, src));
    }
  }

  const css = `${bundleCss()}\n${lqipCss(imageManifest)}\n`;
  const cssFile = `assets/site-${hash(css)}.css`;
  writeFileSync(path.join(dist, cssFile), css);

  const js = readFileSync(path.join(root, "js/main.js"), "utf8");
  const jsFile = `assets/main-${hash(js)}.js`;
  writeFileSync(path.join(dist, jsFile), js);

  // main.js imports ./viewer.js and the game modules by literal path, so they are emitted unhashed.
  const viewerJs = readFileSync(path.join(root, "js/viewer.js"), "utf8");
  writeFileSync(path.join(dist, "assets/viewer.js"), viewerJs);

  for (const name of ["game", "puzzle", "match"]) {
    writeFileSync(path.join(dist, `assets/${name}.js`), readFileSync(path.join(root, `js/${name}.js`), "utf8"));
  }

  const assets = { css: site.basePath + cssFile, js: site.basePath + jsFile };

  let written = 0;
  for (const { id: locale } of LOCALES) {
    setLocale(locale);
    const prefix = localePrefix(locale);

  const pages = [
    {
      out: "index.html",
      html: renderPage({
        site,
        assets,
        isDev,
        path: "/",
        title: pick(site.homeTitle),
        description: pick(site.seoDescription) || pick(site.description),
        image: site.homeSocialImage ? ogImage(site, site.homeSocialImage) : undefined,
        content: renderHome({ site, sections: content.sections, objects: content.objects, interactives: content.interactives }),
      }),
    },
  ];

  const sectionRoutes = new Set(content.sections.map((s) => `/${s.id}/`));
  const pageRoutes = new Set(content.pages.map((p) => `/${p.slug}/`));
  const realRoutes = new Set([...sectionRoutes, ...pageRoutes, "/about/"]);
  const navRoutes = site.nav
    .flatMap((item) => [item, ...(item.children ?? [])])
    .filter((item) => item.href !== "/" && !realRoutes.has(item.href));
  for (const route of navRoutes) {
    pages.push({
      out: path.join(route.href.replace(/^\//, ""), "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: route.href,
        title: `${pick(route.label)} — ${pick(site.siteTitle)}`,
        description: pick(site.description),
        content: renderUpcoming({ title: pick(route.label), site }),
      }),
    });
  }

  const sectionById = new Map(content.sections.map((s) => ([s.id, s])));
  const objectById = new Map(content.objects.map((o) => ([o.id, o])));
  const hubList = hubInteractives(content.interactives, objectById);

  const peopleByObject = new Map();
  for (const person of content.people) {
    for (const objId of person.relatedObjects ?? []) {
      const list = peopleByObject.get(objId) ?? [];
      list.push(person);
      peopleByObject.set(objId, list);
    }
  }

  const objectsBySection = new Map();
  for (const obj of content.objects) {
    const list = objectsBySection.get(obj.section) ?? [];
    list.push(obj);
    objectsBySection.set(obj.section, list);
  }
  for (const list of objectsBySection.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  for (const object of content.objects) {
    const section = sectionById.get(object.section);
    const siblings = objectsBySection.get(object.section);
    const idx = siblings.findIndex((o) => o.id === object.id);
    const prev = siblings.length > 1 ? siblings[(idx - 1 + siblings.length) % siblings.length] : null;
    const next = siblings.length > 1 ? siblings[(idx + 1) % siblings.length] : null;

    const seen = new Set([object.id]);
    const explore = [];
    for (const id of object.related ?? []) {
      const rel = objectById.get(id);
      if (rel && !seen.has(id)) {
        explore.push(rel);
        seen.add(id);
      }
    }
    for (const sib of siblings) {
      if (!seen.has(sib.id)) {
        explore.push(sib);
        seen.add(sib.id);
      }
    }

    const routePath = `/${object.section}/${object.id}/`;
    pages.push({
      out: path.join(object.section, object.id, "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: routePath,
        title: objectTitle(object, site),
        description: objectDescription(object),
        image: ogImage(site, object.images[0]),
        content: renderObject({
          site,
          object,
          section,
          prev,
          next,
          explore,
          relatedPeople: (peopleByObject.get(object.id) ?? []).sort((a, b) => a.order - b.order),
          puzzles: hubList.filter((i) => i.type === "puzzle" && i.object === object.id),
        }),
      }),
    });
  }

  const personById = new Map(content.people.map((p) => ([p.id, p])));
  const peopleBySection = new Map();
  for (const person of content.people) {
    const list = peopleBySection.get(person.section) ?? [];
    list.push(person);
    peopleBySection.set(person.section, list);
  }
  for (const list of peopleBySection.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  for (const person of content.people) {
    const section = sectionById.get(person.section);
    const siblings = peopleBySection.get(person.section);
    const idx = siblings.findIndex((p) => p.id === person.id);
    const prev = siblings.length > 1 ? siblings[(idx - 1 + siblings.length) % siblings.length] : null;
    const next = siblings.length > 1 ? siblings[(idx + 1) % siblings.length] : null;

    const relatedObjects = (person.relatedObjects ?? [])
      .map((id) => objectById.get(id))
      .filter(Boolean);
    const relatedPeople = (person.relatedPeople ?? [])
      .map((id) => personById.get(id))
      .filter(Boolean);

    const routePath = `/${person.section}/${person.id}/`;
    pages.push({
      out: path.join(person.section, person.id, "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: routePath,
        title: personTitle(person, site),
        description: personDescription(person),
        image: ogImage(site, person.portrait),
        content: renderPerson({ site, person, section, prev, next, relatedObjects, relatedPeople }),
      }),
    });
  }

  const essaysBySection = new Map();
  for (const essay of content.essays) {
    const list = essaysBySection.get(essay.section) ?? [];
    list.push(essay);
    essaysBySection.set(essay.section, list);
  }
  for (const list of essaysBySection.values()) {
    list.sort((a, b) => a.order - b.order);
  }

  for (const section of content.sections) {
    const routePath = `/${section.id}/`;
    pages.push({
      out: path.join(section.id, "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: routePath,
        title: sectionTitle(section, site),
        description: sectionDescription(section),
        image: ogImage(site, section.heroImage),
        content: renderSection({
          site,
          section,
          objects: objectsBySection.get(section.id) ?? [],
          people: peopleBySection.get(section.id) ?? [],
          essays: essaysBySection.get(section.id) ?? [],
        }),
      }),
    });
  }

  for (const essay of content.essays) {
    const section = sectionById.get(essay.section);
    const siblings = essaysBySection.get(essay.section) ?? [];
    const idx = siblings.findIndex((e) => e.slug === essay.slug);
    const prev = siblings.length > 1 ? siblings[(idx - 1 + siblings.length) % siblings.length] : null;
    const next = siblings.length > 1 ? siblings[(idx + 1) % siblings.length] : null;
    pages.push({
      out: path.join("essays", essay.slug, "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: `/essays/${essay.slug}/`,
        title: essayTitle(essay, site),
        description: essayDescription(essay),
        image: ogImage(site, { src: essay.heroImage, alt: essay.heroImageAlt }),
        content: renderEssay({ site, essay, section, prev, next }),
      }),
    });
  }

  for (const contentPage of content.pages) {
    const routePath = `/${contentPage.slug}/`;
    pages.push({
      out: path.join(contentPage.slug, "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: routePath,
        title: pageTitle(contentPage, site),
        description: pageDescription(contentPage),
        image: contentPage.heroImage
          ? ogImage(site, { src: contentPage.heroImage, alt: contentPage.heroImageAlt })
          : undefined,
        content: renderContentPage({ site, page: contentPage, sections: content.sections }),
      }),
    });
  }

  pages.push({
    out: path.join("interactive", "index.html"),
    html: renderPage({
      site,
      assets,
      isDev,
      path: "/interactive/",
      title: interactiveHubTitle(site),
      description: interactiveHubDescription(),
      content: renderInteractiveHub({
        site,
        interactives: content.interactives,
        objectById,
        sectionById,
      }),
    }),
  });

  for (const interactive of content.interactives) {
    const idx = hubList.indexOf(interactive);
    const n = hubList.length;
    const prev = idx >= 0 && n > 1 ? hubList[(idx - 1 + n) % n] : undefined;
    const next = idx >= 0 && n > 1 ? hubList[(idx + 1) % n] : undefined;
    const p = { site, interactive, objectById, sectionById, prev, next };
    const cover = interactive.type === "match"
      ? interactive.cards?.[0]?.image
      : interactive.image;
    pages.push({
      out: path.join("interactive", interactive.id, "index.html"),
      html: renderPage({
        site,
        assets,
        isDev,
        path: `/interactive/${interactive.id}/`,
        title: interactiveTitle(p),
        description: interactiveDescription(p),
        ogDescription: interactive.ogImageAlt,
        image: cover ? ogImage(site, { src: cover, alt: interactive.ogImageAlt ?? interactiveTitle(p) }) : undefined,
        content: renderInteractive(p),
      }),
    });
  }

  pages.push({
    out: path.join("about", "index.html"),
    html: renderPage({
      site,
      assets,
      isDev,
      path: "/about/",
      title: aboutTitle(site),
      description: aboutDescription(content.about),
      content: renderAbout({ site, about: content.about }),
    }),
  });

  pages.push({
    out: path.join("search", "index.html"),
    html: renderPage({
      site,
      assets,
      isDev,
      path: "/search/",
      title: searchTitle(site),
      description: searchDescription(),
      content: renderSearch({ site }),
    }),
  });

  pages.push({
    out: "404.html",
    html: renderPage({
      site,
      assets,
      isDev,
      path: "/404.html",
      title: `${t("pageNotFound")} — ${pick(site.siteTitle)}`,
      description: "The page you were looking for could not be found. Return to the José Rizal Digital Exhibition to explore the collection.",
      content: render404({ site }),
    }),
  });

  for (const page of pages) {
    const outPath = path.join(dist, prefix, page.out);
    mkdirSync(path.dirname(outPath), { recursive: true });
    writeFileSync(outPath, page.html);
    written += 1;
  }
  }

  // Fail the build if any output references an original or missing image.
  lintDistImages(dist);

  // Pagefind indexes the built HTML into dist/pagefind/.
  const pagefindBin = path.join(root, "node_modules", "pagefind", "lib", "runner", "bin.cjs");
  execFileSync(process.execPath, [pagefindBin, "--site", dist, "--quiet"], { stdio: "inherit" });

  console.log(`Built ${written} page(s) across ${LOCALES.length} locale(s) in ${Date.now() - started} ms → dist/`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  build().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
