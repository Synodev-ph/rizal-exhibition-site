import { esc, seoTitle } from "./layout.js";
import { imageUrl, renderImage } from "./media.js";
import { objectLead, renderPager } from "./fragments.js";
import { icons } from "../icons.js";
import { localizeHref, pick, t } from "../i18n.js";

export function hubInteractives(interactives, objectById) {
  const order = (i) => objectById.get(i.object ?? "")?.order ?? Infinity;
  return interactives.filter((i) => i.draft !== true).sort((a, b) => order(a) - order(b));
}

function pagerNames(objectById) {
  const lead = (i) => objectLead((objectById.get(i.object ?? "")));
  return {
    hrefFor: (i) => `/interactive/${i.id}/`,
    nameFor: (i) => (i.type === "match" ? t("interactiveMatchTitle") : lead(i).name),
    langFor: (i) => (i.type === "match" ? undefined : lead(i).lang),
  };
}

function pager({ prev, next, objectById }) {
  return renderPager({ prev, next, ...pagerNames(objectById), ariaLabel: t("browseInteractives") });
}

function panelNav({ prev, next, objectById }) {
  if (!prev && !next) return "";
  const { hrefFor, nameFor, langFor } = pagerNames(objectById);
  const link = (item, dir, label) => {
    if (!item) return "";
    const lang = langFor(item);
    const name = `<span class="visually-hidden">: <span${lang ? ` lang="${esc(lang)}"` : ""}>${esc(nameFor(item))}</span></span>`;
    const text = `<span class="puzzle__control-label">${esc(label)}${name}</span>`;
    const icon = icons[dir === "prev" ? "arrow-left" : "arrow-right"];
    return `<a class="puzzle-btn puzzle__control puzzle__nav-link--${dir}" href="${esc(localizeHref(hrefFor(item)))}" rel="${dir}">${dir === "prev" ? icon + text : text + icon}</a>`;
  };
  return `<nav class="puzzle__nav" aria-label="${esc(t("browseInteractives"))}">
        ${link(prev, "prev", t("previous"))}
        ${link(next, "next", t("next"))}
      </nav>`;
}

const oneStop = (text) => text.replaceAll("..", ".");

export function interactiveTitle({ site, interactive, objectById }) {
  const name = interactive.type === "match"
    ? t("interactiveMatchTitle")
    : objectLead((objectById.get(interactive.object ?? ""))).name;
  return seoTitle(name, pick(site.siteTitle));
}

export function interactiveDescription({ interactive, objectById }) {
  const seo = pick(interactive.seoDescription);
  if (seo) return seo;
  if (interactive.type === "match") return t("matchDescription");
  const object = (objectById.get(interactive.object ?? ""));
  const lead = objectLead(object);
  return oneStop(lead.lang
    ? t("puzzleDescription", { title: lead.name, subtitle: object.title.en })
    : t("puzzleDescriptionEn", { title: lead.name }));
}

function breadcrumb(site, current, langAttr = "") {
  return `<nav class="breadcrumb" aria-label="${esc(t("breadcrumb"))}">
    <ol class="breadcrumb__list">
      <li><a href="${esc(localizeHref(site.basePath))}">${esc(t("home"))}</a></li>
      <li><a href="${esc(localizeHref("/interactive/"))}">${esc(t("interactives"))}</a></li>
      <li><span aria-current="page"${langAttr}>${esc(current)}</span></li>
    </ol>
  </nav>`;
}

function msgAttrs(msgs) {
  return Object.entries(msgs)
    .map(([k, v]) => `data-msg-${k}="${esc(v)}"`)
    .join("\n    ");
}

function solvedDialog(kicker, title, text) {
  return `<dialog class="puzzle-dialog" data-puzzle-dialog aria-labelledby="puzzle-solved-title">
    <canvas class="puzzle-dialog__confetti" data-puzzle-confetti aria-hidden="true"></canvas>
    <div class="puzzle-dialog__card">
      <p class="puzzle-dialog__kicker">${esc(kicker)}</p>
      <h2 class="puzzle-dialog__title" id="puzzle-solved-title">${esc(title)}</h2>
      <p class="puzzle-dialog__text">${text}</p>
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
  </dialog>`;
}

function infoDialog(instructionsKey) {
  return `<dialog class="puzzle-dialog puzzle-dialog--info" data-puzzle-info-dialog aria-labelledby="puzzle-info-title">
    <div class="puzzle-dialog__card">
      <h2 class="puzzle-dialog__title" id="puzzle-info-title">${esc(t("puzzleHowTo"))}</h2>
      <p class="puzzle-dialog__text">${esc(t(instructionsKey))}</p>
      <div class="puzzle-dialog__actions">
        <button class="puzzle-btn" type="button" data-dialog-close>${esc(t("close"))}</button>
      </div>
    </div>
  </dialog>`;
}

function shareBlock() {
  return `<div class="puzzle__share">
        <span class="puzzle__share-label">${esc(t("puzzleShare"))}</span>
        <div class="puzzle__share-list">
          ${shareButtons("data-puzzle-share")}
        </div>
      </div>
      <p class="puzzle__note" data-puzzle-share-status role="status" aria-live="polite"></p>`;
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

function renderPuzzle(p) {
  const { site, interactive, objectById } = p;
  const object = (objectById.get(interactive.object ?? ""));
  const lead = objectLead(object);
  const title = lead.name;
  const langAttr = lead.lang ? ` lang="${lead.lang}"` : "";
  const shareName = title;
  const sizes = interactive.sizes ?? [3, 4, 5];
  const image = object.images.find((img) => img.src === interactive.image) ?? {
    src: interactive.image ?? "",
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
  return `<section class="puzzle band band--light" data-puzzle${interactive.draft ? " data-pagefind-ignore" : ""}
    data-image="${esc(imageUrl(site, image.src))}"
    data-sizes="${sizes.join(",")}"
    ${msgAttrs(msgs)}>
  <div class="container">
  ${breadcrumb(site, title, langAttr)}
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
      ${panelNav(p)}
      ${shareBlock()}
      <p class="puzzle__status" data-puzzle-status role="status" aria-live="polite" hidden></p>
    </div>
  </div>
  ${pager(p)}
  </div>
  ${solvedDialog(t("puzzleSolvedKicker"), t("puzzleSolvedTitle"), esc(oneStop(t("puzzleSolvedText", { title: shareName }))))}
  ${infoDialog("puzzleInstructions")}
</section>`;
}

function matchCards({ interactive, objectById }) {
  return (interactive.cards ?? []).map((card) => {
    const object = (objectById.get(card.object));
    const image = object.images.find((img) => img.src === card.image) ?? { src: card.image, alt: "" };
    return { object, image };
  });
}

function renderMatch(p) {
  const { site, interactive, sectionById } = p;
  const cards = matchCards(p);
  const sizes = interactive.sizes ?? [6];
  const title = t("interactiveMatchTitle");
  const sections = [...new Set(cards.map((c) => c.object.section))]
    .map((id) => sectionById.get(id))
    .filter((s) => s !== undefined)
    .map((s) => pick(s.title));
  const faces = cards
    .map(({ object, image }) => {
      const lead = objectLead(object);
      const media = renderImage({
        site,
        image: { ...image, alt: "" },
        className: "match-card__img",
        loading: "eager",
        sizes: "(min-width: 60rem) 10rem, 25vw",
      });
      return `<span class="match-card__front" data-key="${esc(object.id)}" data-title="${esc(lead.name)}"${lead.lang ? ` data-lang="${lead.lang}"` : ""}>${media}</span>`;
    })
    .join("\n    ");
  const mark = icons["museum-mark"].replace(/ class="[^"]*"/, "");

  const msgs = {
    card: t("matchCard"),
    found: t("matchFound"),
    solved: t("matchSolvedStatus"),
    "share-title": t("matchShareTitle"),
    "share-text": t("matchShareText"),
    "share-copied": t("puzzleShareCopied"),
  };
  return `<section class="puzzle match band band--light" data-match${interactive.draft ? " data-pagefind-ignore" : ""}
    data-sizes="${sizes.join(",")}"
    ${msgAttrs(msgs)}>
  <div class="container">
  ${breadcrumb(site, title)}
  <div class="puzzle__layout">
    <div class="puzzle__heading">
      <h1 class="puzzle__title">${esc(title)}</h1>
      <p class="puzzle__subtitle">${esc(sections.join(" & "))}</p>
    </div>
    <div class="puzzle__stage">
      <div class="puzzle__frame match__frame">
        <div class="match__board" data-match-board role="group" aria-label="${esc(t("matchBoard"))}"></div>
      </div>
    </div>
    <div class="puzzle__panel">
      <dl class="puzzle__stats">
          ${stats("puzzle")}
          <div class="puzzle__stat"><dt>${esc(t("matchPairs"))}</dt><dd data-match-pairs>0/${sizes[0]}</dd></div>
      </dl>
      <p class="puzzle__instructions">${esc(t("matchInstructions"))}</p>
      <div class="puzzle__controls">
        ${control("puzzleSize", "grid", "data-puzzle-size")}
        ${control("puzzleShuffle", "shuffle", "data-puzzle-shuffle")}
        ${control("puzzleHowTo", "info", "data-puzzle-info", " puzzle__control--info")}
      </div>
      ${panelNav(p)}
      ${shareBlock()}
      <p class="puzzle__note match__found" data-match-found role="status" aria-live="polite"></p>
      <p class="puzzle__status" data-puzzle-status role="status" aria-live="polite" hidden></p>
    </div>
  </div>
  ${pager(p)}
  </div>
  <template data-match-back>${mark}</template>
  <template data-match-faces>
    ${faces}
  </template>
  ${solvedDialog(t("puzzleSolvedKicker"), t("matchSolvedTitle"), esc(t("matchSolvedText")))}
  ${infoDialog("matchInstructions")}
</section>`;
}

export function renderInteractive(p) {
  switch (p.interactive.type) {
    case "puzzle":
      return renderPuzzle(p);
    case "match":
      return renderMatch(p);
    default:
      throw new Error(`Unknown interactive type "${p.interactive.type}"`);
  }
}

const TYPE_TEXT = {
  puzzle: { label: "interactiveTypePuzzle", title: "interactivePuzzleTitle", text: "interactivePuzzleText" },
  match: { label: "interactiveTypeMatch", title: "interactiveMatchTitle", text: "interactiveMatchText" },
};

export function interactiveHubTitle(site) {
  return seoTitle(t("interactives"), pick(site.siteTitle));
}

export function interactiveHubDescription() {
  return t("interactivesMetaDescription");
}

function hubCardContent(p) {
  const { site, interactive, objectById } = p;
  const text = TYPE_TEXT[interactive.type];
  if (interactive.type === "match") {
    const cards = matchCards(p);
    const step = Math.max(1, Math.floor(cards.length / 3));
    const media = [0, step, step * 2]
      .map((i) => cards[i])
      .filter(Boolean)
      .map(({ image }) =>
        renderImage({ site, image: { ...image, alt: "" }, className: "interactive-card__fan-img", sizes: "10rem" }),
      )
      .join("");
    return { media: `<span class="interactive-card__fan">${media}</span>`, subtitle: esc(t(text.text)) };
  }
  const object = (objectById.get(interactive.object ?? ""));
  const lead = objectLead(object);
  const langAttr = lead.lang ? ` lang="${lead.lang}"` : "";
  const [before, after = ""] = t(text.text).split("{title}");
  const tail = lead.name.endsWith(".") && after.startsWith(".") ? after.slice(1) : after;
  const image = object.images.find((img) => img.src === interactive.image) ?? { src: interactive.image ?? "", alt: "" };
  const media = renderImage({
    site,
    image: { ...image, alt: "" },
    className: "interactive-card__img",
    sizes: "(min-width: 60rem) 30vw, (min-width: 40rem) 45vw, 100vw",
  });
  return { media, subtitle: `${esc(before)}<i${langAttr}>${esc(lead.name)}</i>${esc(tail)}` };
}

function hubCard(p) {
  const { interactive } = p;
  const text = TYPE_TEXT[interactive.type];
  const { media, subtitle } = hubCardContent(p);
  return `<li class="interactive-card">
      <a class="interactive-card__link" href="${esc(localizeHref(`/interactive/${interactive.id}/`))}">
        <span class="interactive-card__frame">${media}</span>
        <span class="interactive-card__body">
          <span class="interactive-card__type">${esc(t(text.label))}</span>
          <span class="interactive-card__title">${esc(t(text.title))}</span>
          <span class="interactive-card__subtitle">${subtitle}</span>
          <span class="puzzle-btn interactive-card__cta" aria-hidden="true">${esc(t("interactivePlay"))}</span>
        </span>
      </a>
    </li>`;
}

export function renderInteractiveHub({ site, interactives, objectById, sectionById }) {
  const cards = hubInteractives(interactives, objectById).map((interactive) => hubCard({ site, interactive, objectById, sectionById }));
  return `<section class="interactive-hub band band--light">
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
