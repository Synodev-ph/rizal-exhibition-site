import {
  objectLead,
  objectCard,
  objects3dFirst,
  personCard,
  renderBreadcrumb,
  renderMarkdown,
  renderPager,
  renderVtStyle,
  vtName,
} from "./fragments.js";
import { esc, seoTitle, TITLE_MAX } from "./layout.js";
import { imageUrl, modelUrl, renderImage, viewerImage, viewerModel } from "./media.js";
import { icons } from "../icons.js";
import { localizeHref, pick, t } from "../i18n.js";

export function objectTitle(object, site) {
  const siteTitle = pick(site.siteTitle);
  const lead = objectName(object);
  if (objectLead(object).lang && object.title.en) {
    const rich = `${lead} · ${object.title.en} | ${siteTitle}`;
    if (rich.length <= TITLE_MAX) return rich;
  }
  return seoTitle(lead, siteTitle);
}

export function objectName(object) {
  return objectLead(object).name;
}

export function objectDescription(object) {
  const plain = (pick(object.seoDescription) || pick(object.description)).replace(/\s+/g, " ").trim();
  if (plain.length <= 155) return plain;
  return plain.slice(0, 152).replace(/\s+\S*$/, "") + "…";
}

function jsonScript(className, data) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/json" class="${className}">${json}</script>`;
}

function renderGallery(site, object, puzzles) {
  const model = object.model3d;
  const hasModel = Boolean(model);

  const slides = [];
  const thumbItems = [];

  if (model) {
    const posterImage = { src: model.poster, alt: model.altText };
    const posterPic = renderImage({
      site,
      image: posterImage,
      className: "object-gallery__img",
      loading: "eager",
      fetchpriority: "high",
      sizes: "(min-width: 60rem) 46rem, 100vw",
      dataVt: vtName("obj", object.id),
    });
    const modelCredit = model.credit ? ` data-credit="${esc(model.credit)}"` : "";
    slides.push(`<div class="object-gallery__slide object-gallery__slide--model" data-slide="0"${modelCredit}>
        <div class="object-gallery__model" data-model="${esc(modelUrl(site, model.src))}" data-model-poster="${esc(imageUrl(site, model.poster))}" data-model-alt="${esc(model.altText)}">
          ${posterPic}
          <button class="object-gallery__model-launch" type="button">
            <span class="object-gallery__badge" aria-hidden="true">${icons.cube}3D</span>
            <span class="object-gallery__model-cta">${esc(t("viewIn3d"))}</span>
          </button>
          <div class="object-gallery__model-loader" data-model-progress hidden role="status" aria-live="polite">
            <span class="object-gallery__model-loader-label">${esc(t("loading3d"))} <span data-model-percent>0%</span></span>
            <span class="object-gallery__model-loader-track"><span class="object-gallery__model-loader-bar" data-model-bar></span></span>
          </div>
          <div class="object-gallery__model-prompt" data-model-prompt hidden aria-hidden="true">
            <span class="object-gallery__model-prompt-item" data-prompt="rotate">${icons.drag}<span>${esc(t("dragToRotate"))}</span></span>
            <span class="object-gallery__model-prompt-item" data-prompt="zoom">${icons.scroll}<span>${esc(t("scrollToZoom"))}</span></span>
          </div>
        </div>
      </div>`);
    const posterThumb = renderImage({
      site,
      image: posterImage,
      className: "object-gallery__thumb-img",
      sizes: "5rem",
    });
    thumbItems.push(
      `<li><a class="object-gallery__thumb object-gallery__thumb--model" href="${esc(imageUrl(site, model.poster))}" aria-current="true" data-slide="0"><span class="object-gallery__thumb-badge" aria-hidden="true">${icons.cube}3D</span>${posterThumb}<span class="visually-hidden">${esc(t("model3dLabel"))}</span></a></li>`,
    );
  }

  const offset = hasModel ? 1 : 0;
  object.images.forEach((img, i) => {
    const idx = offset + i;
    const isHero = idx === 0;
    const pic = renderImage({
      site,
      image: img,
      className: "object-gallery__img",
      loading: isHero ? "eager" : "lazy",
      fetchpriority: isHero ? "high" : undefined,
      sizes: "(min-width: 60rem) 46rem, 100vw",
      dataVt: isHero ? vtName("obj", object.id) : undefined,
    });
    const hidden = idx === 0 ? "" : " hidden";
    const credit = img.credit ? ` data-credit="${esc(img.credit)}"` : "";
    slides.push(`<div class="object-gallery__slide" data-slide="${idx}"${hidden}${credit}>${pic}</div>`);
    const current = idx === 0 ? ' aria-current="true"' : "";
    const thumb = renderImage({
      site,
      image: img,
      className: "object-gallery__thumb-img",
      sizes: "5rem",
    });
    thumbItems.push(
      `<li><a class="object-gallery__thumb" href="${esc(imageUrl(site, img.src))}"${current} data-slide="${idx}">${thumb}</a></li>`,
    );
  });

  for (const puzzle of puzzles) {
    const img = object.images.find((i) => i.src === puzzle.image) ?? object.images[0];
    const thumb = renderImage({
      site,
      image: { ...img, alt: "" },
      className: "object-gallery__thumb-img",
      sizes: "5rem",
    });
    thumbItems.push(
      `<li><a class="object-gallery__thumb object-gallery__thumb--puzzle" href="${esc(localizeHref(`/interactive/${puzzle.id}/`))}"><span class="object-gallery__thumb-badge" aria-hidden="true">${icons.grid}${esc(t("puzzleBadge"))}</span>${thumb}<span class="visually-hidden">${esc(t("puzzlePlayLabel"))}</span></a></li>`,
    );
  }

  const firstCredit = hasModel ? model.credit ?? null : object.images[0].credit ?? null;
  const anyCredit = (hasModel && Boolean(model.credit)) || object.images.some((img) => img.credit);
  const caption = anyCredit
    ? `\n    <figcaption class="object-gallery__credit" data-gallery-credit${firstCredit ? "" : " hidden"}>${esc(firstCredit ?? "")}</figcaption>`
    : "";

  const zoomBtn = `<button class="object-gallery__zoom" type="button" data-viewer-zoom>
      ${icons.zoom}<span class="visually-hidden">${esc(t("zoomInto", { name: objectName(object) }))}</span>
    </button>`;

  const thumbs =
    thumbItems.length > 1
      ? `
  <ul class="object-gallery__thumbs">
${thumbItems.join("\n")}
  </ul>`
      : "";

  const viewerData = jsonScript("object-gallery__data", [
    ...(model ? [viewerModel(site, model)] : []),
    ...object.images.map((img) => viewerImage(site, img)),
  ]);

  return `<div class="object-gallery" data-viewer>
  <figure class="object-gallery__main">
    <div class="object-gallery__slides">
      ${slides.join("\n      ")}
    </div>
    ${zoomBtn}${caption}
  </figure>${thumbs}
  ${viewerData}
</div>`;
}

function renderExplore(site, explore) {
  if (!explore.length) return "";
  const cards = objects3dFirst(explore).map((obj) => objectCard(site, obj)).join("\n");
  return `<section class="collection band band--light" aria-labelledby="explore-heading">
  <div class="container">
    <h2 class="collection__heading" id="explore-heading">${esc(t("exploreTheCollection"))}</h2>
    <ul class="collection-grid">
${cards}
    </ul>
  </div>
</section>`;
}

export function renderObject({
  site,
  object,
  section,
  prev,
  next,
  explore,
  relatedPeople = [],
  puzzles = [],
}) {
  const peopleCards = relatedPeople.map((p) => personCard(site, p));
  const vtNames = [
    vtName("obj", object.id),
    ...explore.map((o) => vtName("obj", o.id)),
    ...relatedPeople.map((p) => vtName("person", p.id)),
  ];
  const lead = objectLead(object);
  return `${renderVtStyle(vtNames)}
<article class="object band band--light">
  <div class="container">
    <div class="object__stage">
    ${renderBreadcrumb({ site, section, leaf: lead.name, leafLang: lead.lang })}
    <div class="object__layout">
      <div class="object__gallery-col">
        ${renderGallery(site, object, puzzles)}
      </div>
      <div class="object__info-col">
        <h1 class="object__title" data-pagefind-weight="10">
          ${
            lead.lang
              ? `<span class="object__title-native" lang="${lead.lang}">${esc(lead.name)}</span>${object.title.en ? `\n          <span class="object__title-en">${esc(object.title.en)}</span>` : ""}`
              : `<span class="object__title-native">${esc(lead.name)}</span>`
          }
        </h1>${object.title.es && lead.lang !== "es" ? `\n        <p class="object__title-es" lang="es">${esc(object.title.es)}</p>` : ""}${object.title.note ? `\n        <p class="object__title-es object__title-note">${esc(object.title.note)}</p>` : ""}
${
  object.draft
    ? ""
    : `        <div class="object__description">
${renderMarkdown(pick(object.description))}
        </div>`
}${
  object.model3d?.note
    ? `\n        <p class="object__model-note">${esc(object.model3d.note)}</p>`
    : ""
}${
  object.author && !object.draft
    ? `\n        <p class="object__author">${esc(t("by", { author: object.author }))}</p>`
    : ""
}
        <p class="object__rights">${esc(object.rights)}</p>
      </div>
    </div>
    </div>

    ${renderPager({
      prev,
      next,
      hrefFor: (o) => `/${o.section}/${o.id}/`,
      nameFor: (o) => objectName(o),
      nameLang: "tl",
      ariaLabel: t("browseObjects"),
    })}
  </div>
</article>
${renderExplore(site, explore)}`;
}
