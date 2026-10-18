import { esc, seoTitle } from "./layout.js";
import { imageUrl, renderImage } from "./media.js";
import { objectLead } from "./fragments.js";
import { icons } from "../icons.js";
import { localizeHref, pick, t } from "../i18n.js";

export function interactiveTitle(interactive, object, site) {
  return seoTitle(objectLead(object).name, pick(site.siteTitle));
}

export function interactiveDescription(interactive, object) {
  const lead = objectLead(object);
  return lead.lang
    ? t("puzzleDescription", { title: lead.name, subtitle: object.title.en })
    : t("puzzleDescriptionEn", { title: lead.name });
}

function control(key, icon, attrs, extra = "") {
  return `<button class="puzzle-btn puzzle__control${extra}" type="button" ${attrs}>${icons[icon]}<span class="puzzle__control-label">${esc(t(key))}</span></button>`;
}

function shareButtons(attr) {
  return [
    ["facebook", "Facebook"],
    ["x", "X"],
    ["instagram", "Instagram"],
  ]
    .map(
      ([id, name]) =>
        `<button class="puzzle__share-btn" type="button" ${attr}="${id}" aria-label="${esc(t("puzzleShareTo", { platform: name }))}">${icons[id]}</button>`,
    )
    .join("\n          ");
}

function stats(prefix) {
  return `<div class="${prefix}__stat"><dt>${esc(t("puzzleTime"))}</dt><dd data-puzzle-time>0:00</dd></div>
          <div class="${prefix}__stat"><dt>${esc(t("puzzleMoves"))}</dt><dd data-puzzle-moves>0</dd></div>`;
}

function renderPuzzle({ site, interactive, object, section }) {
  const lead = objectLead(object);
  const title = lead.name;
  const langAttr = lead.lang ? ` lang="${lead.lang}"` : "";
  const shareName = title;
  const sizes = interactive.sizes ?? [3, 4, 5];
  const image = object.images.find((img) => img.src === interactive.image) ?? {
    src: interactive.image,
    alt: "",
  };
  const peek = renderImage({
    site,
    image: { ...image, alt: "" },
    className: "puzzle__peek-img",
    sizes: "(min-width: 60rem) 60vw, 100vw",
  });

  const msgs = {
    tile: t("puzzleTile"),
    error: t("puzzleLoadError"),
    solved: t("puzzleSolvedStatus"),
    "show-numbers": t("puzzleShowNumbers"),
    "hide-numbers": t("puzzleHideNumbers"),
    "share-title": t("puzzleShareTitle", { title: shareName }),
    "share-text": t("puzzleShareText", { title: shareName }),
    "share-copied": t("puzzleShareCopied"),
  };
  const msgAttrs = Object.entries(msgs)
    .map(([k, v]) => `data-msg-${k}="${esc(v)}"`)
    .join("\n    ");

  return `<section class="puzzle band band--light" data-puzzle data-pagefind-ignore
    data-image="${esc(imageUrl(site, interactive.image))}"
    data-sizes="${sizes.join(",")}"
    ${msgAttrs}>
  <div class="container">
  <nav class="breadcrumb" aria-label="${esc(t("breadcrumb"))}">
    <ol class="breadcrumb__list">
      <li><a href="${esc(localizeHref(site.basePath))}">${esc(t("home"))}</a></li>
      <li><a href="${esc(localizeHref("/interactive/"))}">${esc(t("interactives"))}</a></li>
      <li><span aria-current="page"${langAttr}>${esc(title)}</span></li>
    </ol>
  </nav>
  <div class="puzzle__layout">
    <div class="puzzle__heading">
      <h1 class="puzzle__title"${langAttr}>${esc(title)}</h1>${lead.lang ? `\n      <p class="puzzle__subtitle">${esc(object.title.en)}</p>` : ""}
    </div>
    <div class="puzzle__stage">
      <div class="puzzle__frame">
        <div class="puzzle__board" data-puzzle-board role="group" aria-label="${esc(t("puzzleBoard", { title }))}">
          <p class="puzzle__loading">${esc(t("puzzleLoading"))}</p>
        </div>
        <div class="puzzle__peek" aria-hidden="true">${peek}</div>
      </div>
    </div>
    <div class="puzzle__panel">
      <dl class="puzzle__stats">
          ${stats("puzzle")}
          <div class="puzzle__stat"><dt>${esc(t("puzzleTiles"))}</dt><dd data-puzzle-tiles>${sizes[0]}×${sizes[0]}</dd></div>
      </dl>
      <p class="puzzle__instructions">${esc(t("puzzleInstructions"))}</p>
      <div class="puzzle__controls">
        ${control("puzzlePeek", "eye", "data-puzzle-peek-btn")}
        ${control("puzzleShowNumbers", "hash", 'data-puzzle-numbers aria-pressed="false"')}
        ${control("puzzleSize", "grid", "data-puzzle-size")}
        ${control("puzzleShuffle", "shuffle", "data-puzzle-shuffle")}
        ${control("puzzleHowTo", "info", "data-puzzle-info", " puzzle__control--info")}
      </div>
      <div class="puzzle__share">
        <span class="puzzle__share-label">${esc(t("puzzleShare"))}</span>
        <div class="puzzle__share-list">
          ${shareButtons("data-puzzle-share")}
        </div>
      </div>
      <p class="puzzle__note" data-puzzle-share-status role="status" aria-live="polite"></p>
      <p class="puzzle__status" data-puzzle-status role="status" aria-live="polite" hidden></p>
    </div>
  </div>
  </div>
  <dialog class="puzzle-dialog" data-puzzle-dialog aria-labelledby="puzzle-solved-title">
    <canvas class="puzzle-dialog__confetti" data-puzzle-confetti aria-hidden="true"></canvas>
    <div class="puzzle-dialog__card">
      <p class="puzzle-dialog__kicker">${esc(t("puzzleSolvedKicker"))}</p>
      <h2 class="puzzle-dialog__title" id="puzzle-solved-title">${esc(t("puzzleSolvedTitle"))}</h2>
      <p class="puzzle-dialog__text">${esc(t("puzzleSolvedText", { title: shareName }))}</p>
      <dl class="puzzle__stats puzzle-dialog__stats">
          ${stats("puzzle").replaceAll("data-puzzle-", "data-dialog-")}
      </dl>
      <div class="puzzle__share puzzle-dialog__share">
        <span class="puzzle__share-label">${esc(t("puzzleShare"))}</span>
        <div class="puzzle__share-list">
          ${shareButtons("data-puzzle-share")}
        </div>
      </div>
      <p class="puzzle__note" data-dialog-share-status role="status" aria-live="polite"></p>
      <div class="puzzle-dialog__actions">
        <button class="puzzle-btn puzzle-btn--primary" type="button" data-puzzle-again>${esc(t("puzzlePlayAgain"))}</button>
        <button class="puzzle-btn" type="button" data-dialog-close>${esc(t("close"))}</button>
      </div>
    </div>
  </dialog>
  <dialog class="puzzle-dialog puzzle-dialog--info" data-puzzle-info-dialog aria-labelledby="puzzle-info-title">
    <div class="puzzle-dialog__card">
      <h2 class="puzzle-dialog__title" id="puzzle-info-title">${esc(t("puzzleHowTo"))}</h2>
      <p class="puzzle-dialog__text">${esc(t("puzzleInstructions"))}</p>
      <div class="puzzle-dialog__actions">
        <button class="puzzle-btn" type="button" data-dialog-close>${esc(t("close"))}</button>
      </div>
    </div>
  </dialog>
</section>`;
}

export function renderInteractive(p) {
  switch (p.interactive.type) {
    case "puzzle":
      return renderPuzzle(p);
    default:
      throw new Error(`Unknown interactive type "${p.interactive.type}"`);
  }
}

const UPCOMING = [
  { type: "match", label: "interactiveTypeMatch", title: "interactiveMatchTitle", text: "interactiveMatchText", icon: "grid" },
  { type: "map", label: "interactiveTypeMap", title: "interactiveMapTitle", text: "interactiveMapText", icon: "pin" },
];

const TYPE_TEXT = {
  puzzle: { label: "interactiveTypePuzzle", title: "interactivePuzzleTitle", text: "interactivePuzzleText" },
};

export function interactiveHubTitle(site) {
  return seoTitle(t("interactives"), pick(site.siteTitle));
}

export function interactiveHubDescription() {
  return t("interactivesIntro");
}

function hubCard(site, interactive, object) {
  const lead = objectLead(object);
  const langAttr = lead.lang ? ` lang="${lead.lang}"` : "";
  const text = TYPE_TEXT[interactive.type];
  const [before, after = ""] = t(text.text).split("{title}");
  const image = object.images.find((img) => img.src === interactive.image) ?? { src: interactive.image, alt: "" };
  const media = renderImage({
    site,
    image: { ...image, alt: "" },
    className: "interactive-card__img",
    sizes: "(min-width: 60rem) 30vw, (min-width: 40rem) 45vw, 100vw",
  });
  return `<li class="interactive-card">
      <a class="interactive-card__link" href="${esc(localizeHref(`/interactive/${interactive.id}/`))}">
        <span class="interactive-card__frame">${media}</span>
        <span class="interactive-card__body">
          <span class="interactive-card__type">${esc(t(text.label))}</span>
          <span class="interactive-card__title">${esc(t(text.title))}</span>
          <span class="interactive-card__subtitle">${esc(before)}<i${langAttr}>${esc(lead.name)}</i>${esc(after)}</span>
          <span class="puzzle-btn interactive-card__cta" aria-hidden="true">${esc(t("interactivePlay"))}</span>
        </span>
      </a>
    </li>`;
}

function upcomingCard(game) {
  return `<li class="interactive-card interactive-card--soon">
      <span class="interactive-card__frame">${icons[game.icon]}</span>
      <span class="interactive-card__body">
        <span class="interactive-card__type">${esc(t(game.label))}</span>
        <span class="interactive-card__title">${esc(t(game.title))}</span>
        <span class="interactive-card__subtitle">${esc(t(game.text))}</span>
        <span class="interactive-card__soon">${esc(t("interactiveComingSoon"))}</span>
      </span>
    </li>`;
}

export function renderInteractiveHub({ site, items }) {
  const built = new Set(items.map((i) => i.interactive.type));
  const cards = [
    ...items.map(({ interactive, object }) => hubCard(site, interactive, object)),
    ...UPCOMING.filter((g) => !built.has(g.type)).map(upcomingCard),
  ];
  return `<section class="interactive-hub band band--light" data-pagefind-ignore>
  <div class="container">
  <nav class="breadcrumb" aria-label="${esc(t("breadcrumb"))}">
    <ol class="breadcrumb__list">
      <li><a href="${esc(localizeHref(site.basePath))}">${esc(t("home"))}</a></li>
      <li><span aria-current="page">${esc(t("interactives"))}</span></li>
    </ol>
  </nav>
  <h1 class="interactive-hub__title">${esc(t("interactives"))}</h1>
  <p class="interactive-hub__intro">${esc(t("interactivesIntro"))}</p>
  <ul class="interactive-hub__grid">
    ${cards.join("\n    ")}
  </ul>
  </div>
</section>`;
}
