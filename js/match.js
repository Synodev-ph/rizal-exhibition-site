// Memory game: flip two cards at a time to find matching pairs. Each game
// draws a random set of images from the full list.

import { bindDialogs, bindShare, clearShareStatus, Confetti, formatTime } from "./game.js";

const FLIP_BACK_MS = 900;

function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

class MatchGame {
  constructor(root) {
    this.root = root;
    const $ = (sel) => root.querySelector(sel);
    const $$ = (sel) => [...root.querySelectorAll(sel)];
    this.board = $("[data-match-board]");
    this.statusEl = $("[data-puzzle-status]");
    this.foundEl = $("[data-match-found]");
    this.timeEls = $$("[data-puzzle-time]");
    this.movesEls = $$("[data-puzzle-moves]");
    this.pairsEl = $("[data-match-pairs]");
    this.dialog = $("[data-puzzle-dialog]");
    this.dialogTime = $("[data-dialog-time]");
    this.dialogMoves = $("[data-dialog-moves]");
    this.infoDialog = $("[data-puzzle-info-dialog]");
    this.confetti = new Confetti($("[data-puzzle-confetti]"), this.dialog);
    this.back = $("[data-match-back]")?.content;
    this.faces = [...($("[data-match-faces]")?.content.children ?? [])];

    this.msg = root.dataset;
    this.sizes = (root.dataset.sizes ?? "6").split(",").map(Number);
    this.sizeIndex = 0;
    this.pairs = this.sizes[0];
    this.cards = [];
    this.open = [];
    this.found = 0;
    this.moves = 0;
    this.seconds = 0;
    this.timer = null;
    this.flipBack = null;
    this.solved = false;

    this.bind($$);
    this.newGame();
  }

  bind($$) {
    for (const btn of $$("[data-puzzle-shuffle]")) {
      btn.addEventListener("click", () => this.newGame());
    }
    for (const btn of $$("[data-puzzle-size]")) {
      btn.addEventListener("click", () => {
        this.sizeIndex = (this.sizeIndex + 1) % this.sizes.length;
        this.pairs = this.sizes[this.sizeIndex];
        this.newGame();
      });
    }
    for (const btn of $$("[data-puzzle-info]")) {
      btn.addEventListener("click", () => this.infoDialog?.showModal?.());
    }
    bindDialogs([this.dialog, this.infoDialog]);
    this.dialog?.addEventListener("close", () => this.confetti.stop());
    this.root.querySelector("[data-puzzle-again]")?.addEventListener("click", () => this.newGame());
    bindShare(this.root, () => ({ time: formatTime(this.seconds), moves: this.moves }));
    this.board.addEventListener("keydown", (e) => this.onKey(e));
  }

  onKey(e) {
    const pos = this.cards.indexOf(document.activeElement);
    if (pos < 0) return;
    const cols = Number(getComputedStyle(this.board).getPropertyValue("--cols-now")) || this.cols;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols, ArrowDown: cols }[e.key];
    if (!step) return;
    e.preventDefault();
    this.cards[pos + step]?.focus();
  }

  newGame() {
    if (this.dialog?.open) this.dialog.close();
    window.clearTimeout(this.flipBack);
    this.stopTimer();
    this.open = [];
    this.found = 0;
    this.moves = 0;
    this.seconds = 0;
    this.solved = false;
    this.root.classList.remove("is-solved");
    this.statusEl.hidden = true;
    this.foundEl.textContent = "";
    clearShareStatus(this.root);

    const total = this.pairs * 2;
    this.cols = total <= 12 ? Math.ceil(total / 2) : Math.ceil(total / 3);
    const rows = Math.ceil(total / this.cols);
    this.board.style.setProperty("--cols", String(this.cols));
    this.board.style.setProperty("--cols-sm", String(total % 4 === 0 ? 4 : 3));
    this.root.style.setProperty("--match-ar", String((this.cols * 2) / (rows * 3)));

    const picks = shuffled(this.faces).slice(0, this.pairs);
    this.cards = shuffled([...picks, ...picks]).map((face, i) => this.makeCard(face, i));
    this.board.replaceChildren(...this.cards);
    this.updateStats();
  }

  makeCard(face, i) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-card";
    button.dataset.key = face.getAttribute("data-key") ?? "";
    button.dataset.index = String(i + 1);
    button.setAttribute("aria-label", this.cardLabel(i + 1));
    const inner = document.createElement("span");
    inner.className = "match-card__inner";
    const back = document.createElement("span");
    back.className = "match-card__back";
    if (this.back) back.append(this.back.cloneNode(true));
    const front = (face.cloneNode(true));
    inner.append(back, front);
    button.append(inner);
    button.addEventListener("click", () => this.flip(button));
    return button;
  }

  cardLabel(n) {
    return (this.msg.msgCard ?? "").replace("{n}", String(n));
  }

  flip(card) {
    if (this.solved || card.classList.contains("is-open")) return;
    if (this.open.length === 2) this.hideOpen();
    if (!this.timer) {
      this.timer = window.setInterval(() => {
        this.seconds += 1;
        this.updateStats();
      }, 1000);
    }

    const face = card.querySelector(".match-card__front");
    card.classList.add("is-open");
    card.setAttribute("aria-label", face?.getAttribute("data-title") ?? "");
    this.open.push(card);
    if (this.open.length < 2) return;

    this.moves += 1;
    const [a, b] = this.open;
    if (a.dataset.key === b.dataset.key) {
      for (const c of this.open) {
        c.classList.add("is-matched");
        c.setAttribute("aria-disabled", "true");
      }
      this.open = [];
      this.found += 1;
      this.announce(face);
      if (this.found === this.pairs) this.finish();
    } else {
      this.flipBack = window.setTimeout(() => this.hideOpen(), FLIP_BACK_MS);
    }
    this.updateStats();
  }

  hideOpen() {
    window.clearTimeout(this.flipBack);
    for (const c of this.open) {
      c.classList.remove("is-open");
      c.setAttribute("aria-label", this.cardLabel(Number(c.dataset.index)));
    }
    this.open = [];
  }

  announce(face) {
    const title = face?.getAttribute("data-title") ?? "";
    const [before, after = ""] = (this.msg.msgFound ?? "").split("{title}");
    const name = document.createElement("i");
    name.textContent = title;
    const lang = face?.getAttribute("data-lang");
    if (lang) name.lang = lang;
    this.foundEl.replaceChildren(before, name, after);
  }

  updateStats() {
    for (const el of this.timeEls) el.textContent = formatTime(this.seconds);
    for (const el of this.movesEls) el.textContent = String(this.moves);
    if (this.pairsEl) this.pairsEl.textContent = `${this.found}/${this.pairs}`;
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
    this.foundEl.textContent = "";
    this.statusEl.textContent = (this.msg.msgSolved ?? "")
      .replace("{moves}", String(this.moves))
      .replace("{time}", time);
    this.statusEl.hidden = false;
    if (this.dialogTime) this.dialogTime.textContent = time;
    if (this.dialogMoves) this.dialogMoves.textContent = String(this.moves);
    window.setTimeout(() => {
      if (!this.solved || typeof this.dialog?.showModal !== "function") return;
      this.dialog.showModal();
      this.confetti.start();
    }, 800);
  }
}

export function initMatch(root) {
  return new MatchGame(root);
}
