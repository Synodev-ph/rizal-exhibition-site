import { esc } from "./layout.js";
import { renderImage } from "./media.js";
import { icons } from "../icons.js";
import { localizeHref, pick, t } from "../i18n.js";
export function orderedPersonas(site, sections) {
    const dropdown = site.nav.find((i) => i.children?.length)?.children ?? [];
    const order = dropdown.map((c) => c.href);
    const byRoute = new Map(sections.map((s) => [`/${s.id}/`, s]));
    const ordered = order.map((href) => byRoute.get(href)).filter(Boolean);
    for (const s of sections)
        if (!order.includes(`/${s.id}/`))
            ordered.push(s);
    return ordered;
}
export function personaCard(site, section) {
    const media = renderImage({
        site,
        image: section.cardImage ?? section.heroImage,
        className: "persona-card__img",
        sizes: "(min-width: 69rem) 32rem, (min-width: 40rem) calc((100vw - 5rem) / 2), calc(100vw - 3rem)",
    });
    return `<li class="persona-card">
  <a class="persona-card__link" href="${esc(localizeHref(`/${section.id}/`))}">
    <span class="persona-card__media">${media}</span>
    <div class="persona-card__body">
      <h3 class="persona-card__title">${esc(pick(section.title))}</h3>
      <p class="persona-card__intro">${esc(pick(section.intro))}</p>
      <span class="persona-card__cta">${esc(t("personaCta"))} ${icons.arrow}</span>
    </div>
  </a>
</li>`;
}
export function vtName(prefix, id) {
    return `${prefix}-${String(id).replace(/[^a-z0-9-]/g, "-")}`;
}
export function renderVtStyle(names) {
    const rules = names.map((n) => `[data-vt="${n}"]{view-transition-name:${n}}`).join("");
    return `<style>${rules}</style>`;
}
function inlineMd(escaped) {
    return escaped
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="external">$1</a>')
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\s)([^*]+?)\*/g, "$1<em>$2</em>");
}
function renderProseFigure(site, alt, src, caption) {
    const img = renderImage({
        site,
        image: { src, alt },
        className: "prose-figure__img",
        sizes: "(min-width: 60rem) 55rem, 100vw",
    });
    const cap = caption
        ? `\n  <figcaption class="prose-figure__caption">${inlineMd(esc(caption))}</figcaption>`
        : "";
    return `<figure class="prose-figure">${img}${cap}\n</figure>`;
}
export function renderMarkdown(raw, { site } = {}) {
    return raw
        .split(/\r?\n\r?\n+/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
        const heading = block.match(/^##\s+(.+)$/);
        if (heading)
            return `<h2>${inlineMd(esc(heading[1].trim()))}</h2>`;
        const figure = site && block.match(/^!\[([^\]]*)\]\(([^\s)]+)(?:\s+"([^"]*)")?\)$/);
        if (figure)
            return renderProseFigure(site, figure[1], figure[2], figure[3]);
        return `<p>${inlineMd(esc(block.replace(/\s*\r?\n\s*/g, " ")))}</p>`;
    })
        .join("\n");
}
export function renderBreadcrumb({ site, section, leaf, leafLang }) {
    const langAttr = leafLang ? ` lang="${esc(leafLang)}"` : "";
    const crumbs = [
        `<li><a href="${esc(localizeHref(site.basePath))}">${esc(t("home"))}</a></li>`,
        `<li><a href="${esc(localizeHref("/jose-rizal/"))}">${esc(t("joseRizal"))}</a></li>`,
        `<li><a href="${esc(localizeHref(`/${section.id}/`))}">${esc(pick(section.title))}</a></li>`,
        `<li><span aria-current="page"${langAttr}>${esc(leaf)}</span></li>`,
    ].join("\n");
    return `<nav class="breadcrumb" aria-label="${esc(t("breadcrumb"))}">
  <ol class="breadcrumb__list">
${crumbs}
  </ol>
</nav>`;
}
export function renderPager({ prev, next, hrefFor, nameFor, nameLang, ariaLabel }) {
    if (!prev && !next)
        return "";
    const langAttr = nameLang ? ` lang="${esc(nameLang)}"` : "";
    const link = (item, dir, label) => item
        ? `<a class="object-pager__link object-pager__link--${dir}" href="${esc(localizeHref(hrefFor(item)))}" rel="${dir}">
    <span class="object-pager__dir">${esc(label)}</span>
    <span class="object-pager__name"${langAttr}>${esc(nameFor(item))}</span>
  </a>`
        : "";
    return `<nav class="object-pager" aria-label="${esc(ariaLabel)}">
  ${link(prev, "prev", t("previous"))}
  ${link(next, "next", t("next"))}
</nav>`;
}
export function renderCollectionCard({ href, media, title, titleLang, subtitle, subtitleLang, has3d }) {
    const langAttr = titleLang ? ` lang="${esc(titleLang)}"` : "";
    const subLangAttr = subtitleLang ? ` lang="${esc(subtitleLang)}"` : "";
    const subtitleEl = `\n      <span class="collection-card__en"${subLangAttr}>${subtitle ? esc(subtitle) : ""}</span>`;
    const badge = has3d ? `\n      <span class="collection-card__badge">3D</span>` : "";
    return `<li class="collection-card">
  <a class="collection-card__link" href="${esc(href)}">
    <span class="collection-card__media">${media}</span>
    <span class="collection-card__body">
      <span class="collection-card__title-row">
        <span class="collection-card__native"${langAttr}>${esc(title)}</span>${badge}
      </span>${subtitleEl}
    </span>
  </a>
</li>`;
}
export function renderRelatedRow({ heading, headingId, cards }) {
    if (!cards.length)
        return "";
    return `<section class="related-row" aria-labelledby="${headingId}">
  <h2 class="related-row__heading" id="${headingId}">${esc(heading)}</h2>
  <ul class="collection-grid">
${cards.join("\n")}
  </ul>
</section>`;
}
export function objects3dFirst(objects) {
    return [...objects].sort((a, b) => Number(Boolean(b.model3d)) - Number(Boolean(a.model3d)));
}
export function objectCard(site, obj) {
    const media = renderImage({
        site,
        image: obj.images[0],
        className: "collection-card__img",
        sizes: "(min-width: 36rem) 16rem, (min-width: 24.5rem) calc((100vw - 4.5rem) / 2), calc(100vw - 3rem)",
        dataVt: vtName("obj", obj.id),
    });
    const vernacular = obj.title.tl;
    const vernacularLeads = Boolean(vernacular) && obj.section !== "artist";
    return renderCollectionCard({
        href: localizeHref(`/${obj.section}/${obj.id}/`),
        media,
        title: vernacularLeads ? vernacular : obj.title.en,
        titleLang: vernacularLeads ? "tl" : undefined,
        subtitle: vernacularLeads ? obj.title.en : "",
        subtitleLang: undefined,
        has3d: Boolean(obj.model3d),
    });
}
export function personCard(site, person) {
    const media = renderImage({
        site,
        image: person.portrait,
        className: "collection-card__img",
        sizes: "(min-width: 36rem) 16rem, (min-width: 24.5rem) calc((100vw - 4.5rem) / 2), calc(100vw - 3rem)",
        dataVt: vtName("person", person.id),
    });
    return renderCollectionCard({
        href: localizeHref(`/${person.section}/${person.id}/`),
        media,
        title: person.name,
        subtitle: pick(person.role),
    });
}
