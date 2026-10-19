import { esc, seoTitle, TITLE_MAX } from "./layout.js";
import { renderImage } from "./media.js";
import {
  objectCard,
  personCard,
  renderBreadcrumb,
  renderMarkdown,
  renderPager,
  renderRelatedRow,
  renderVtStyle,
  vtName,
} from "./fragments.js";
import { pick, t } from "../i18n.js";

export function personTitle(person, site) {
  const siteTitle = pick(site.siteTitle);
  if (person.role) {
    const rich = `${person.name} · ${pick(person.role)} | ${siteTitle}`;
    if (rich.length <= TITLE_MAX) return rich;
  }
  return seoTitle(person.name, siteTitle);
}

export function personDescription(person) {
  const source = pick(person.seoDescription) || pick(person.bio) || pick(person.role) || person.name;
  const plain = source.replace(/\s+/g, " ").trim();
  if (plain.length <= 155) return plain;
  return plain.slice(0, 152).replace(/\s+\S*$/, "") + "…";
}

function renderPortrait(site, person) {
  const img = renderImage({
    site,
    image: person.portrait,
    className: "person-portrait__img",
    loading: "eager",
    fetchpriority: "high",
    sizes: "(min-width: 60rem) 32rem, 100vw",
    dataVt: vtName("person", person.id),
  });
  const credit = person.portrait.credit
    ? `\n    <figcaption class="person-portrait__credit">${esc(person.portrait.credit)}</figcaption>`
    : "";
  return `<figure class="person-portrait">
    ${img}${credit}
  </figure>`;
}

function renderLifeline(person) {
  const place = pick(person.birthplace);
  const parts = [pick(person.lifespan), place].filter(Boolean);
  if (!parts.length) return "";
  return `<p class="person__lifespan">${parts.map((s) => esc(s)).join(" · ")}</p>`;
}

function renderQuote(person) {
  if (!person.quote || !person.quoteSource) return "";
  return `<figure class="person__quote">
          <blockquote class="person__quote-text">
            <p>${esc(pick(person.quote))}</p>
          </blockquote>
          <figcaption class="person__quote-source">— <cite>${esc(pick(person.quoteSource))}</cite></figcaption>
        </figure>
        `;
}

export function renderPerson({ site, person, section, prev, next, relatedObjects, relatedPeople }) {
  const objectCards = relatedObjects.map((o) => objectCard(site, o));
  const peopleCards = relatedPeople.map((p) => personCard(site, p));
  const byline = person.author
    ? `<p class="person__byline">${esc(t("by", { author: person.author }))}</p>\n        `
    : "";
  const vtNames = [
    vtName("person", person.id),
    ...relatedObjects.map((o) => vtName("obj", o.id)),
    ...relatedPeople.map((p) => vtName("person", p.id)),
  ];
  return `${renderVtStyle(vtNames)}
<article class="person band band--light">
  <div class="container">
    ${renderBreadcrumb({ site, section, leaf: person.name })}
    <div class="person__layout">
      <div class="person__portrait-col">
        ${renderPortrait(site, person)}
      </div>
      <div class="person__info-col">
        <h1 class="person__name" data-pagefind-weight="10">${esc(person.name)}</h1>
        ${person.role ? `<p class="person__role" data-pagefind-weight="4">${esc(pick(person.role))}</p>\n        ` : ""}${renderLifeline(person)}
        ${byline}${renderQuote(person)}<div class="person__bio">
${
  person.draft
    ? `          <p class="text-pending">${esc(t("bioPending"))}</p>`
    : renderMarkdown(pick(person.bio), { site })
}
        </div>
      </div>
    </div>
    ${renderRelatedRow({ heading: t("relatedObjects"), headingId: "related-objects", cards: objectCards })}
    ${renderRelatedRow({ heading: t("relatedPeople"), headingId: "related-people", cards: peopleCards })}
    ${renderPager({
      prev,
      next,
      hrefFor: (person) => `/${person.section}/${person.id}/`,
      nameFor: (person) => person.name,
      ariaLabel: t("browsePeople"),
    })}
  </div>
</article>`;
}
