// Sliding puzzle.

import { bindDialogs, bindShare, clearShareStatus, Confetti, formatTime } from "./game.js";

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
    this.confetti = new Confetti($("[data-puzzle-confetti]"), this.dialog);
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
    bindDialogs([this.dialog, this.infoDialog]);
    this.dialog?.addEventListener("close", () => this.confetti.stop());
    this.root.querySelector("[data-puzzle-again]")?.addEventListener("click", () => this.newGame());

    bindShare(this.root, () => ({ time: formatTime(this.seconds), moves: this.moves, solved: this.solved }));
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
    clearShareStatus(this.root);
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
      this.confetti.start();
    }, 600);
  }
}

export function initPuzzle(root) {
  return new SlidingPuzzle(root);
}
