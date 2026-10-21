export const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const isMobile = () =>
  navigator.userAgentData?.mobile ??
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

export function bindDialogs(dialogs) {
  for (const dialog of dialogs) {
    if (!dialog) continue;
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || (e.target instanceof Element && e.target.closest("[data-dialog-close]"))) {
        dialog.close();
      }
    });
  }
}

export function bindShare(root, getStats) {
  const msg = root.dataset;
  const copyLink = (url, btn) => {
    navigator.clipboard?.writeText(url).catch(() => {});
    const status = btn.closest("dialog")
      ? root.querySelector("[data-dialog-share-status]")
      : root.querySelector("[data-puzzle-share-status]");
    if (status) status.textContent = msg.msgShareCopied ?? "";
  };
  for (const btn of root.querySelectorAll("[data-puzzle-share]")) {
    if (!(btn instanceof HTMLElement)) continue;
    if (btn.dataset.puzzleShare === "instagram" && !isMobile()) btn.hidden = true;
    btn.addEventListener("click", () => {
      clearShareStatus(root);
      const url = document.querySelector('link[rel="canonical"]')?.href ?? window.location.href;
      const { time, moves, solved } = getStats();
      const text = (msg.msgShareText ?? "").replace("{time}", time).replace("{moves}", String(moves));
      const nativeShareData = solved ? { title: msg.msgShareTitle, text, url } : { url };
      const popup = "noopener,noreferrer,width=640,height=640";
      const platform = btn.dataset.puzzleShare;
      if (platform === "instagram" || (platform === "facebook" && isMobile())) {
        if (typeof navigator.share === "function") {
          navigator.share(nativeShareData).catch((err) => {
            if (err?.name !== "AbortError") copyLink(url, btn);
          });
        } else {
          copyLink(url, btn);
        }
      } else if (platform === "facebook") {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", popup);
      } else if (platform === "x") {
        window.open(
          `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}${solved ? `&text=${encodeURIComponent(text)}` : ""}`,
          "_blank",
          popup,
        );
      }
    });
  }
}

export function clearShareStatus(root) {
  for (const el of root.querySelectorAll("[data-puzzle-share-status], [data-dialog-share-status]")) {
    el.textContent = "";
  }
}

export class Confetti {
  constructor(canvas, dialog) {
    this.canvas = canvas;
    this.dialog = dialog;
    this.raf = null;
  }

  start() {
    const canvas = this.canvas;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.stop();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const styles = getComputedStyle(document.documentElement);
    const colors = ["--squash", "--ghost-white", "--black-cow", "--exhibit-frame-dark"].map((v) =>
      styles.getPropertyValue(v).trim(),
    );
    const card = this.dialog?.querySelector(".puzzle-dialog__card")?.getBoundingClientRect();
    const originY = card ? card.bottom : height * 0.6;
    const particles = [];
    for (const [x, dir] of [
      [card ? card.left : width * 0.3, -1],
      [card ? card.right : width * 0.7, 1],
    ]) {
      for (let i = 0; i < 120; i += 1) {
        const angle = -Math.PI / 2 + dir * Math.random() * 0.85;
        const speed = 10 + Math.random() * 10;
        particles.push({
          x,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.3,
          size: 6 + Math.random() * 6,
          color: colors[i % colors.length],
          life: 0,
          ttl: 120 + Math.random() * 60,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      let alive = 0;
      for (const p of particles) {
        p.vy += 0.35;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life += 1;
        const age = p.life / p.ttl;
        if (age >= 1 || p.y > height + 20) continue;
        alive += 1;
        ctx.globalAlpha = age > 0.7 ? (1 - age) / 0.3 : 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
      this.raf = alive ? window.requestAnimationFrame(draw) : null;
    };
    this.raf = window.requestAnimationFrame(draw);
  }

  stop() {
    if (this.raf) window.cancelAnimationFrame(this.raf);
    this.raf = null;
    this.canvas?.getContext("2d")?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
