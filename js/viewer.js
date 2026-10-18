const OSD_SRC = new URL(
  "../vendor/openseadragon/openseadragon.min.js",
  import.meta.url,
).href;

const svg = (paths, extra = "") =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${paths}</svg>`;
const ICON = {
  close: svg('<path d="M6 6 18 18M18 6 6 18"/>'),
  zoomIn: svg('<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6M10 7v6M7 10h6"/>'),
  zoomOut: svg('<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6M7 10h6"/>'),
  prev: svg('<path d="m15 6-6 6 6 6"/>'),
  next: svg('<path d="m9 6 6 6-6 6"/>'),
};

// Resolved relative to this module (dist/assets → ../vendor/).
let modelViewerPromise;
function loadModelViewer() {
  return (modelViewerPromise ??= import(
    new URL("../vendor/model-viewer/model-viewer.min.js", import.meta.url).href
  ).then((mod) => {
    mod.ModelViewerElement.meshoptDecoderLocation = new URL(
      "../vendor/model-viewer/meshopt_decoder.js",
      import.meta.url,
    ).href;
    return mod;
  }));
}

let osdPromise;
function loadOpenSeadragon() {
  if (window.OpenSeadragon) return Promise.resolve(window.OpenSeadragon);
  osdPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = OSD_SRC;
    s.addEventListener("load", () => resolve(window.OpenSeadragon));
    s.addEventListener("error", () => reject(new Error("OpenSeadragon failed to load")));
    document.head.append(s);
  });
  return osdPromise;
}

function tileSource(img) {
  if (img.dz) {
    // Inline DZI descriptor, so no .dzi XML is fetched.
    return {
      Image: {
        xmlns: "http://schemas.microsoft.com/deepzoom/2008",
        Url: img.dz.url,
        Format: img.dz.format,
        Overlap: String(img.dz.overlap),
        TileSize: String(img.dz.tileSize),
        Size: { Width: img.dz.width, Height: img.dz.height },
      },
    };
  }
  return { type: "image", url: img.full };
}

let dialog;
let osd;
let osdEl;
let modelEl;
let modelViewer;
let zoombarEl;
let stripEl;
let creditEl;
let navPrev;
let navNext;
let images = [];
let index = 0;
let historyPushed = false;
let onChange = null;

function buildDialog() {
  if (dialog) return;
  dialog = document.createElement("dialog");
  dialog.className = "viewer";
  dialog.setAttribute("aria-label", "Image viewer");
  dialog.innerHTML = `
    <div class="viewer__stage">
      <div class="viewer__osd"></div>
      <div class="viewer__model" hidden></div>
      <div class="viewer__zoombar">
        <button class="viewer__btn" type="button" data-act="zoom-in">${ICON.zoomIn}<span class="visually-hidden">Zoom in</span></button>
        <button class="viewer__btn" type="button" data-act="zoom-out">${ICON.zoomOut}<span class="visually-hidden">Zoom out</span></button>
      </div>
      <button class="viewer__btn viewer__close" type="button" data-act="close">${ICON.close}<span class="visually-hidden">Close viewer</span></button>
      <button class="viewer__btn viewer__nav viewer__nav--prev" type="button" data-act="prev">${ICON.prev}<span class="visually-hidden">Previous image</span></button>
      <button class="viewer__btn viewer__nav viewer__nav--next" type="button" data-act="next">${ICON.next}<span class="visually-hidden">Next image</span></button>
    </div>
    <div class="viewer__footer">
      <p class="viewer__credit"></p>
      <ul class="viewer__strip"></ul>
    </div>`;
  document.body.append(dialog);

  osdEl = dialog.querySelector(".viewer__osd");
  modelEl = dialog.querySelector(".viewer__model");
  zoombarEl = dialog.querySelector(".viewer__zoombar");
  stripEl = dialog.querySelector(".viewer__strip");
  creditEl = dialog.querySelector(".viewer__credit");
  navPrev = dialog.querySelector(".viewer__nav--prev");
  navNext = dialog.querySelector(".viewer__nav--next");

  dialog.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-act]");
    if (btn) {
      const act = btn.getAttribute("data-act");
      if (act === "close") closeViewer();
      else if (act === "prev") setImage(index - 1);
      else if (act === "next") setImage(index + 1);
      else if (act === "zoom-in") zoom(1.6);
      else if (act === "zoom-out") zoom(1 / 1.6);
      return;
    }
    const thumb = event.target.closest("[data-idx]");
    if (thumb) setImage(Number(thumb.getAttribute("data-idx")));
    else if (event.target === dialog) closeViewer();
  });

  // Route Esc through closeViewer so the history entry is unwound.
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeViewer();
  });
}

function zoom(by) {
  if (!osd) return;
  osd.viewport.zoomBy(by);
  osd.viewport.applyConstraints();
}

async function ensureOSD() {
  if (osd) return;
  const OpenSeadragon = await loadOpenSeadragon();
  osd = OpenSeadragon({
    element: osdEl,
    prefixUrl: "",
    showNavigationControl: false,
    showNavigator: true,
    navigatorPosition: "ABSOLUTE",
    navigatorTop: "58px",
    navigatorRight: "12px",
    navigatorHeight: "104px",
    navigatorWidth: "148px",
    navigatorAutoFade: false,
    navigatorBackground: "#1a1a1a",
    tileSources: [],
    maxZoomPixelRatio: 2,
    visibilityRatio: 1,
    constrainDuringPan: true,
    animationTime: 0.4,
    gestureSettingsMouse: { clickToZoom: false, dblClickToZoom: true },
  });
  osd.addHandler("open", () => dialog.classList.remove("is-loading"));
}

function renderStrip() {
  stripEl.innerHTML = images
    .map(
      (img, i) =>
        `<li><button class="viewer__thumb${img.model ? " viewer__thumb--model" : ""}" type="button" data-idx="${i}"${
          i === index ? ' aria-current="true"' : ""
        }>${img.model ? '<span class="viewer__thumb-badge" aria-hidden="true">3D</span>' : ""}<img src="${img.thumb}" alt="${escapeHtml(img.alt)}" loading="lazy"></button></li>`,
    )
    .join("");
  const many = images.length > 1;
  stripEl.hidden = !many;
  navPrev.hidden = !many;
  navNext.hidden = !many;
}

function updateChrome() {
  const img = images[index];
  creditEl.textContent = img.credit || "";
  creditEl.hidden = !img.credit;
  for (const b of stripEl.querySelectorAll("[data-idx]")) {
    const on = Number(b.getAttribute("data-idx")) === index;
    if (on) b.setAttribute("aria-current", "true");
    else b.removeAttribute("aria-current");
  }
}

function syncHash({ push }) {
  const hash = `#view=${index + 1}`;
  const state = { viewer: true, i: index };
  if (push && !historyPushed) {
    history.pushState(state, "", hash);
    historyPushed = true;
  } else {
    history.replaceState(state, "", hash);
  }
}

function showModel(img) {
  osdEl.hidden = true;
  zoombarEl.hidden = true;
  modelEl.hidden = false;
  dialog.classList.remove("is-loading");
  loadModelViewer()
    .then(() => {
      if (!modelViewer) {
        modelViewer = document.createElement("model-viewer");
        modelViewer.className = "viewer__model-viewer";
        modelViewer.setAttribute("camera-controls", "");
        modelViewer.setAttribute("touch-action", "pan-y");
        modelViewer.setAttribute("interaction-prompt", "none");
        modelViewer.setAttribute("camera-orbit", "20deg 70deg auto");
        modelViewer.setAttribute("shadow-intensity", "1");
        modelViewer.setAttribute("shadow-softness", "0.9");
        modelViewer.setAttribute("exposure", "1.05");
        modelViewer.setAttribute("ar", "");
        modelViewer.setAttribute("ar-modes", "webxr scene-viewer quick-look");
        modelEl.append(modelViewer);
      }
      modelViewer.setAttribute("src", img.model);
      modelViewer.setAttribute("alt", img.alt);
      if (img.full) modelViewer.setAttribute("poster", img.full);
    })
    .catch(() => {
      modelEl.hidden = true;
      zoombarEl.hidden = false;
      osdEl.hidden = false;
      osd.open(tileSource(img));
    });
}

function setImage(i, opts = { push: false }) {
  index = ((i % images.length) + images.length) % images.length;
  const img = images[index];
  if (img.model) {
    showModel(img);
  } else {
    modelEl.hidden = true;
    zoombarEl.hidden = false;
    osdEl.hidden = false;
    dialog.classList.add("is-loading");
    osd.open(tileSource(img));
  }
  updateChrome();
  syncHash(opts);
  onChange?.(index);
}

export async function open(gallery, i, opts = {}) {
  const data = gallery.querySelector(".object-gallery__data");
  if (!data) return;
  images = JSON.parse(data.textContent);
  if (!images.length) return;
  onChange = opts.onChange ?? null;

  buildDialog();
  if (!dialog.open) dialog.showModal();
  renderStrip();
  await ensureOSD();

  if (opts.deepLink) {
    // The URL already carries #view=N; don't push another entry.
    historyPushed = false;
    setImage(i, { push: false });
  } else {
    setImage(i, { push: true });
  }
}

function closeViewer() {
  if (dialog?.open) dialog.close();
  if (historyPushed) {
    historyPushed = false;
    history.back();
  } else if (location.hash.startsWith("#view")) {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

window.addEventListener("popstate", () => {
  if (dialog?.open) {
    historyPushed = false;
    dialog.close();
  }
});

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
