import { esc } from "./layout.js";
import { localizeHref, pick, t } from "../i18n.js";

export function searchTitle(site) {
  const label = t("search");
  const full = `${label} | ${pick(site.siteTitle)}`;
  return full.length <= 70 ? full : label;
}

export function searchDescription() {
  return t("searchDescription");
}

function sectionLinks(site) {
  const rizal = site.nav.find((i) => i.children?.length);
  const items = rizal?.children ?? [];
  return items
    .map((c) => `        <li><a href="${esc(localizeHref(c.href))}">${esc(pick(c.label))}</a></li>`)
    .join("\n");
}

export function renderSearch({ site }) {
  return `<section class="page-hero band band--dark search-hero" data-pagefind-ignore>
  <div class="container page-hero__inner">
    <h1 class="page-hero__title">${esc(t("searchHeading"))}</h1>
    <p class="page-hero__intro">${esc(t("searchIntro"))}</p>
  </div>
</section>
<div class="band band--light search-body" data-pagefind-ignore>
  <div class="container container--narrow">
    <div id="search" class="search-ui"></div>
    <noscript>
      <p class="search-noscript">${esc(t("searchNoscript"))}</p>
      <ul class="search-noscript__links">
${sectionLinks(site)}
      </ul>
    </noscript>
  </div>
</div>`;
}
