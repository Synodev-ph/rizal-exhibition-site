import { esc, seoTitle } from "./layout.js";
import { imageUrl, renderImage } from "./media.js";
import { icons } from "../icons.js";
import { localizeHref, pick, t } from "../i18n.js";
const GROUPS = [
    {
        id: "artist",
        href: "/interactivities/artist/",
        titleKey: "rizalAsArtist",
        blurbKey: "artistInteractivitiesIntro",
        image: {
            src: "sections/artist.webp",
            alt: "Pencil self-portrait of the young José Rizal on aged paper",
        },
        status: "live",
    },
    {
        id: "hero",
        titleKey: "rizalAsHero",
        blurbKey: "heroInteractivitiesIntro",
        image: {
            src: "sections/hero.webp",
            alt: "Bronze statues in a park depicting José Rizal amid figures from Philippine history",
        },
        status: "soon",
    },
    {
        id: "ethnographer",
        titleKey: "rizalAsEthnographer",
        blurbKey: "ethnographerInteractivitiesIntro",
        image: {
            src: "sections/ethnographer.webp",
            alt: "Philippine objects collected and documented by José Rizal",
        },
        status: "soon",
    },
    {
        id: "scholar",
        titleKey: "rizalAsScholar",
        blurbKey: "scholarInteractivitiesIntro",
        image: {
            src: "sections/scholar.webp",
            alt: "Portrait evoking Rizal's scholarly circle",
        },
        status: "soon",
    },
];
export function interactivitiesTitle(site) {
    return seoTitle(t("interactivities"), pick(site.siteTitle));
}
export function interactivitiesDescription() {
    return t("interactivitiesMetaDescription");
}
export function artistInteractivitiesTitle(site) {
    return seoTitle(t("rizalAsArtist"), pick(site.siteTitle));
}
export function artistInteractivitiesDescription() {
    return t("artistInteractivitiesIntro");
}
function renderGroupCard(site, group) {
    const media = renderImage({
        site,
        image: group.image,
        className: "activity-card__img",
        sizes: "(min-width: 48rem) 20rem, calc(100vw - 3rem)",
    });
    const title = esc(t(group.titleKey));
    const blurb = esc(t(group.blurbKey));
    const body = `<span class="activity-card__media">${media}</span>
      <span class="activity-card__body">
        <span class="activity-card__title">${title}</span>
        <span class="activity-card__text">${blurb}</span>`;
    if (group.status === "live") {
        return `<li class="activity-card activity-card--live">
    <a class="activity-card__link" href="${esc(localizeHref(group.href))}">
      ${body}
      <span class="activity-card__cta">${esc(t("exploreInteractivities"))} ${icons.arrow}</span>
    </a>
  </li>`;
    }
    return `<li class="activity-card activity-card--soon">
    ${body}
    <span class="activity-card__cta">${esc(t("comingSoon"))}</span>
  </li>`;
}
export function renderInteractivitiesHub({ site }) {
    const live = GROUPS.filter((g) => g.status === "live");
    const soon = GROUPS.filter((g) => g.status !== "live");
    const soonSection = soon.length
        ? `
    <h2 class="interactivities__heading">${esc(t("futureThemes"))}</h2>
    <ul class="activity-grid">
${soon.map((g) => renderGroupCard(site, g)).join("\n")}
    </ul>`
        : "";
    return `<section class="band band--dark page-hero interactivities-hub__hero">
  <div class="container page-hero__inner">
    <h1 class="page-hero__title">${esc(t("interactivities"))}</h1>
    <p class="page-hero__intro">${esc(t("interactivitiesIntro"))}</p>
  </div>
</section>
<div class="band band--light interactivities">
  <div class="container">
    <h2 class="interactivities__heading">${esc(t("exploreInteractivities"))}</h2>
    <ul class="activity-grid">
${live.map((g) => renderGroupCard(site, g)).join("\n")}
    </ul>${soonSection}
  </div>
</div>`;
}
export function renderArtistInteractivities() {
    return "";
}
export function renderInteractivitiesHome() {
    return "";
}
export function artistPuzzleTitle(site) {
    return seoTitle(t("artistPuzzleHeading"), pick(site.siteTitle));
}
export function artistPuzzleDescription() {
    return t("artistPuzzleMetaDescription");
}
export function renderArtistPuzzle({ site, object, scriptVersion }) {
    const image = object.images[0];
    const src = imageUrl(site, image.src);
    const subtitle = object.title?.en ?? "";
    const version = scriptVersion ? `?v=${encodeURIComponent(scriptVersion)}` : "";
    const scriptSrc = `${site.basePath}interactivities/artist/puzzle/la_venganza_de_la_madre/puzzle.js${version}`;
    const peek = renderImage({
        site,
        image: { src: image.src, alt: "" },
        className: "puzzle__peek-img",
        sizes: "(min-width: 60rem) 42rem, 100vw",
    });
    return `<section class="band band--dark puzzle" data-puzzle
    data-image="${esc(src)}"
    data-msg-tile="${esc(t("puzzleTileLabel"))}"
    data-msg-solved="${esc(t("puzzleSolved"))}"
    data-msg-show-numbers="${esc(t("puzzleShowNumbers"))}"
    data-msg-hide-numbers="${esc(t("puzzleHideNumbers"))}"
    data-msg-share-title="${esc(t("puzzleShareTitle"))}"
    data-msg-share-text="${esc(t("puzzleShareText"))}"
    data-msg-share-saved="${esc(t("puzzleShareSaved"))}"
    data-msg-share-copied="${esc(t("puzzleShareCopied"))}"
    data-msg-share-failed="${esc(t("puzzleShareFailed"))}">
  <div class="container">
    <div class="puzzle__layout">
      <div class="puzzle__stage">
        <div class="puzzle__heading">
          <h1 class="puzzle__title">${esc(t("artistPuzzleHeading"))}</h1>
          <p class="puzzle__subtitle">${esc(subtitle)}</p>
        </div>
        <div class="puzzle__frame">
          <div class="puzzle__board" data-puzzle-board role="group" aria-label="${esc(t("artistPuzzleHeading"))}">
            <p class="puzzle__loading">${esc(t("puzzleLoading"))}</p>
          </div>
          <div class="puzzle__peek" data-puzzle-peek aria-hidden="true">${peek}</div>
        </div>
        <div class="puzzle__actions">
          <button class="puzzle__action" type="button" data-puzzle-peek-btn aria-label="${esc(t("puzzleHoldToPeek"))}">${icons.eye}</button>
          <button class="puzzle__action" type="button" data-puzzle-numbers aria-pressed="false" aria-label="${esc(t("puzzleShowNumbers"))}">${icons.hash}</button>
          <button class="puzzle__action" type="button" data-puzzle-shuffle aria-label="${esc(t("puzzleShuffle"))}">${icons.shuffle}</button>
          <button class="puzzle__action" type="button" data-puzzle-size-btn aria-label="${esc(t("puzzleChangeSize"))}">${icons.grid}</button>
          <a class="puzzle__action" href="${esc(localizeHref("/interactivities/artist/"))}" aria-label="${esc(t("puzzleChooseAnother"))}">${icons.list}</a>
          <button class="puzzle__action" type="button" data-puzzle-info aria-label="${esc(t("puzzleHowToPlay"))}">${icons.info}</button>
        </div>
      </div>
      <div class="puzzle__panel">
        <h1 class="puzzle__title">${esc(t("artistPuzzleHeading"))}</h1>
        <p class="puzzle__subtitle">${esc(subtitle)}</p>
        <dl class="puzzle__stats">
          <div class="puzzle__stat"><dt>${esc(t("puzzleTime"))}</dt><dd data-puzzle-time>0:00</dd></div>
          <div class="puzzle__stat"><dt>${esc(t("puzzleMoves"))}</dt><dd data-puzzle-moves>0</dd></div>
          <div class="puzzle__stat"><dt>${esc(t("puzzleTiles"))}</dt><dd data-puzzle-tiles>3×3</dd></div>
        </dl>
        <p class="puzzle__instructions">${esc(t("puzzleInstructions"))}</p>
        <div class="puzzle__controls">
          <button class="puzzle__control" type="button" data-puzzle-peek-btn>${esc(t("puzzleHoldToPeek"))}</button>
          <button class="puzzle__control" type="button" data-puzzle-numbers aria-pressed="false">${esc(t("puzzleShowNumbers"))}</button>
          <button class="puzzle__control" type="button" data-puzzle-shuffle>${esc(t("puzzleShuffle"))}</button>
          <button class="puzzle__control" type="button" data-puzzle-size-btn>${esc(t("puzzleChangeSize"))}</button>
          <a class="puzzle__control" href="${esc(localizeHref("/interactivities/artist/"))}">${esc(t("puzzleChooseAnother"))}</a>
        </div>
        <div class="puzzle__share">
          <span class="puzzle__share-label">${esc(t("puzzleShare"))}</span>
          <button class="puzzle__icon-btn" type="button" data-puzzle-share-link="facebook" aria-label="${esc(t("puzzleShareFacebook"))}">${icons.facebook}</button>
          <button class="puzzle__icon-btn" type="button" data-puzzle-share-link="x" aria-label="${esc(t("puzzleShareX"))}">${icons.x}</button>
          <button class="puzzle__icon-btn" type="button" data-puzzle-share-link="instagram" aria-label="${esc(t("puzzleShareInstagram"))}">${icons.instagram}</button>
        </div>
        <p class="puzzle__share-status" data-puzzle-share-status role="status" aria-live="polite"></p>
        <p class="puzzle__status" data-puzzle-status role="status" aria-live="polite" hidden></p>
      </div>
    </div>
  </div>
  <dialog class="puzzle-dialog" data-puzzle-dialog aria-labelledby="puzzle-solved-title">
    <canvas class="puzzle-confetti" data-puzzle-confetti aria-hidden="true"></canvas>
    <div class="puzzle-dialog__panel">
      <p class="puzzle-dialog__kicker">${esc(t("puzzleCongrats"))}</p>
      <h2 class="puzzle-dialog__title" id="puzzle-solved-title">${esc(t("puzzleSolvedTitle"))}</h2>
      <p class="puzzle-dialog__text">${esc(t("puzzleSolvedText"))}</p>
      <dl class="puzzle-dialog__stats">
        <div class="puzzle-dialog__stat"><dt>${esc(t("puzzleTime"))}</dt><dd data-dialog-time>0:00</dd></div>
        <div class="puzzle-dialog__stat"><dt>${esc(t("puzzleMoves"))}</dt><dd data-dialog-moves>0</dd></div>
      </dl>
      <div class="puzzle-dialog__actions">
        <div class="puzzle__share">
          <span class="puzzle__share-label">${esc(t("puzzleShare"))}</span>
          <button class="puzzle__icon-btn puzzle__icon-btn--primary" type="button" data-puzzle-share="facebook" aria-label="${esc(t("puzzleShareFacebook"))}">${icons.facebook}</button>
          <button class="puzzle__icon-btn puzzle__icon-btn--primary" type="button" data-puzzle-share="x" aria-label="${esc(t("puzzleShareX"))}">${icons.x}</button>
          <button class="puzzle__icon-btn puzzle__icon-btn--primary" type="button" data-puzzle-share="instagram" aria-label="${esc(t("puzzleShareInstagram"))}">${icons.instagram}</button>
        </div>
        <p class="puzzle-dialog__status" data-dialog-share-status role="status" aria-live="polite"></p>
        <div class="puzzle-dialog__buttons">
          <button class="puzzle__control" type="button" data-puzzle-again>${esc(t("puzzlePlayAgain"))}</button>
          <button class="puzzle__control" type="button" data-puzzle-close>${esc(t("puzzleClose"))}</button>
        </div>
      </div>
    </div>
  </dialog>
  <dialog class="puzzle-info" data-puzzle-info-dialog aria-labelledby="puzzle-info-title">
    <div class="puzzle-info__panel">
      <h2 class="puzzle-info__title" id="puzzle-info-title">${esc(t("puzzleHowToPlay"))}</h2>
      <p class="puzzle-info__text">${esc(t("puzzleInstructions"))}</p>
      <div class="puzzle-info__actions">
        <button class="puzzle__control" type="button" data-puzzle-info-close>${esc(t("puzzleClose"))}</button>
      </div>
    </div>
  </dialog>
  <script type="module" src="${esc(scriptSrc)}"></script>
</section>`;
}
