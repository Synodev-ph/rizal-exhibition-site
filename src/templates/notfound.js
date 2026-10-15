import { esc } from "./layout.js";
import { icons } from "../icons.js";
import { localizeHref, pick, t } from "../i18n.js";
function escapeRoutes(site) {
    const routes = [];
    for (const item of site.nav) {
        if (item.href !== "/")
            routes.push({ label: item.label, href: item.href });
        for (const child of item.children ?? []) {
            routes.push({ label: child.label, href: child.href });
        }
    }
    return routes;
}
export function render404({ site }) {
    const links = escapeRoutes(site)
        .map((r) => `      <li><a class="notfound__link" href="${esc(localizeHref(r.href))}">${esc(pick(r.label))} ${icons.arrow}</a></li>`)
        .join("\n");
    return `<section class="notfound band band--dark" data-pagefind-ignore>
  <div class="container notfound__inner">
    <p class="notfound__code">404</p>
    <h1 class="notfound__title">${esc(t("notFoundTitle"))}</h1>
    <p class="notfound__text">${esc(t("notFoundText"))}</p>
    <ul class="notfound__links">
${links}
    </ul>
    <p class="notfound__home"><a href="${esc(localizeHref(site.basePath))}">${esc(t("returnHome"))}</a></p>
  </div>
</section>`;
}
