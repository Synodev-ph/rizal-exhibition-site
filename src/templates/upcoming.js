import { esc } from "./layout.js";
import { localizeHref, t } from "../i18n.js";
export function renderUpcoming({ title, site }) {
    return `<section class="band band--dark hero">
  <div class="container">
    <p class="upcoming-badge">${esc(t("upcoming"))}</p>
    <h1>${esc(title)}</h1>
    <p class="hero__intro">${esc(t("upcomingInPreparation"))}</p>
    <p><a href="${esc(localizeHref(site.basePath))}">${esc(t("returnHome"))}</a></p>
  </div>
</section>`;
}
