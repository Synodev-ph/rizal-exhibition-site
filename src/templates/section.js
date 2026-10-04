import { esc, seoTitle } from "./layout.js";
import { renderImage } from "./media.js";
import { icons } from "../icons.js";
import { objectCard, personCard, renderVtStyle, vtName } from "./fragments.js";
import { localizeHref, pick, t } from "../i18n.js";

export function sectionTitle(section, site) {
  return seoTitle(pick(section.title), pick(site.siteTitle));
}

export function sectionDescription(section) {
  const plain = pick(section.intro).replace(/\s+/g, " ").trim();
  if (plain.length <= 155) return plain;
  return plain.slice(0, 152).replace(/\s+\S*$/, "") + "…";
}

function renderHero(site, section) {
  const bg = renderImage({
    site,
    image: section.heroImage,
    className: "section-hero__bg",
    loading: "eager",
    fetchpriority: "high",
  });
  const badge = section.status === "upcoming"
    ? `<p class="upcoming-badge">${esc(t("upcoming"))}</p>\n    `
    : "";
  return `<section class="section-hero band band--dark">
  ${bg}
  <div class="section-hero__scrim"></div>
  <div class="container section-hero__inner">
    ${badge}<a class="section-hero__eyebrow" href="${esc(localizeHref("/jose-rizal/"))}">${esc(t("joseRizal"))}</a>
    <h1 class="section-hero__title">${esc(pick(section.title))}</h1>
    <p class="section-hero__intro">${esc(pick(section.intro))}</p>
  </div>
</section>`;
}

function renderEssayTeaser(essay) {
  return `<li class="essay-card">
  <h3 class="essay-card__title">${esc(pick(essay.title))}</h3>
  <p class="essay-card__byline">${esc(t("by", { author: essay.author }))}</p>
  <p class="essay-card__summary">${esc(pick(essay.summary))}</p>
  <a class="essay-card__more" href="${esc(localizeHref(`/essays/${essay.slug}/`))}" aria-label="${esc(t("readMoreAria", { title: pick(essay.title) }))}">${esc(t("readMore"))} ${icons.arrow}</a>
</li>`;
}

function renderEssayList(essays) {
  return `<ul class="essay-list">
${essays.map((e) => renderEssayTeaser(e)).join("\n")}
    </ul>`;
}

function objects3dFirst(objects) {
  return [...objects].sort((a, b) => Number(Boolean(b.model3d)) - Number(Boolean(a.model3d)));
}

function panelEmpty(message) {
  return `<p class="section-panel__empty">${esc(message)}</p>`;
}

function renderPanel(id, heading, inner, hideHeading = false) {
  const headingClass = `section-panel__heading${hideHeading ? " visually-hidden" : ""}`;
  return `    <section class="section-panel" id="${esc(id)}" aria-labelledby="${esc(id)}-h">
      <h2 class="${headingClass}" id="${esc(id)}-h">${esc(heading)}</h2>
      ${inner}
    </section>`;
}

function objectCollection(site, objects) {
  return {
    entries: objects3dFirst(objects).map((o) => ({ category: o.category, card: objectCard(site, o) })),
    heading: t("exploreObjects"),
    empty: t("objectsComingSoon"),
  };
}

function peopleCollection(site, people) {
  return {
    entries: people.map((p) => ({ category: p.category, card: personCard(site, p) })),
    heading: t("explorePeople"),
    empty: t("peopleComingSoon"),
  };
}

function inCategory(collection, categoryId) {
  return { ...collection, entries: collection.entries.filter((e) => e.category === categoryId) };
}

function renderCategoryPanel(id, heading, essays, collection, withEssays, hideHeading = false) {
  const essaysCol = withEssays
    ? `<div class="category-panel__essays">
        <h3 class="section-panel__subheading">${esc(t("essays"))}</h3>
        ${essays.length ? renderEssayList(essays) : panelEmpty(t("essaysComingSoon"))}
      </div>
      `
    : "";
  const collectionCol = `<div class="category-panel__objects">
        <h3 class="section-panel__subheading">${esc(collection.heading)}</h3>
        ${
          collection.entries.length
            ? `<ul class="collection-grid">
${collection.entries.map((e) => e.card).join("\n")}
        </ul>`
            : panelEmpty(collection.empty)
        }
      </div>`;
  return renderPanel(
    id,
    heading,
    `<div class="category-panel__columns${withEssays ? "" : " category-panel__columns--single"}">
      ${essaysCol}${collectionCol}
    </div>`,
    hideHeading,
  );
}

function renderCategoryView(section, essays, collection) {
  const uncategorised = essays.filter((e) => !e.category);
  const withEssays = essays.length > 0;

  const tabs = [
    { id: "section-intro", label: t("introduction") },
    ...section.categories.map((c) => ({ id: `category-${c.id}`, label: pick(c.label) })),
  ];
  const tabBar = `<nav class="section-tabs" aria-label="${esc(t("categoryNav"))}">
      <ul class="section-tabs__list">
${tabs.map((tab) => `        <li><a class="section-tabs__link" href="#${tab.id}">${esc(tab.label)}</a></li>`).join("\n")}
      </ul>
    </nav>`;

  const introPanel = renderCategoryPanel("section-intro", t("introduction"), uncategorised, collection, withEssays, true);

  const categoryPanels = section.categories
    .map((c) =>
      renderCategoryPanel(
        `category-${c.id}`,
        pick(c.label),
        essays.filter((e) => e.category === c.id),
        inCategory(collection, c.id),
        withEssays,
      )
    )
    .join("\n");

  return `<div class="band band--light section-body">
  <div class="container">
    ${tabBar}
${introPanel}
${categoryPanels}
  </div>
</div>`;
}

function renderGridView(site, section, essays, cards) {
  const essayBlock = essays.length
    ? `<div class="section-body__editorial"><h2 class="section-grid__heading">${esc(t("essays"))}</h2>\n    ${renderEssayList(essays)}</div>\n    `
    : "";
  const collectionBlock = cards.length
    ? `<h2 class="section-grid__heading">${esc(t("exploreCollection"))}</h2>
    <ul class="collection-grid">
${cards.join("\n")}
    </ul>`
    : "";
  return `<div class="band band--light section-body">
  <div class="container">
    ${essayBlock}${collectionBlock}
  </div>
</div>`;
}

function renderUpcomingView(site, section, essays) {
  const editorial = essays.length
    ? `<div class="band band--light section-body">
  <div class="container">
    <h2 class="section-grid__heading">${esc(t("essays"))}</h2>
    ${renderEssayList(essays)}
  </div>
</div>
`
    : "";
  return `${editorial}<div class="band band--light section-upcoming">
  <div class="container">
    <p class="upcoming-badge upcoming-badge--on-light">${esc(t("upcoming"))}</p>
    <h2 class="section-upcoming__heading">${esc(t("collectionBeingPrepared"))}</h2>
    <p class="section-upcoming__text">${esc(t("collectionComingSoonText"))}</p>
    <p><a href="${esc(localizeHref(site.basePath))}">${esc(t("returnHome"))}</a></p>
  </div>
</div>`;
}

export function renderSection({ site, section, objects, people, essays }) {
  let body;
  let vtNames = [];
  if (section.status === "upcoming") {
    body = renderUpcomingView(site, section, essays);
  } else if (section.categories.length) {
    const usePeople = people.length > 0;
    body = renderCategoryView(
      section,
      essays,
      usePeople ? peopleCollection(site, people) : objectCollection(site, objects),
    );
    vtNames = usePeople
      ? people.map((p) => vtName("person", p.id))
      : objects.map((o) => vtName("obj", o.id));
  } else if (people.length) {
    body = renderGridView(site, section, essays, people.map((p) => personCard(site, p)));
    vtNames = people.map((p) => vtName("person", p.id));
  } else {
    body = renderGridView(site, section, essays, objects3dFirst(objects).map((o) => objectCard(site, o)));
    vtNames = objects.map((o) => vtName("obj", o.id));
  }
  const vtStyle = vtNames.length ? renderVtStyle(vtNames) + "\n" : "";
  return `${vtStyle}${renderHero(site, section)}
${body}`;
}
