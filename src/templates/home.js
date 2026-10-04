import { icons } from "../icons.js";
import { orderedPersonas, personaCard } from "./fragments.js";
import { esc } from "./layout.js";
import { renderImage } from "./media.js";
import { localizeHref, pick, t } from "../i18n.js";

function renderHeroCtas(site) {
  if (!site.heroCtas?.length) return "";
  const buttons = site.heroCtas
    .map((cta, i) => {
      const variant = i === 0 ? "hero-btn--primary" : "hero-btn--ghost";
      if (cta.video) {
        const url = `${site.baseUrl}/${cta.video}`;
        return `<a class="hero-btn ${variant}" href="${esc(url)}" data-video="${esc(url)}">${esc(pick(cta.label))}</a>`;
      }
      return `<a class="hero-btn ${variant}" href="${esc(localizeHref(cta.href))}">${esc(pick(cta.label))}</a>`;
    })
    .join("\n      ");
  return `\n    <div class="hero__actions">
      ${buttons}
    </div>`;
}

function renderHero(site) {
  return `<section class="hero band band--dark">
  <video class="hero__video" muted loop playsinline preload="metadata" poster="${site.basePath}img/hero-poster.webp" aria-hidden="true" tabindex="-1">
    <source src="${site.basePath}video/hero-banner.mp4" type="video/mp4">
  </video>
  <div class="hero__scrim"></div>
  <div class="container hero__inner">
    <h1 class="hero__title">${esc(pick(site.exhibitionTitle))}:<br>
      <span class="hero__subtitle">${esc(pick(site.exhibitionSubtitle))}</span></h1>
    <p class="hero__intro">${esc(pick(site.description))}</p>${renderHeroCtas(site)}
  </div>
</section>`;
}

const HOME_3D_CARDS = 4;

function model3dCard(site, obj) {
  const model =  (
    obj.model3d
  );
  const media = renderImage({
    site,
    image: { src: model.poster, alt: model.altText },
    className: "models3d__img",
    sizes: "min(18rem, 78vw)",
  });
  return `<li class="models3d__item">
  <a class="models3d__link" href="${esc(localizeHref(`/${obj.section}/${obj.id}/`))}">
    <span class="models3d__media">${media}
      <span class="models3d__badge" aria-hidden="true">${icons.cube}3D</span>
    </span>
    <span class="models3d__body">
      ${obj.title.tl ? `<span class="models3d__native" lang="tl">${esc(obj.title.tl)}</span>\n      <span class="models3d__en">${esc(obj.title.en)}</span>` : `<span class="models3d__native">${esc(obj.title.en)}</span>`}
    </span>
  </a>
</li>`;
}

function render3dGallery(site, objects) {
  const models = objects.filter((o) => o.model3d);
  if (!models.length) return "";
  const count = HOME_3D_CARDS;
  const cards = Array.from(
    { length: count },
    (_, i) => models[i % models.length],
  );
  return `<div class="band home-3d">
  <div class="container">
    <section class="models3d" aria-labelledby="models3d-h">
      <h2 class="models3d__heading" id="models3d-h">${esc(t("home3dHeading"))}</h2>
      <p class="models3d__intro">${esc(t("home3dIntro"))}</p>
      <ul class="models3d__scroller">
${cards.map((obj) => model3dCard(site, obj)).join("\n")}
      </ul>
    </section>
  </div>
</div>`;
}

function renderPersonas(site, sections) {
  const personas = orderedPersonas(site, sections);
  if (!personas.length) return "";
  return `<div class="band home-personas">
  <div class="container">
    <section class="persona-section" aria-labelledby="personas-h">
      <h2 class="persona-section__heading" id="personas-h">${esc(t("exploreExhibition"))}</h2>
      <ul class="persona-list">
${personas.map((s) => personaCard(site, s)).join("\n")}
      </ul>
    </section>
  </div>
</div>`;
}

function renderTeaser(site, teaser) {
  const accent = teaser.accent ? ` teaser--${esc(teaser.accent)}` : "";
  const text = teaser.text
    ? `\n      <p class="teaser__text">${esc(pick(teaser.text))}</p>`
    : "";
  const media = teaser.image
    ? `\n    <span class="teaser__media">${renderImage({ site, image: teaser.image, className: "teaser__img", sizes: "(min-width: 90rem) 42.75rem, (min-width: 48rem) calc((100vw - 4.5rem) / 2), calc(100vw - 3rem)" })}</span>`
    : "";
  return `<article class="teaser${accent}">
    <div class="teaser__content">
      <h2 class="teaser__heading">${esc(pick(teaser.heading))}</h2>${text}
      <a class="teaser__more" href="${esc(localizeHref(teaser.href))}">${esc(t("readMore"))} ${icons.arrow}</a>
    </div>${media}
  </article>`;
}

function renderTeasers(site) {
  if (!site.homeTeasers?.length) return "";
  return `<div class="band band--light home-teasers">
  <div class="container">
    <div class="teaser-grid">
    ${site.homeTeasers.map((t) => renderTeaser(site, t)).join("\n    ")}
    </div>
  </div>
</div>`;
}

function renderQuote(site) {
  const q = site.homeQuote;
  if (!q) return "";
  const langAttr = q.lang ? ` lang="${esc(q.lang)}"` : "";
  const signature = icons["rizal-signature"]
    ? `<span class="pullquote__signature">${icons["rizal-signature"]}<img class="pullquote__signature-anim" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-anim-src="${esc(site.basePath)}img/rizal-signature.webp" alt="" aria-hidden="true" width="480" height="208" hidden></span>
      <span class="visually-hidden">${esc(q.attribution)}</span>`
    : esc(q.attribution);
  return `<div class="band home-quote">
  <div class="container">
    <figure class="pullquote">
      <blockquote class="pullquote__text"${langAttr}>&ldquo;${esc(q.text)}&rdquo;</blockquote>
      <figcaption class="pullquote__cite">${signature}</figcaption>
    </figure>
  </div>
</div>`;
}

export function renderHome({ site, sections = [], objects = [] }) {
  return [
    renderHero(site),
    render3dGallery(site, objects),
    renderPersonas(site, sections),
    renderQuote(site),
    renderTeasers(site),
  ]
    .filter(Boolean)
    .join("\n");
}
