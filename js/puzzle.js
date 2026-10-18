// Sliding puzzle. The empty square is cell 0; shuffling uses legal moves from
// the solved state, so the board is always solvable.

const formatTime = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

const isMobile = () =>
  navigator.userAgentData?.mobile ??
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

class SlidingPuzzle {
  constructor(root) {
    this.root = root;
    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => [...root.querySelectorAll(sel)];
    this.board = $("[data-puzzle-board]");
    this.statusEl = $("[data-puzzle-status]");
    this.timeEls = $$("[data-puzzle-time]");
    this.movesEls = $$("[data-puzzle-moves]");
    this.tilesEl = $("[data-puzzle-tiles]");
    this.dialog = $("[data-puzzle-dialog]");
    this.dialogTime = $("[data-dialog-time]");
    this.dialogMoves = $("[data-dialog-moves]");
    this.infoDialog = $("[data-puzzle-info-dialog]");
    this.confetti = $("[data-puzzle-confetti]");
    this.numbersButtons = $$("[data-puzzle-numbers]");

    this.image = root.dataset.image ?? "";
    this.msg = root.dataset;
    this.sizes = (root.dataset.sizes ?? "3").split(",").map(Number);
    this.sizeIndex = 0;
    this.size = this.sizes[0];
    this.state = [];
    this.initial = [];
    this.cells = [];
    this.moves = 0;
    this.seconds = 0;
    this.timer = null;
    this.started = false;
    this.solved = false;
    this.ready = false;
    this.showNumbers = false;
    this.confettiRaf = null;

    this.bind($$);
    this.load();
  }

  load() {
    const probe = new Image();
    probe.decoding = "async";
    probe.addEventListener("load", () => {
      this.ready = true;
      this.root.style.setProperty("--puzzle-ar", String(probe.naturalWidth / probe.naturalHeight));
      this.newGame();
    });
    probe.addEventListener("error", () => {
      const p = document.createElement("p");
      p.className = "puzzle__loading";
      p.textContent = this.msg.msgError ?? "";
      this.board.replaceChildren(p);
    });
    probe.src = this.image;
  }

  bind($$) {
    this.board.tabIndex = 0;
    document.addEventListener("keydown", (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
      if (document.querySelector("dialog[open]")) return;
      this.onKey(e);
    });

    for (const btn of $$("[data-puzzle-shuffle]")) {
      btn.addEventListener("click", () => this.ready && this.newGame());
    }
    for (const btn of $$("[data-puzzle-size]")) {
      btn.addEventListener("click", () => {
        if (!this.ready) return;
        this.sizeIndex = (this.sizeIndex + 1) % this.sizes.length;
        this.size = this.sizes[this.sizeIndex];
        this.newGame();
      });
    }
    for (const btn of this.numbersButtons) {
      btn.addEventListener("click", () => {
        this.showNumbers = !this.showNumbers;
        for (const b of this.numbersButtons) {
          b.setAttribute("aria-pressed", String(this.showNumbers));
          const label = b.querySelector(".puzzle__control-label");
          if (label) label.textContent = this.showNumbers ? this.msg.msgHideNumbers : this.msg.msgShowNumbers;
        }
        this.syncNumbers();
      });
    }

    const show = () => this.root.classList.add("is-peeking");
    const hide = () => this.root.classList.remove("is-peeking");
    for (const btn of $$("[data-puzzle-peek-btn]")) {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        show();
      });
      for (const name of ["pointerup", "pointerleave", "pointercancel", "blur"]) {
        btn.addEventListener(name, hide);
      }
      btn.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          show();
        }
      });
      btn.addEventListener("keyup", (e) => {
        if (e.key === " " || e.key === "Enter") hide();
      });
    }

    for (const btn of $$("[data-puzzle-info]")) {
      btn.addEventListener("click", () => this.infoDialog?.showModal());
    }
    for (const dialog of [this.dialog, this.infoDialog]) {
      if (!dialog) continue;
      dialog.addEventListener("click", (e) => {
        if (e.target === dialog || (e.target instanceof Element && e.target.closest("[data-dialog-close]"))) {
          dialog.close();
        }
      });
    }
    this.dialog?.addEventListener("close", () => this.stopConfetti());
    this.root.querySelector("[data-puzzle-again]")?.addEventListener("click", () => this.newGame());

    for (const btn of $$("[data-puzzle-share]")) {
      if (btn.dataset.puzzleShare === "instagram" && !isMobile()) btn.hidden = true;
      btn.addEventListener("click", () => this.share(btn));
    }
  }

  onKey(e) {
    if (this.solved || !this.ready) return;
    const n = this.size;
    const empty = this.state.indexOf(0);
    let row = Math.floor(empty / n);
    let col = empty % n;
    if (e.key === "ArrowUp") row += 1;
    else if (e.key === "ArrowDown") row -= 1;
    else if (e.key === "ArrowLeft") col += 1;
    else if (e.key === "ArrowRight") col -= 1;
    else return;
    if (row < 0 || row >= n || col < 0 || col >= n) return;
    e.preventDefault();
    this.slide(row * n + col, true);
  }

  newGame() {
    const count = this.size * this.size;
    this.state = Array.from({ length: count }, (_, i) => i);
    do this.shuffle();
    while (this.isSolved());
    this.initial = [...this.state];
    this.reset();
  }

  reset() {
    if (this.dialog?.open) this.dialog.close();
    this.state = [...this.initial];
    this.stopTimer();
    this.moves = 0;
    this.seconds = 0;
    this.started = false;
    this.solved = false;
    this.root.classList.remove("is-solved");
    this.statusEl.hidden = true;
    for (const el of this.root.querySelectorAll("[data-puzzle-share-status], [data-dialog-share-status]")) {
      el.textContent = "";
    }
    this.updateStats();
    this.render();
  }

  neighbors(pos) {
    const n = this.size;
    const row = Math.floor(pos / n);
    const col = pos % n;
    const out = [];
    if (row > 0) out.push(pos - n);
    if (row < n - 1) out.push(pos + n);
    if (col > 0) out.push(pos - 1);
    if (col < n - 1) out.push(pos + 1);
    return out;
  }

  shuffle() {
    let empty = this.state.indexOf(0);
    let previous = -1;
    for (let i = 0; i < this.size * this.size * 40; i += 1) {
      const options = this.neighbors(empty).filter((p) => p !== previous);
      const next = options[Math.floor(Math.random() * options.length)];
      this.state[empty] = this.state[next];
      this.state[next] = 0;
      previous = empty;
      empty = next;
    }
  }

  render() {
    const n = this.size;
    this.board.style.setProperty("--n", String(n));
    this.cells = this.state.map((tile, pos) => {
      if (tile === 0 && !this.solved) {
        const cell = document.createElement("div");
        cell.className = "puzzle__blank";
        return cell;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "puzzle__tile";
      const row = Math.floor(tile / n);
      const col = tile % n;
      button.style.backgroundImage = `url("${this.image}")`;
      button.style.backgroundSize = `${n * 100}% ${n * 100}%`;
      button.style.backgroundPosition = `${(col * 100) / (n - 1)}% ${(row * 100) / (n - 1)}%`;
      button.setAttribute("aria-label", (this.msg.msgTile ?? "").replace("{n}", String(tile)));
      if (this.solved) button.disabled = true;
      else button.addEventListener("click", () => this.slide(pos));
      return button;
    });
    this.board.replaceChildren(...this.cells);
    this.syncNumbers();
  }

  syncNumbers() {
    this.cells.forEach((cell, pos) => {
      if (!(cell instanceof HTMLButtonElement)) return;
      let badge = cell.querySelector(".puzzle__tile-num");
      if (this.showNumbers && !this.solved) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "puzzle__tile-num";
          badge.setAttribute("aria-hidden", "true");
          cell.append(badge);
        }
        badge.textContent = String(this.state[pos]);
      } else {
        badge?.remove();
      }
    });
  }

  slide(pos, viaKeyboard = false) {
    if (this.solved || !this.ready) return;
    const empty = this.state.indexOf(0);
    if (!this.neighbors(empty).includes(pos)) return;
    this.state[empty] = this.state[pos];
    this.state[pos] = 0;
    this.moves += 1;
    if (!this.started) {
      this.started = true;
      this.timer = window.setInterval(() => {
        this.seconds += 1;
        this.updateStats();
      }, 1000);
    }
    if (this.isSolved()) this.finish();
    this.updateStats();
    this.render();
    if (viaKeyboard) this.board.focus();
  }

  isSolved() {
    return this.state.every((tile, i) => tile === i);
  }

  updateStats() {
    for (const el of this.timeEls) el.textContent = formatTime(this.seconds);
    for (const el of this.movesEls) el.textContent = String(this.moves);
    if (this.tilesEl) this.tilesEl.textContent = `${this.size}×${this.size}`;
  }

  stopTimer() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
  }

  finish() {
    this.solved = true;
    this.stopTimer();
    this.root.classList.add("is-solved");
    const time = formatTime(this.seconds);
    this.statusEl.textContent = (this.msg.msgSolved ?? "")
      .replace("{moves}", String(this.moves))
      .replace("{time}", time);
    this.statusEl.hidden = false;
    if (this.dialogTime) this.dialogTime.textContent = time;
    if (this.dialogMoves) this.dialogMoves.textContent = String(this.moves);
    window.setTimeout(() => {
      if (!this.solved || !this.dialog) return;
      this.dialog.showModal();
      this.startConfetti();
    }, 600);
  }

  shareUrl() {
    return document.querySelector('link[rel="canonical"]')?.href ?? window.location.href;
  }

  share(btn) {
    const url = this.shareUrl();
    const text = (this.msg.msgShareText ?? "")
      .replace("{time}", formatTime(this.seconds))
      .replace("{moves}", String(this.moves));
    const popup = "noopener,noreferrer,width=640,height=640";
    const platform = btn.dataset.puzzleShare;
    if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", popup);
    } else if (platform === "x") {
      window.open(
        `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
        "_blank",
        popup,
      );
    } else if (typeof navigator.share === "function") {
      navigator.share({ title: this.msg.msgShareTitle, text, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
      const status = btn.closest("dialog")
        ? this.root.querySelector("[data-dialog-share-status]")
        : this.root.querySelector("[data-puzzle-share-status]");
      if (status) status.textContent = this.msg.msgShareCopied ?? "";
    }
  }

  startConfetti() {
    const canvas = this.confetti;
    if (!canvas || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    this.stopConfetti();
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
    const card = this.dialog.querySelector(".puzzle-dialog__card")?.getBoundingClientRect();
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
      this.confettiRaf = alive ? window.requestAnimationFrame(draw) : null;
    };
    this.confettiRaf = window.requestAnimationFrame(draw);
  }

  stopConfetti() {
    if (this.confettiRaf) window.cancelAnimationFrame(this.confettiRaf);
    this.confettiRaf = null;
    this.confetti?.getContext("2d")?.clearRect(0, 0, this.confetti.width, this.confetti.height);
  }
}

export function initPuzzle(root) {
  return new SlidingPuzzle(root);
}
