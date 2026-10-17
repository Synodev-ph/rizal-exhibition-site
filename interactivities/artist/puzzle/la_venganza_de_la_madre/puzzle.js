const SIZES = [3, 4, 5];
const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
};
class SlidingPuzzle {
    constructor(root) {
        this.root = root;
        this.board = root.querySelector("[data-puzzle-board]");
        this.peekEl = root.querySelector("[data-puzzle-peek]");
        this.statusEl = root.querySelector("[data-puzzle-status]");
        this.movesEl = root.querySelector("[data-puzzle-moves]");
        this.timeEl = root.querySelector("[data-puzzle-time]");
        this.tilesEl = root.querySelector("[data-puzzle-tiles]");
        this.peekButtons = [...root.querySelectorAll("[data-puzzle-peek-btn]")];
        this.numbersButtons = [...root.querySelectorAll("[data-puzzle-numbers]")];
        this.shuffleButtons = [...root.querySelectorAll("[data-puzzle-shuffle]")];
        this.sizeButtons = [...root.querySelectorAll("[data-puzzle-size-btn]")];
        this.dialog = root.querySelector("[data-puzzle-dialog]");
        this.confettiCanvas = root.querySelector("[data-puzzle-confetti]");
        this.dialogTime = root.querySelector("[data-dialog-time]");
        this.dialogMoves = root.querySelector("[data-dialog-moves]");
        this.againBtn = root.querySelector("[data-puzzle-again]");
        this.closeBtn = root.querySelector("[data-puzzle-close]");
        this.infoButtons = [...root.querySelectorAll("[data-puzzle-info]")];
        this.infoDialog = root.querySelector("[data-puzzle-info-dialog]");
        this.infoClose = root.querySelector("[data-puzzle-info-close]");
        this.shareButtons = [...root.querySelectorAll("[data-puzzle-share]")];
        this.linkButtons = [...root.querySelectorAll("[data-puzzle-share-link]")];
        this.shareStatusEl = root.querySelector("[data-puzzle-share-status]");
        this.dialogStatusEl = root.querySelector("[data-dialog-share-status]");
        this.image = root.dataset.image ?? "";
        this.messages = {
            tile: root.dataset.msgTile ?? "Tile {n}",
            solved: root.dataset.msgSolved ?? "Solved!",
            showNumbers: root.dataset.msgShowNumbers ?? "Show numbers",
            hideNumbers: root.dataset.msgHideNumbers ?? "Hide numbers",
            shareTitle: root.dataset.msgShareTitle ?? "I solved La Venganza de la Madre",
            shareText: root.dataset.msgShareText ?? "I reassembled the sculpture in {time} and {moves} moves.",
            shareSaved: root.dataset.msgShareSaved ?? "Image saved to your device.",
            shareCopied: root.dataset.msgShareCopied ?? "Link copied.",
            shareFailed: root.dataset.msgShareFailed ?? "Sharing isn't available on this device.",
        };
        this.sizeIndex = 0;
        this.size = SIZES[this.sizeIndex];
        this.state = [];
        this.cells = [];
        this.moves = 0;
        this.seconds = 0;
        this.timer = null;
        this.started = false;
        this.solved = false;
        this.ready = false;
        this.showNumbers = false;
        this.confettiRaf = null;
        this.confettiActive = false;
        this.shareBlob = null;
        this.sourceImage = null;
        this.shareLogo = new Image();
        const logoEl = document.querySelector(".site-header__logo");
        if (logoEl)
            this.shareLogo.src = logoEl.currentSrc || logoEl.src;
        this.bindControls();
        this.bindDialog();
        this.bindShare();
        this.bindInfo();
        this.loadImage();
    }
    loadImage() {
        if (!this.image) {
            this.fail();
            return;
        }
        const probe = new Image();
        probe.decoding = "async";
        probe.addEventListener("load", () => {
            this.ready = true;
            this.sourceImage = probe;
            this.root.style.setProperty("--puzzle-ar", String(probe.naturalWidth / probe.naturalHeight));
            this.newGame();
        });
        probe.addEventListener("error", () => this.fail());
        probe.src = this.image;
    }
    fail() {
        this.board.replaceChildren();
        const message = document.createElement("p");
        message.className = "puzzle__loading";
        message.textContent = this.root.dataset.msgError ?? "The artwork could not be loaded.";
        this.board.append(message);
    }
    bindControls() {
        this.board.tabIndex = 0;
        this.board.addEventListener("keydown", (event) => this.onKey(event));
        for (const btn of this.shuffleButtons)
            btn.addEventListener("click", () => {
                if (this.ready)
                    this.newGame();
            });
        for (const btn of this.sizeButtons)
            btn.addEventListener("click", () => {
                if (!this.ready)
                    return;
                this.sizeIndex = (this.sizeIndex + 1) % SIZES.length;
                this.size = SIZES[this.sizeIndex];
                this.newGame();
            });
        for (const btn of this.numbersButtons)
            btn.addEventListener("click", () => {
                this.showNumbers = !this.showNumbers;
                this.syncNumbersButtons();
            });
        for (const btn of this.peekButtons) {
            const show = () => this.root.classList.add("is-peeking");
            const hide = () => this.root.classList.remove("is-peeking");
            btn.addEventListener("pointerdown", (event) => {
                event.preventDefault();
                show();
            });
            for (const name of ["pointerup", "pointerleave", "pointercancel"])
                btn.addEventListener(name, hide);
            btn.addEventListener("keydown", (event) => {
                if (event.key === " " || event.key === "Enter" || event.key === "Spacebar") {
                    event.preventDefault();
                    show();
                }
            });
            btn.addEventListener("keyup", (event) => {
                if (event.key === " " || event.key === "Enter" || event.key === "Spacebar") {
                    event.preventDefault();
                    hide();
                }
            });
            btn.addEventListener("blur", hide);
        }
    }
    syncNumbersButtons() {
        for (const btn of this.numbersButtons) {
            btn.setAttribute("aria-pressed", String(this.showNumbers));
            if (btn.classList.contains("puzzle__control")) {
                btn.textContent = this.showNumbers ? this.messages.hideNumbers : this.messages.showNumbers;
            }
            else {
                btn.setAttribute("aria-label", this.showNumbers ? this.messages.hideNumbers : this.messages.showNumbers);
            }
        }
        this.syncNumbers();
    }
    bindDialog() {
        if (!this.dialog)
            return;
        this.againBtn?.addEventListener("click", () => {
            this.dialog.close();
            this.newGame();
        });
        this.closeBtn?.addEventListener("click", () => this.dialog.close());
        this.dialog.addEventListener("click", (event) => {
            if (event.target === this.dialog)
                this.dialog.close();
        });
        this.dialog.addEventListener("close", () => this.stopConfetti());
    }
    bindShare() {
        for (const btn of this.shareButtons)
            btn.addEventListener("click", () => this.shareLink(btn.dataset.puzzleShare, true));
        for (const btn of this.linkButtons)
            btn.addEventListener("click", () => this.shareLink(btn.dataset.puzzleShareLink, false));
        if (!SlidingPuzzle.isMobile()) {
            for (const btn of this.root.querySelectorAll('[data-puzzle-share="instagram"], [data-puzzle-share-link="instagram"]'))
                btn.hidden = true;
        }
    }
    bindInfo() {
        if (!this.infoDialog)
            return;
        for (const btn of this.infoButtons)
            btn.addEventListener("click", () => this.infoDialog.showModal());
        this.infoClose?.addEventListener("click", () => this.infoDialog.close());
        this.infoDialog.addEventListener("click", (event) => {
            if (event.target === this.infoDialog)
                this.infoDialog.close();
        });
    }
    static isMobile() {
        if (typeof navigator.userAgentData?.mobile === "boolean")
            return navigator.userAgentData.mobile;
        return /Mobi|Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
            (typeof window.matchMedia === "function" && window.matchMedia("(hover: none) and (pointer: coarse)").matches);
    }
    onKey(event) {
        if (this.solved || !this.ready)
            return;
        const n = this.size;
        const empty = this.state.indexOf(n * n - 1);
        const row = Math.floor(empty / n);
        const col = empty % n;
        let targetRow = row;
        let targetCol = col;
        switch (event.key) {
            case "ArrowUp":
                targetRow = row - 1;
                break;
            case "ArrowDown":
                targetRow = row + 1;
                break;
            case "ArrowLeft":
                targetCol = col - 1;
                break;
            case "ArrowRight":
                targetCol = col + 1;
                break;
            default:
                return;
        }
        if (targetRow < 0 || targetRow >= n || targetCol < 0 || targetCol >= n)
            return;
        event.preventDefault();
        this.slide(targetRow * n + targetCol, true);
    }
    newGame() {
        if (this.dialog?.open)
            this.dialog.close();
        this.stopConfetti();
        this.stopTimer();
        this.moves = 0;
        this.seconds = 0;
        this.started = false;
        this.solved = false;
        this.shareBlob = null;
        this.root.classList.remove("is-solved");
        this.hideStatus();
        this.setShareStatus("");
        if (this.dialogStatusEl)
            this.dialogStatusEl.textContent = "";
        this.updateStats();
        const count = this.size * this.size;
        this.state = Array.from({ length: count }, (_, i) => i);
        this.shuffleState();
        this.render();
    }
    neighbors(pos) {
        const n = this.size;
        const row = Math.floor(pos / n);
        const col = pos % n;
        const out = [];
        if (row > 0)
            out.push(pos - n);
        if (row < n - 1)
            out.push(pos + n);
        if (col > 0)
            out.push(pos - 1);
        if (col < n - 1)
            out.push(pos + 1);
        return out;
    }
    shuffleState() {
        const n = this.size;
        const blank = n * n - 1;
        let empty = blank;
        let previous = -1;
        const steps = n * n * 40;
        for (let i = 0; i < steps; i += 1) {
            const options = this.neighbors(empty).filter((p) => p !== previous);
            const pick = options[Math.floor(Math.random() * options.length)];
            this.state[empty] = this.state[pick];
            this.state[pick] = blank;
            previous = empty;
            empty = pick;
        }
    }
    render() {
        this.board.style.setProperty("--n", String(this.size));
        this.board.replaceChildren();
        this.cells = [];
        const count = this.size * this.size;
        const blank = count - 1;
        for (let pos = 0; pos < count; pos += 1) {
            const tile = this.state[pos];
            if (tile === blank) {
                const cell = document.createElement("div");
                cell.className = "puzzle__cell puzzle__cell--blank";
                this.board.append(cell);
                this.cells.push(cell);
            }
            else {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "puzzle__tile";
                this.paintTile(button, tile);
                button.addEventListener("click", () => this.slide(pos));
                this.board.append(button);
                this.cells.push(button);
            }
        }
        this.syncNumbers();
    }
    paintTile(button, tile) {
        const n = this.size;
        const row = Math.floor(tile / n);
        const col = tile % n;
        const x = n > 1 ? (col * 100) / (n - 1) : 0;
        const y = n > 1 ? (row * 100) / (n - 1) : 0;
        button.style.backgroundImage = `url("${this.image}")`;
        button.style.backgroundSize = `${n * 100}% ${n * 100}%`;
        button.style.backgroundPosition = `${x}% ${y}%`;
        button.setAttribute("aria-label", this.messages.tile.replace("{n}", String(tile + 1)));
    }
    syncNumbers() {
        for (let pos = 0; pos < this.cells.length; pos += 1) {
            const cell = this.cells[pos];
            if (!(cell instanceof HTMLButtonElement))
                continue;
            let badge = cell.querySelector(".puzzle__tile-num");
            if (this.showNumbers) {
                if (!badge) {
                    badge = document.createElement("span");
                    badge.className = "puzzle__tile-num";
                    badge.setAttribute("aria-hidden", "true");
                    cell.append(badge);
                }
                badge.textContent = String(this.state[pos] + 1);
            }
            else if (badge) {
                badge.remove();
            }
        }
    }
    isAdjacent(a, b) {
        const n = this.size;
        const rowA = Math.floor(a / n);
        const colA = a % n;
        const rowB = Math.floor(b / n);
        const colB = b % n;
        return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
    }
    slide(pos, viaKeyboard = false) {
        if (this.solved || !this.ready)
            return;
        const empty = this.state.indexOf(this.size * this.size - 1);
        if (!this.isAdjacent(pos, empty))
            return;
        this.state[empty] = this.state[pos];
        this.state[pos] = this.size * this.size - 1;
        this.moves += 1;
        if (!this.started) {
            this.started = true;
            this.startTimer();
        }
        this.updateStats();
        this.render();
        if (viaKeyboard)
            this.board.focus();
        this.checkSolved();
    }
    updateStats() {
        if (this.movesEl)
            this.movesEl.textContent = String(this.moves);
        if (this.timeEl)
            this.timeEl.textContent = formatTime(this.seconds);
        if (this.tilesEl)
            this.tilesEl.textContent = `${this.size}×${this.size}`;
    }
    startTimer() {
        if (this.timer || this.solved)
            return;
        this.timer = window.setInterval(() => {
            this.seconds += 1;
            if (this.timeEl)
                this.timeEl.textContent = formatTime(this.seconds);
        }, 1000);
    }
    stopTimer() {
        if (this.timer) {
            window.clearInterval(this.timer);
            this.timer = null;
        }
    }
    checkSolved() {
        if (!this.state.every((value, index) => value === index))
            return;
        this.solved = true;
        this.stopTimer();
        this.root.classList.add("is-solved");
        for (const cell of this.cells) {
            if (cell instanceof HTMLButtonElement)
                cell.disabled = true;
        }
        const text = this.messages.solved
            .replace("{moves}", String(this.moves))
            .replace("{time}", formatTime(this.seconds));
        this.showStatus(text);
        this.openCelebration();
    }
    openCelebration() {
        if (this.dialogTime)
            this.dialogTime.textContent = formatTime(this.seconds);
        if (this.dialogMoves)
            this.dialogMoves.textContent = String(this.moves);
        if (this.dialog && !this.dialog.open)
            this.dialog.showModal();
        this.startConfetti();
    }
    startConfetti() {
        if (!this.confettiCanvas)
            return;
        this.stopConfetti();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
            return;
        const ctx = this.confettiCanvas.getContext("2d");
        if (!ctx)
            return;
        const canvas = this.confettiCanvas;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = canvas.clientWidth || window.innerWidth;
        const height = canvas.clientHeight || window.innerHeight;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const colors = ["#f2ac1d", "#761113", "#0f103e", "#f8f9fb", "#4d4c4c"];
        const particles = [];
        const burst = (originX, originY, direction) => {
            const count = 130;
            for (let i = 0; i < count; i += 1) {
                const angle = -Math.PI / 2 + direction * Math.random() * 0.85 + (Math.random() - 0.5) * 0.3;
                const speed = 12 + Math.random() * 10;
                particles.push({
                    x: originX,
                    y: originY,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    rot: Math.random() * Math.PI,
                    vr: (Math.random() - 0.5) * 0.3,
                    size: 6 + Math.random() * 7,
                    color: colors[Math.floor(Math.random() * colors.length)],
                    life: 0,
                    ttl: 120 + Math.random() * 70,
                });
            }
        };
        const panel = this.dialog?.querySelector(".puzzle-dialog__panel");
        const rect = panel ? panel.getBoundingClientRect() : null;
        const originY = (rect ? rect.bottom : height * 0.62) - 4;
        const leftX = rect ? rect.left + rect.width * 0.08 : width * 0.34;
        const rightX = rect ? rect.right - rect.width * 0.08 : width * 0.66;
        this.confettiActive = true;
        burst(leftX, originY, -1);
        burst(rightX, originY, 1);
        window.setTimeout(() => {
            if (!this.confettiActive)
                return;
            burst(leftX, originY, -1);
            burst(rightX, originY, 1);
        }, 280);
        const draw = () => {
            if (!this.confettiActive) {
                this.confettiRaf = null;
                return;
            }
            ctx.clearRect(0, 0, width, height);
            let alive = 0;
            for (const p of particles) {
                p.vy += 0.35;
                p.vx *= 0.992;
                p.vy *= 0.992;
                p.x += p.vx;
                p.y += p.vy;
                p.rot += p.vr;
                p.life += 1;
                const t = p.life / p.ttl;
                if (t >= 1 || p.y > height + 40)
                    continue;
                alive += 1;
                const alpha = t > 0.7 ? (1 - t) / 0.3 : 1;
                ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.rot);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size * 0.6);
                ctx.restore();
            }
            ctx.globalAlpha = 1;
            if (alive > 0)
                this.confettiRaf = window.requestAnimationFrame(draw);
            else {
                ctx.clearRect(0, 0, width, height);
                this.confettiRaf = null;
                this.confettiActive = false;
            }
        };
        this.confettiRaf = window.requestAnimationFrame(draw);
    }
    stopConfetti() {
        this.confettiActive = false;
        if (this.confettiRaf) {
            window.cancelAnimationFrame(this.confettiRaf);
            this.confettiRaf = null;
        }
        const canvas = this.confettiCanvas;
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    showStatus(text) {
        if (!this.statusEl)
            return;
        this.statusEl.textContent = text;
        this.statusEl.hidden = false;
    }
    hideStatus() {
        if (!this.statusEl)
            return;
        this.statusEl.hidden = true;
        this.statusEl.textContent = "";
    }
    textOf(selector) {
        return document.querySelector(selector)?.textContent?.trim() ?? "";
    }
    shareUrl() {
        const { origin, pathname } = window.location;
        if (origin && pathname) {
            let path2 = pathname;
            if (path2.endsWith("/index.html"))
                path2 = path2.slice(0, -"index.html".length);
            else if (!path2.endsWith("/") && !/\.[a-z0-9]+$/i.test(path2))
                path2 += "/";
            return `${origin}${path2}`;
        }
        return document.querySelector('link[rel="canonical"]')?.href ?? window.location.href;
    }
    shareText() {
        return this.messages.shareText
            .replace("{time}", formatTime(this.seconds))
            .replace("{moves}", String(this.moves));
    }
    setShareStatus(text, modal = false) {
        if (modal) {
            if (this.dialogStatusEl)
                this.dialogStatusEl.textContent = text;
        }
        else if (this.shareStatusEl) {
            this.shareStatusEl.textContent = text;
        }
    }
    prepareShareImage() {
        this.shareBlob = null;
        this.buildShareImage()
            .then((blob) => { this.shareBlob = blob; })
            .catch(() => { });
    }
    roundRect(ctx, x, y, w, h, r) {
        if (typeof ctx.roundRect === "function") {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
            return;
        }
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
    drawWrapped(ctx, text, centerX, firstBaseline, maxWidth, lineHeight) {
        const words = String(text ?? "").split(/\s+/).filter(Boolean);
        let line = "";
        let y = firstBaseline;
        for (const word of words) {
            const test = line ? `${line} ${word}` : word;
            if (line && ctx.measureText(test).width > maxWidth) {
                ctx.fillText(line, centerX, y);
                line = word;
                y += lineHeight;
            }
            else {
                line = test;
            }
        }
        if (line)
            ctx.fillText(line, centerX, y);
        return y;
    }
    drawStat(ctx, centerX, baseline, value, label, valueColor, labelColor) {
        ctx.textAlign = "center";
        ctx.fillStyle = valueColor;
        ctx.font = '400 68px Alice, "Times New Roman", serif';
        ctx.fillText(value, centerX, baseline);
        ctx.fillStyle = labelColor;
        ctx.font = "600 24px Figtree, sans-serif";
        ctx.fillText(label, centerX, baseline + 48);
    }
    async buildShareImage() {
        const W = 1080;
        const H = 1350;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");
        if (!ctx)
            return null;
        try {
            await document.fonts.ready;
        }
        catch {
            // fonts are best-effort; fall back to system serif/sans
        }
        const styles = getComputedStyle(document.documentElement);
        const bg = styles.getPropertyValue("--chinese-black").trim() || "#151616";
        const light = styles.getPropertyValue("--ghost-white").trim() || "#f8f9fb";
        const accent = styles.getPropertyValue("--squash").trim() || "#f2ac1d";
        const mat = styles.getPropertyValue("--exhibit-frame").trim() || "#eceef2";
        const muted = "rgba(248, 249, 251, 0.74)";
        const faint = "rgba(248, 249, 251, 0.55)";
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, W, H);
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const title = this.textOf(".puzzle__title");
        const subtitle = this.textOf(".puzzle__subtitle");
        const brand = this.textOf(".site-header__brand-title");
        const brandSub = this.textOf(".site-header__brand-subtitle");
        ctx.fillStyle = accent;
        ctx.font = "600 26px Figtree, sans-serif";
        ctx.fillText((brandSub || "Digital Exhibition").toUpperCase(), W / 2, 126);
        ctx.fillStyle = light;
        ctx.font = '400 64px Alice, "Times New Roman", serif';
        const titleBottom = this.drawWrapped(ctx, title, W / 2, 250, W - 160, 74);
        ctx.fillStyle = muted;
        ctx.font = "400 34px Figtree, sans-serif";
        const subtitleBottom = this.drawWrapped(ctx, subtitle, W / 2, titleBottom + 52, W - 160, 44);
        const image = this.sourceImage;
        const matPad = 24;
        const artW = 760;
        const ratio = image && image.naturalWidth ? image.naturalWidth / image.naturalHeight : 1.5;
        const artH = artW / ratio;
        const matW = artW + matPad * 2;
        const matH = artH + matPad * 2;
        const matX = (W - matW) / 2;
        const matY = Math.max(subtitleBottom + 60, 430);
        this.roundRect(ctx, matX, matY, matW, matH, 16);
        ctx.fillStyle = mat;
        ctx.fill();
        if (image)
            ctx.drawImage(image, matX + matPad, matY + matPad, artW, artH);
        const labels = [...document.querySelectorAll(".puzzle__stat dt")].map((el) => el.textContent.trim().toUpperCase());
        const statY = matY + matH + 120;
        this.drawStat(ctx, W / 2 - 170, statY, formatTime(this.seconds), labels[0] || "TIME", light, faint);
        this.drawStat(ctx, W / 2 + 170, statY, String(this.moves), labels[1] || "MOVES", light, faint);
        const logo = this.shareLogo;
        if (logo && logo.complete && logo.naturalWidth) {
            const logoH = 46;
            const logoW = logoH * (logo.naturalWidth / logo.naturalHeight);
            ctx.drawImage(logo, W / 2 - logoW / 2, H - 150, logoW, logoH);
        }
        ctx.fillStyle = faint;
        ctx.font = "500 24px Figtree, sans-serif";
        ctx.fillText(brand, W / 2, H - 84);
        ctx.fillStyle = "rgba(248, 249, 251, 0.45)";
        ctx.font = "400 22px Figtree, sans-serif";
        ctx.fillText(this.shareUrl().replace(/^https?:\/\//, "").replace(/\/$/, ""), W / 2, H - 46);
        return await new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), "image/png");
        });
    }
    async shareImage() {
        try {
            const blob = this.shareBlob ?? (await this.buildShareImage());
            if (!blob) {
                this.setShareStatus(this.messages.shareFailed, true);
                return;
            }
            const file = new File([blob], "la-venganza-de-la-madre.png", { type: "image/png" });
            const title = this.messages.shareTitle;
            const text = this.shareText();
            if (typeof navigator.share === "function" && typeof navigator.canShare === "function" &&
                navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title, text });
                    return;
                }
                catch (err) {
                    if (err && err.name === "AbortError")
                        return;
                }
            }
            this.downloadBlob(blob);
        }
        catch {
            this.setShareStatus(this.messages.shareFailed, true);
        }
    }
    downloadBlob(blob) {
        try {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "la-venganza-de-la-madre.png";
            document.body.append(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 5000);
        }
        catch {
            // ignore
        }
        this.setShareStatus(this.messages.shareSaved, true);
    }
    shareLink(platform, fromModal = false) {
        const url = this.shareUrl();
        const text = this.shareText();
        if (platform === "facebook") {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer,width=640,height=640");
        }
        else if (platform === "x") {
            window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer,width=640,height=640");
        }
        else if (platform === "instagram") {
            if (SlidingPuzzle.isMobile() && typeof navigator.share === "function") {
                navigator.share({ title: this.messages.shareTitle, text, url }).catch(() => { });
            }
            else {
                this.copyLink(url, fromModal);
            }
        }
    }
    copyLink(url, fromModal = false) {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(url).catch(() => { });
        }
        this.setShareStatus(this.messages.shareCopied, fromModal);
    }
}
const root = document.querySelector("[data-puzzle]");
if (root) {
    const game = new SlidingPuzzle(root);
    if (new URLSearchParams(window.location.search).has("debug"))
        window.__puzzleGame = game;
}
export {};
