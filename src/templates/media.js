import { esc } from "./layout.js";

let manifest = null;

export function setImageManifest(m) {
  manifest = m;
}

let dzManifest = null;

export function setDeepZoomManifest(m) {
  dzManifest = m;
}

export function viewerImage(site, image) {
  const dz = dzManifest?.get(image.src) ?? null;
  const entry = entryFor(image.src);
  return {
    full: site.basePath + entry.fullUrl,
    thumb: site.basePath + entry.webp[0].file,
    alt: image.alt,
    credit: image.credit ?? null,
    dz: dz
      ? {
          url: site.basePath + dz.tilesUrl,
          format: dz.format,
          tileSize: dz.tileSize,
          overlap: dz.overlap,
          width: dz.width,
          height: dz.height,
        }
      : null,
  };
}

export function modelUrl(site, src) {
  return site.basePath + "media/models/" + src;
}

export function viewerModel(site, model) {
  const item = viewerImage(site, {
    src: model.poster,
    alt: model.altText,
    credit: model.credit,
  });
  return { ...item, model: modelUrl(site, model.src) };
}

function entryFor(src) {
  const entry = manifest?.get(src);
  if (!entry) {
    throw new Error(
      `media: no pipeline output for "${src}" — did the image pipeline run before rendering?`,
    );
  }
  return entry;
}

export function imageUrl(site, src) {
  return site.basePath + entryFor(src).fullUrl;
}

export function ogImage(site, image) {
  const entry = entryFor(image.src);
  const fallback = entry.fallback[0];
  return {
    url: site.baseUrl.replace(/\/$/, "") + site.basePath + fallback.file,
    width: fallback.w,
    height: fallback.h,
    type: entry.fallbackType,
    alt: image.alt ?? "",
  };
}

function srcset(site, variants) {
  return variants.map((v) => `${site.basePath}${v.file} ${v.w}w`).join(", ");
}

export function renderImage({
  site,
  image,
  className,
  loading = "lazy",
  fetchpriority,
  sizes = "100vw",
  dataVt,
}) {
  const entry = entryFor(image.src);
  const posClass = image.position ? `img-anchor-${image.position}` : "";
  const cls = [className, posClass, entry.lqipClass].filter(Boolean).join(" ");
  const imgAttrs = [
    `class="${esc(cls)}"`,
    `src="${esc(site.basePath + entry.imgUrl)}"`,
    `alt="${esc(image.alt)}"`,
    `width="${entry.width}"`,
    `height="${entry.height}"`,
    `loading="${loading}"`,
    `decoding="async"`,
    fetchpriority ? `fetchpriority="${fetchpriority}"` : "",
    dataVt ? `data-vt="${esc(dataVt)}"` : "",
  ].filter(Boolean);
  const sizesAttr = `sizes="${esc(sizes)}"`;
  return `<picture>\
<source type="image/avif" srcset="${esc(srcset(site, entry.avif))}" ${sizesAttr}>\
<source type="image/webp" srcset="${esc(srcset(site, entry.webp))}" ${sizesAttr}>\
<img ${imgAttrs.join(" ")}></picture>`;
}
