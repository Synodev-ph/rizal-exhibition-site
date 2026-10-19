import { esc, seoTitle } from "./layout.js";
import { renderImage } from "./media.js";
import { orderedPersonas, personaCard, renderMarkdown } from "./fragments.js";
import { pick, t } from "../i18n.js";

export function pageTitle(page, site) {
  return seoTitle(pick(page.title), pick(site.siteTitle));
}

export function pageDescription(page) {
  const plain = String(pick(page.seoDescription) || pick(page.intro) || pick(page.body)).replace(/\s+/g, " ").trim();
  if (plain.length <= 155) return plain;
  return plain.slice(0, 152).replace(/\s+\S*$/, "") + "…";
}

function renderHero(site, page) {
  const bg = page.heroImage
    ? renderImage({
        site,
        image: { src: page.heroImage, alt: page.heroImageAlt },
        className: "page-hero__bg",
        loading: "eager",
        fetchpriority: "high",
      }) + `\n  <div class="page-hero__scrim"></div>`
    : "";
  const intro = page.intro ? `\n    <p class="page-hero__intro">${esc(pick(page.intro))}</p>` : "";
  const modifier = page.heroImage ? " page-hero--image" : "";
  return `<section class="page-hero band band--dark${modifier}">
  ${bg}
  <div class="container page-hero__inner">
    <h1 class="page-hero__title">${esc(pick(page.title))}</h1>${intro}
  </div>
</section>`;
}

function renderPersonaSection(site, sections) {
  const personas = orderedPersonas(site, sections);
  if (!personas.length) return "";
  return `
<div class="band home-personas">
  <div class="container">
    <section class="persona-section" aria-labelledby="overview-personas-h">
      <h2 class="persona-section__heading" id="overview-personas-h">${esc(t("exploreExhibition"))}</h2>
      <ul class="persona-list">
${personas.map((s) => personaCard(site, s)).join("\n")}
      </ul>
    </section>
  </div>
</div>`;
}

export function renderContentPage({ site, page, sections = [] }) {
  const heading = page.bodyHeading
    ? `<h2 class="page-body__heading">${esc(pick(page.bodyHeading))}</h2>\n    `
    : "";
  const byline = page.author
    ? `<p class="page-body__byline">${esc(t("by", { author: page.author }))}</p>\n    `
    : "";
  const personas = page.personaCards ? renderPersonaSection(site, sections) : "";
  return `${renderHero(site, page)}
<div class="band band--light page-body">
  <div class="container container--narrow">
    ${heading}${byline}<div class="page-body__prose">
${renderMarkdown(pick(page.body), { site })}
    </div>
  </div>
</div>${personas}`;
}
