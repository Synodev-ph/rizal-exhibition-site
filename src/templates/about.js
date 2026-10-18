import { esc } from "./layout.js";
import { renderImage } from "./media.js";
import { renderMarkdown } from "./fragments.js";
import { icons } from "../icons.js";
import { pick, t } from "../i18n.js";

export function aboutTitle(site) {
  const title = t("aboutProject");
  const full = `${title} | ${pick(site.siteTitle)}`;
  return full.length <= 70 ? full : title;
}

export function aboutDescription(about) {
  const plain = pick(about.intro).replace(/\s+/g, " ").trim();
  if (plain.length <= 155) return plain;
  return plain.slice(0, 152).replace(/\s+\S*$/, "") + "…";
}

function renderBlurb(blurb) {
  return `<section class="about-blurb">
      <h2 class="about-blurb__heading">${esc(pick(blurb.heading))}</h2>
      <div class="about-blurb__body">
${renderMarkdown(pick(blurb.body))}
      </div>
    </section>`;
}

function renderMessage(site, message, index) {
  const poster = renderImage({
    site,
    image: message.poster,
    className: "message-card__poster",
    loading: index < 3 ? "eager" : "lazy",
    sizes: "(min-width: 60rem) 28rem, (min-width: 40rem) 45vw, 100vw",
  });
  const dataVideo = message.video
    ? ` data-video="${esc(site.basePath)}${esc(message.video)}"`
    : "";
  return `<li class="message-card">
  <div class="message-card__media">
    ${poster}
    <button class="message-card__play" type="button"${dataVideo} aria-label="${esc(t("playMessage", { name: message.name }))}">
      <span class="message-card__play-icon" aria-hidden="true">${icons.play}</span>
    </button>
  </div>
  <div class="message-card__caption">
    <h3 class="message-card__name">${esc(message.name)}</h3>
    <p class="message-card__role">${esc(pick(message.role))}</p>
  </div>
</li>`;
}

export function renderAbout({ site, about }) {
  const blurbs = about.blurbs.map(renderBlurb).join("\n    ");
  const messages = about.messages.map((m, i) => renderMessage(site, m, i)).join("\n");
  const heroBg = renderImage({
    site,
    image: { src: "home/about-the-project.webp", alt: "" },
    className: "page-hero__bg",
    loading: "eager",
    fetchpriority: "high",
  });
  return `<section class="page-hero band band--dark page-hero--image">
  ${heroBg}
  <div class="page-hero__scrim"></div>
  <div class="container page-hero__inner">
    <h1 class="page-hero__title">${esc(t("aboutProject"))}</h1>
    <p class="page-hero__intro">${esc(pick(about.intro))}</p>
  </div>
</section>
<div class="band band--light about-blurbs">
  <div class="container container--narrow">
    ${blurbs}
  </div>
</div>
<section class="band band--light about-messages" aria-labelledby="messages-h">
  <div class="container">
    <h2 class="about-messages__heading" id="messages-h">${esc(pick(about.messagesHeading))}</h2>
    <ul class="message-grid">
${messages}
    </ul>
  </div>
</section>`;
}
