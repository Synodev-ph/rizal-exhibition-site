import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, } from "node:fs";
import { availableParallelism } from "node:os";
import path from "node:path";
import sharp from "sharp";
process.env.UV_THREADPOOL_SIZE ??= String(availableParallelism());
const LADDER = [400, 600, 800, 1200, 1600];
const MAX_WIDTH = 2000;
const FALLBACK_TARGET = 1200;
const CODEC = {
    avif: { quality: 50, effort: 3 },
    webp: { quality: 74 },
    jpeg: { quality: 80, mozjpeg: true },
    png: { compressionLevel: 9 },
};
const CONFIG_KEY = createHash("md5")
    .update(JSON.stringify({ LADDER, MAX_WIDTH, FALLBACK_TARGET, CODEC }))
    .digest("hex")
    .slice(0, 8);
const OUT_DIR = "media/images";
const DZ_DIR = "media/dz";
const DZ_TILE_SIZE = 254;
const DZ_OVERLAP = 1;
const DZ_CODEC = { quality: 80, mozjpeg: true };
const DZ_BACKGROUND = "#151616";
const DZ_CONFIG_KEY = createHash("md5")
    .update(JSON.stringify({ DZ_TILE_SIZE, DZ_OVERLAP, DZ_CODEC, DZ_BACKGROUND }))
    .digest("hex")
    .slice(0, 8);
function contentHash(buf, configKey) {
    return createHash("md5").update(buf).update(configKey).digest("hex").slice(0, 8);
}
function listSources(imagesDir) {
    const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory() ? walk(full) : [full];
    });
    return walk(imagesDir)
        .filter((f) => /\.(avif|jpe?g|png|webp)$/i.test(f))
        .map((f) => path.relative(imagesDir, f).split(path.sep).join("/"))
        .sort();
}
function widthsFor(srcWidth) {
    const ws = LADDER.filter((w) => w < srcWidth);
    ws.push(Math.min(srcWidth, MAX_WIDTH));
    return [...new Set(ws)].sort((a, b) => a - b);
}
function slugFor(src) {
    return src.replace(/\.[^.]+$/, "").split("/").join("-");
}
async function encode(srcPath, src, hash, cacheFilesDir) {
    const image = sharp(srcPath, { failOn: "none" });
    const meta = await image.metadata();
    const srcWidth = meta.width ?? MAX_WIDTH;
    const fallbackFmt = meta.hasAlpha ? "png" : "jpeg";
    const fallbackExt = meta.hasAlpha ? "png" : "jpg";
    const slug = slugFor(src);
    const widths = widthsFor(srcWidth);
    const stats = await image.stats();
    const { r, g, b } = stats.dominant;
    const hex = [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
    const dominant = `#${hex}`;
    const lqipClass = `lqip-${hex}`;
    const emit = async (fmt, w) => {
        const ext = fmt === "jpeg" ? "jpg" : fmt;
        const file = `${slug}-${w}-${hash}.${ext}`;
        const outAbs = path.join(cacheFilesDir, file);
        let pipe = sharp(srcPath, { failOn: "none" }).resize(w, null, {
            withoutEnlargement: true,
        });
        if (fmt === "avif")
            pipe = pipe.avif(CODEC.avif);
        else if (fmt === "webp")
            pipe = pipe.webp(CODEC.webp);
        else if (fmt === "jpeg")
            pipe = pipe.jpeg(CODEC.jpeg);
        else
            pipe = pipe.png(CODEC.png);
        const info = await pipe.toFile(outAbs);
        return { w: info.width, h: info.height, file: `${OUT_DIR}/${file}` };
    };
    const [avif, webp] = await Promise.all([
        Promise.all(widths.map((w) => emit("avif", w))),
        Promise.all(widths.map((w) => emit("webp", w))),
    ]);
    const fbWidth = [...widths].reverse().find((w) => w <= FALLBACK_TARGET) ?? widths[0];
    const fallback = [await emit(fallbackFmt, fbWidth)];
    const imgVar = fallback[0];
    const fullVar = webp[webp.length - 1];
    return {
        src,
        width: imgVar.w,
        height: imgVar.h,
        dominant,
        lqipClass,
        fallbackType: `image/${fallbackFmt}`,
        avif,
        webp,
        fallback,
        imgUrl: imgVar.file,
        fullUrl: fullVar.file,
    };
}
export async function processImages({ assetsDir, dist, cacheDir, log = () => { } }) {
    const imagesDir = path.join(assetsDir, "images");
    const cacheFilesDir = path.join(cacheDir, "files");
    const manifestPath = path.join(cacheDir, "manifest.json");
    mkdirSync(cacheFilesDir, { recursive: true });
    let cache = {};
    if (existsSync(manifestPath)) {
        try {
            cache = JSON.parse(readFileSync(manifestPath, "utf8"));
        }
        catch {
            cache = {};
        }
    }
    const sources = listSources(imagesDir);
    const manifest = new Map();
    const nextCache = {};
    let encoded = 0;
    let reused = 0;
    const toEncode = [];
    for (const src of sources) {
        const srcPath = path.join(imagesDir, src);
        const hash = contentHash(readFileSync(srcPath), CONFIG_KEY);
        const cached = cache[src];
        const filesPresent = cached &&
            cached.hash === hash &&
            [...cached.avif, ...cached.webp, ...cached.fallback].every((v) => existsSync(path.join(cacheFilesDir, path.basename(v.file))));
        if (filesPresent) {
            nextCache[src] = cached;
            reused++;
        }
        else {
            toEncode.push({ src, srcPath, hash });
        }
    }
    let next = 0;
    const worker = async () => {
        while (next < toEncode.length) {
            const { src, srcPath, hash } = toEncode[next++];
            nextCache[src] = { ...(await encode(srcPath, src, hash, cacheFilesDir)), hash };
            encoded++;
            if (encoded % 10 === 0 || encoded === toEncode.length) {
                log(`Images: encoded ${encoded}/${toEncode.length}`);
            }
        }
    };
    const workers = Math.min(toEncode.length, availableParallelism());
    await Promise.all(Array.from({ length: workers }, worker));
    for (const src of sources) {
        const { hash: _h, ...entry } = nextCache[src];
        manifest.set(src, entry);
    }
    const distOut = path.join(dist, OUT_DIR);
    mkdirSync(distOut, { recursive: true });
    const referenced = new Set();
    for (const entry of manifest.values()) {
        for (const v of [...entry.avif, ...entry.webp, ...entry.fallback]) {
            const name = path.basename(v.file);
            referenced.add(name);
            cpSync(path.join(cacheFilesDir, name), path.join(distOut, name));
        }
    }
    for (const f of readdirSync(cacheFilesDir)) {
        if (!referenced.has(f))
            rmSync(path.join(cacheFilesDir, f));
    }
    writeFileSync(manifestPath, JSON.stringify(nextCache, null, 2));
    log(`Images: ${encoded} encoded, ${reused} cached → ${referenced.size} files`);
    return manifest;
}
export function lqipCss(manifest) {
    const byClass = new Map();
    for (const e of manifest.values())
        byClass.set(e.lqipClass, e.dominant);
    return [...byClass]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cls, color]) => `.${cls}{background-color:${color}}`)
        .join("\n");
}
export function lintDistImages(dist) {
    const html = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        if (e.isDirectory())
            return html(full);
        return e.name.endsWith(".html") ? [full] : [];
    });
    const problems = [];
    const distMedia = OUT_DIR + "/";
    for (const file of html(dist)) {
        const src = readFileSync(file, "utf8");
        const rel = path.relative(dist, file);
        const urls = new Set();
        for (const m of src.matchAll(/(?:src|srcset)="([^"]*)"/g)) {
            for (const part of m[1].split(",")) {
                const url = part.trim().split(/\s+/)[0];
                if (url)
                    urls.add(url);
            }
        }
        for (const url of urls) {
            const idx = url.indexOf(distMedia);
            if (idx === -1)
                continue;
            const relPath = url.slice(idx);
            if (!existsSync(path.join(dist, relPath))) {
                problems.push(`${rel}: unpiped/missing image reference "${url}"`);
            }
        }
        if (/(?:src|srcset)="[^"]*assets-src\//.test(src)) {
            problems.push(`${rel}: references assets-src/ directly`);
        }
    }
    if (problems.length) {
        throw new Error(`Image lint failed (${problems.length}):\n  ${problems.join("\n  ")}`);
    }
}
export async function processDeepZoom({ assetsDir, dist, cacheDir, sources, log = () => { } }) {
    const imagesDir = path.join(assetsDir, "images");
    const cacheTilesDir = path.join(cacheDir, "tiles");
    const manifestPath = path.join(cacheDir, "manifest.json");
    mkdirSync(cacheTilesDir, { recursive: true });
    let cache = {};
    if (existsSync(manifestPath)) {
        try {
            cache = JSON.parse(readFileSync(manifestPath, "utf8"));
        }
        catch {
            cache = {};
        }
    }
    const manifest = new Map();
    const nextCache = {};
    const referencedDirs = new Set();
    let tiled = 0;
    let reused = 0;
    for (const src of [...sources].sort()) {
        const srcPath = path.join(imagesDir, src);
        const hash = contentHash(readFileSync(srcPath), DZ_CONFIG_KEY);
        const dir = `${slugFor(src)}-${hash}`;
        const cacheEntryDir = path.join(cacheTilesDir, dir);
        const filesDir = path.join(cacheEntryDir, "tiles_files");
        referencedDirs.add(dir);
        const cached = cache[src];
        let entry;
        if (cached && cached.hash === hash && cached.dir === dir && existsSync(filesDir)) {
            const { hash: _h, dir: _d, ...rest } = cached;
            entry = rest;
            reused++;
        }
        else {
            rmSync(cacheEntryDir, { recursive: true, force: true });
            mkdirSync(cacheEntryDir, { recursive: true });
            const meta = await sharp(srcPath).metadata();
            await sharp(srcPath, { failOn: "none" })
                .flatten({ background: DZ_BACKGROUND })
                .jpeg(DZ_CODEC)
                .tile({ size: DZ_TILE_SIZE, overlap: DZ_OVERLAP, layout: "dz" })
                .toFile(path.join(cacheEntryDir, "tiles.dz"));
            entry = {
                src,
                tilesUrl: `${DZ_DIR}/${dir}_files/`,
                format: "jpeg",
                tileSize: DZ_TILE_SIZE,
                overlap: DZ_OVERLAP,
                width: meta.width ?? 0,
                height: meta.height ?? 0,
            };
            tiled++;
        }
        manifest.set(src, entry);
        nextCache[src] = { ...entry, hash, dir };
    }
    const distOut = path.join(dist, DZ_DIR);
    rmSync(distOut, { recursive: true, force: true });
    if (manifest.size)
        mkdirSync(distOut, { recursive: true });
    for (const [, entry] of manifest) {
        const dir = entry.tilesUrl.slice(DZ_DIR.length + 1).replace(/\/$/, "");
        const base = dir.replace(/_files$/, "");
        cpSync(path.join(cacheTilesDir, base, "tiles_files"), path.join(distOut, dir), {
            recursive: true,
        });
    }
    for (const d of readdirSync(cacheTilesDir)) {
        if (!referencedDirs.has(d))
            rmSync(path.join(cacheTilesDir, d), { recursive: true, force: true });
    }
    writeFileSync(manifestPath, JSON.stringify(nextCache, null, 2));
    log(`Deep zoom: ${tiled} tiled, ${reused} cached → ${manifest.size} pyramid(s)`);
    return manifest;
}
export { OUT_DIR, DZ_DIR };
