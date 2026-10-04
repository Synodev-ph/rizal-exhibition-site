// Hero video only autoplays when reduced motion is off
const heroVideo = document.querySelector(".hero__video");
if (heroVideo instanceof HTMLVideoElement &&
    window.matchMedia("(prefers-reduced-motion: no-preference)").matches) {
  heroVideo.play().catch(() => {});
}


// Animate the signature once it scrolls into view
const signatureWrap = document.querySelector(".pullquote__signature");
const signatureAnim = signatureWrap?.querySelector(".pullquote__signature-anim");
if (
  signatureWrap &&
  signatureAnim instanceof HTMLImageElement &&
  "IntersectionObserver" in window &&
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches
) {
  const animSrc = signatureAnim.getAttribute("data-anim-src");
  const signatureSvg = signatureWrap.querySelector("svg");
  if (animSrc) {
    const observer = new IntersectionObserver(
      (entries, obs) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          signatureAnim.src = animSrc;
          signatureAnim.hidden = false;
          signatureSvg?.setAttribute("hidden", "");
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(signatureWrap);
  }
}


// Mobile nav
const nav = document.querySelector(".site-nav");
if (nav) {
  const menuToggle = nav.querySelector(".site-nav__toggle");
  const dropdownToggles = [...nav.querySelectorAll(".nav-dropdown__toggle")];

  const closeDropdowns = () => {
    for (const t of dropdownToggles) t.setAttribute("aria-expanded", "false");
  };

  menuToggle?.addEventListener("click", () => {
    const open = menuToggle.getAttribute("aria-expanded") === "true";
    menuToggle.setAttribute("aria-expanded", String(!open));
    if (open) closeDropdowns();
  });

  for (const toggle of dropdownToggles) {
    toggle.addEventListener("click", () => {
      const open = toggle.getAttribute("aria-expanded") === "true";
      closeDropdowns();
      toggle.setAttribute("aria-expanded", String(!open));
    });
  }

  nav.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = dropdownToggles.find((t) => t.getAttribute("aria-expanded") === "true");
    if (open) {
      open.setAttribute("aria-expanded", "false");
      open.focus();
    }
  });

  document.addEventListener("click", (event) => {
    if (!nav.contains( (event.target))) closeDropdowns();
  });
}


// Scroll reveals
const revealTargets = document.querySelectorAll(
  ".section-body .collection-card, .section-body .essay-card",
);
if (
  revealTargets.length &&
  "IntersectionObserver" in window &&
  window.matchMedia("(prefers-reduced-motion: no-preference)").matches
) {
  document.documentElement.classList.add("reveal-ready");
  const observer = new IntersectionObserver(
    (entries, obs) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          obs.unobserve(entry.target);
        }
      }
    },
    { rootMargin: "0px", threshold: 0.1 },
  );
  for (const el of revealTargets) observer.observe(el);
}


// Section tabs
const tabBar = document.querySelector(".section-tabs");
const sectionPanels = document.querySelectorAll(".section-panel");
if (tabBar && sectionPanels.length) {
  const tabLinks = [...tabBar.querySelectorAll(".section-tabs__link")];
  const panelIds = [...sectionPanels].map((p) => p.id);

  const activatePanel = (id) => {
    const target = panelIds.includes(id) ? id : panelIds[0];
    for (const panel of sectionPanels) panel.hidden = panel.id !== target;
    for (const link of tabLinks) {
      if (link.getAttribute("href") === `#${target}`) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    }
  };

  activatePanel(location.hash.slice(1));
  window.addEventListener("hashchange", () => activatePanel(location.hash.slice(1)));
}

for (const button of document.querySelectorAll(".message-card__play")) {
  button.addEventListener("click", () => {
    const src = button.getAttribute("data-video");
    const media = button.closest(".message-card__media");
    if (!src || !media) return;
    const video = document.createElement("video");
    video.className = "message-card__video";
    video.controls = true;
    video.autoplay = true;
    video.playsInline = true;
    const source = document.createElement("source");
    source.src = src;
    source.type = "video/mp4";
    video.append(source);
    media.replaceChildren(video);
    video.focus();
    video.play?.().catch(() => {});
  });
}


// Video modal
let videoDialog;
let videoDialogEl;
let videoDialogHistoryPushed = false;

function buildVideoDialog() {
  if (videoDialog) return;
  videoDialog = document.createElement("dialog");
  videoDialog.className = "video-dialog";
  videoDialog.setAttribute("aria-label", "Watch the video");
  videoDialog.innerHTML = `
    <button class="video-dialog__close" type="button">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6 18 18M18 6 6 18"/></svg>
      <span class="visually-hidden">Close video</span>
    </button>
    <video class="video-dialog__video" controls playsinline></video>`;
  document.body.append(videoDialog);
  videoDialogEl = videoDialog.querySelector(".video-dialog__video");

  videoDialog.addEventListener("click", (event) => {
    if (event.target.closest(".video-dialog__close")) closeVideoDialog();
    else if (event.target === videoDialog) closeVideoDialog();
  });
  videoDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeVideoDialog();
  });
}

function openVideoDialog(src) {
  if (!src) return;
  buildVideoDialog();
  videoDialogEl.src = src;
  videoDialog.showModal();
  videoDialogEl.play().catch(() => {});
  history.pushState({ video: true }, "", "#watch");
  videoDialogHistoryPushed = true;
}

function closeVideoDialog() {
  if (videoDialog?.open) videoDialog.close();
  videoDialogEl?.pause();
  if (videoDialogEl) {
    videoDialogEl.removeAttribute("src");
    videoDialogEl.load();
  }
  if (videoDialogHistoryPushed) {
    videoDialogHistoryPushed = false;
    history.back();
  } else if (location.hash === "#watch") {
    history.replaceState(null, "", location.pathname + location.search);
  }
}

window.addEventListener("popstate", () => {
  if (videoDialog?.open) {
    videoDialogHistoryPushed = false;
    closeVideoDialog();
  }
});

const heroVideoCta = document.querySelector(".hero-btn[data-video]");
heroVideoCta?.addEventListener("click", (event) => {
  event.preventDefault();
  openVideoDialog(heroVideoCta.getAttribute("data-video"));
});


// Object gallery + viewer
const gallery = document.querySelector(".object-gallery[data-viewer]");
if (gallery) {
  const slides = [...gallery.querySelectorAll(".object-gallery__slide")];
  const thumbs = [...gallery.querySelectorAll(".object-gallery__thumb")];
  const caption = gallery.querySelector("[data-gallery-credit]");
  const zoomBtn = gallery.querySelector("[data-viewer-zoom]");
  let current = 0;

  const setActive = (i) => {
    current = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((slide, n) => (slide.hidden = n !== current));
    thumbs.forEach((thumb, n) => {
      if (n === current) thumb.setAttribute("aria-current", "true");
      else thumb.removeAttribute("aria-current");
    });
    if (caption) {
      const credit = slides[current]?.getAttribute("data-credit");
      caption.textContent = credit || "";
      caption.hidden = !credit;
    }
  };

  for (const thumb of thumbs) {
    thumb.addEventListener("click", (event) => {
      event.preventDefault();
      setActive(Number(thumb.getAttribute("data-slide")) || 0);
    });
  }

  let viewerModule;
  const loadViewer = () => (viewerModule ??= import("./viewer.js"));

  let modelViewerModule;
  const loadModelViewer = () =>
    (modelViewerModule ??= import(
      new URL("../vendor/model-viewer/model-viewer.min.js", import.meta.url).href
    ));

  const modelMount = gallery.querySelector(".object-gallery__model");
  if (modelMount) {
    const launch = modelMount.querySelector(".object-gallery__model-launch");
    const posterPic = modelMount.querySelector("picture");
    const progress = modelMount.querySelector("[data-model-progress]");
    const percent = modelMount.querySelector("[data-model-percent]");
    const bar = modelMount.querySelector("[data-model-bar]");
    const prompt = modelMount.querySelector("[data-model-prompt]");
    let started = false;

    const promptItems = prompt ? [...prompt.querySelectorAll("[data-prompt]")] : [];
    let hinted = false;
    const showDragPrompt = (mv) => {
      if (!prompt || !promptItems.length || hinted) return;
      hinted = true;
      const showItem = (i) => promptItems.forEach((el, n) => el.classList.toggle("is-active", n === i));
      const timers = [];
      let dismissed = false;
      const dismiss = () => {
        if (dismissed) return;
        dismissed = true;
        timers.forEach(clearTimeout);
        prompt.classList.remove("is-visible");
        setTimeout(() => (prompt.hidden = true), 300);
      };
      prompt.hidden = false;
      showItem(0);
      requestAnimationFrame(() => prompt.classList.add("is-visible"));
      timers.push(setTimeout(() => showItem(1), 1500));
      timers.push(setTimeout(dismiss, 3000));
      mv.addEventListener("pointerdown", dismiss, { once: true });
    };

    const activateModel = () => {
      if (started) return;
      started = true;
      launch?.setAttribute("hidden", "");
      posterPic?.setAttribute("hidden", "");
      if (progress) progress.hidden = false;
      loadModelViewer()
        .then((mod) => {
          mod.ModelViewerElement.meshoptDecoderLocation = new URL(
            "../vendor/model-viewer/meshopt_decoder.js",
            import.meta.url,
          ).href;
          const mv = document.createElement("model-viewer");
          mv.className = "object-gallery__model-viewer";
          mv.setAttribute("src", modelMount.getAttribute("data-model") || "");
          mv.setAttribute("alt", modelMount.getAttribute("data-model-alt") || "");
          const poster = modelMount.getAttribute("data-model-poster");
          if (poster) mv.setAttribute("poster", poster);
          mv.setAttribute("camera-controls", "");
          mv.setAttribute("touch-action", "pan-y");
          mv.setAttribute("interaction-prompt", "none");
          mv.setAttribute("camera-orbit", "20deg 70deg auto");
          mv.setAttribute("shadow-intensity", "1");
          mv.setAttribute("shadow-softness", "0.9");
          mv.setAttribute("exposure", "1.05");
          mv.setAttribute("ar", "");
          mv.setAttribute("ar-modes", "webxr scene-viewer quick-look");
          mv.addEventListener("progress", (event) => {
            const total =  (event).detail?.totalProgress ?? 0;
            const pct = Math.round(total * 100);
            if (percent) percent.textContent = `${pct}%`;
            if (bar) bar.style.width = `${pct}%`;
          });
          mv.addEventListener("load", () => {
            if (bar) bar.style.width = "100%";
            if (percent) percent.textContent = "100%";
            if (progress) progress.hidden = true;
            showDragPrompt(mv);
          });
          modelMount.append(mv);
          mv.focus?.();
        })
        .catch(() => {
          started = false;
          launch?.removeAttribute("hidden");
          posterPic?.removeAttribute("hidden");
          if (progress) progress.hidden = true;
        });
    };

    launch?.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      activateModel();
    });
    launch?.addEventListener("pointerenter", loadModelViewer, { once: true });
  }

  const fullscreenAllowed = () => window.matchMedia("(min-width: 52rem)").matches;

  const openViewer = () =>
    fullscreenAllowed()
      ? loadViewer().then((m) => m.open(gallery, current, { onChange: setActive }))
      : Promise.resolve();
  const warmViewer = () => {
    if (fullscreenAllowed()) loadViewer();
  };
  zoomBtn?.addEventListener("click", openViewer);
  const stage = gallery.querySelector(".object-gallery__slides");
  stage?.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".object-gallery__slide--model")) {
      return;
    }
    openViewer();
  });
  zoomBtn?.addEventListener("pointerenter", warmViewer, { once: true });
  stage?.addEventListener("pointerenter", warmViewer, { once: true });

  const deep = location.hash.match(/^#view=(\d+)$/);
  if (deep) {
    const i = Math.max(0, Number(deep[1]) - 1);
    setActive(i);
    if (fullscreenAllowed()) {
      loadViewer().then((m) => m.open(gallery, i, { deepLink: true, onChange: setActive }));
    }
  }
}


// Search (Pagefind UI is loaded on first open)
let pagefindReady;
function ensurePagefind() {
  if (pagefindReady) return pagefindReady;
  const base = new URL("../pagefind/", import.meta.url);
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("pagefind-ui.css", base).href;
  document.head.append(css);
  pagefindReady = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("pagefind-ui.js", base).href;
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", reject);
    document.head.append(script);
  });
  return pagefindReady;
}

function mountPagefind(selector) {
  return ensurePagefind().then(() => {
    new  (window).PagefindUI({
      element: selector,
      showImages: false,
      showSubResults: true,
      translations: { placeholder: "Search the exhibition" },
    });
    document
      .querySelector(`${selector} .pagefind-ui__search-input`)
      ?.setAttribute("aria-label", "Search the exhibition");
  });
}

if (document.getElementById("search")) mountPagefind("#search");

const searchToggle = document.querySelector(".site-nav__search");
const searchPanel = document.getElementById("site-search");
if (searchToggle instanceof HTMLElement && searchPanel) {
  const closeBtn = searchPanel.querySelector(".site-search__close");
  const focusInput = () =>
     (
      searchPanel.querySelector(".pagefind-ui__search-input")
    )?.focus();
  let mounted = false;

  searchToggle.setAttribute("aria-controls", "site-search");
  searchToggle.setAttribute("aria-expanded", "false");

  const open = () => {
    searchPanel.hidden = false;
    searchToggle.setAttribute("aria-expanded", "true");
    if (mounted) focusInput();
    else {
      mounted = true;
      mountPagefind("#site-search-ui").then(focusInput);
    }
  };
  const close = ({ returnFocus = true } = {}) => {
    searchPanel.hidden = true;
    searchToggle.setAttribute("aria-expanded", "false");
    if (returnFocus) searchToggle.focus();
  };

  searchToggle.addEventListener("click", (event) => {
    event.preventDefault();
    if (searchPanel.hidden) open();
    else close();
  });
  closeBtn?.addEventListener("click", () => close());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !searchPanel.hidden) close();
  });
  document.addEventListener("click", (event) => {
    if (searchPanel.hidden) return;
    const target =  (event.target);
    if (!searchPanel.contains(target) && !searchToggle.contains(target)) {
      close({ returnFocus: false });
    }
  });
}

export {};
