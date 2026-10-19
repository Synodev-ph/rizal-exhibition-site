import { icons } from "../icons.js";
import {
  LOCALES,
  alternates,
  getLocale,
  hrefForLocale,
  localizeHref,
  pick,
  t,
} from "../i18n.js";

export function esc(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

// Search engines truncate titles past ~70 characters.
export const TITLE_MAX = 70;

const OG_LOCALES = { en: "en_US", fil: "fil_PH", de: "de_DE" };

function defaultSocialImage(site) {
  return {
    url: site.baseUrl.replace(/\/$/, "") + site.basePath + "img/hero-poster.webp",
    width: 1280,
    height: 720,
    type: "image/webp",
    alt: `${pick(site.exhibitionTitle)} — ${pick(site.exhibitionSubtitle)}`,
  };
}

function twitterHandle(site) {
  const account = (site.social ?? []).find((s) =>
    /(?:^|[/.])(?:twitter|x)\.com\//i.test(s.href),
  );
  if (!account) return "";
  const match = account.href.match(/(?:twitter|x)\.com\/([^/?#]+)/i);
  return match ? `@${match[1]}` : "";
}

export function seoTitle(name, siteTitle) {
  const full = `${name} | ${siteTitle}`;
  if (full.length <= TITLE_MAX) return full;
  if (name.length <= TITLE_MAX) return name;
  return name.slice(0, TITLE_MAX - 1).replace(/\s+\S*$/, "") + "…";
}

function renderLangSwitch(currentPath) {
  const active = getLocale();
  const items = LOCALES.filter((l) => l.id !== active)
    .map((l) => {
      const flag = `<span class="lang-switch__flag" aria-hidden="true">${icons[l.flag] ?? ""}</span>`;
      return `      <li class="lang-switch__item"><a class="lang-switch__link" href="${esc(hrefForLocale(currentPath, l.id))}" hreflang="${esc(l.hreflang)}" lang="${esc(l.hreflang)}">${flag}<span class="visually-hidden">${esc(l.label)}</span></a></li>`;
    })
    .join("\n");
  if (!items) return "";
  return `<nav class="lang-switch" aria-label="${esc(t("language"))}">
    <ul class="lang-switch__list">
${items}
    </ul>
  </nav>`;
}

function renderNav(site, currentPath) {
  const items = site.nav
    .map((item) => {
      const current = item.href === currentPath ? ' aria-current="page"' : "";
      const label = pick(item.label);
      if (item.children?.length) {
        const submenuId = `nav-submenu-${item.href.replace(/\//g, "") || "root"}`;
        const children = item.children
          .map((c) => {
            const cCurrent = c.href === currentPath ? ' aria-current="page"' : "";
            return `<li><a href="${esc(localizeHref(c.href))}"${cCurrent}>${esc(pick(c.label))}</a></li>`;
          })
          .join("\n");
        return `<li class="nav-item nav-item--dropdown">
  <a href="${esc(localizeHref(item.href))}"${current}>${esc(label)}</a>
  <button class="nav-dropdown__toggle" type="button" aria-expanded="false" aria-controls="${submenuId}">
    <span class="visually-hidden">${esc(t("navShowSections", { label }))}</span>
    <span class="nav-dropdown__chevron" aria-hidden="true">${icons["chevron-down"]}</span>
  </button>
  <ul class="nav-dropdown" id="${submenuId}">
${children}
  </ul>
</li>`;
      }
      return `<li class="nav-item"><a href="${esc(localizeHref(item.href))}"${current}>${esc(label)}</a></li>`;
    })
    .join("\n");

  const searchRoute = `${site.basePath}search/`;
  const searchHref = localizeHref(searchRoute);
  const searchCurrent = searchRoute === currentPath ? ' aria-current="page"' : "";

  return `<nav class="site-nav" aria-label="${esc(t("mainNav"))}">
  <button class="site-nav__toggle" type="button" aria-expanded="false" aria-controls="site-nav-list">
    <span class="visually-hidden">${esc(t("menu"))}</span>
    <span class="site-nav__toggle-icon" aria-hidden="true">${icons.menu}${icons.close}</span>
  </button>
  <ul class="site-nav__list" id="site-nav-list">
${items}
  </ul>
  <div class="site-search-wrap">
    <a class="site-nav__search" href="${esc(searchHref)}"${searchCurrent}>
      <span class="nav-icon-wrap" aria-hidden="true">${icons.search}</span>
      <span class="visually-hidden">${esc(t("search"))}</span>
    </a>
    <section class="site-search" id="site-search" aria-labelledby="site-search-title" hidden>
      <h2 class="site-search__title visually-hidden" id="site-search-title">${esc(t("search"))}</h2>
      <div class="site-search__row">
        <div id="site-search-ui" class="search-ui"></div>
        <button class="site-search__close" type="button">
          <span class="nav-icon-wrap" aria-hidden="true">${icons.close}</span>
          <span class="visually-hidden">${esc(t("closeSearch"))}</span>
        </button>
      </div>
    </section>
  </div>
  ${renderLangSwitch(currentPath)}
</nav>`;
}

function socialLink(s) {
  const svg = icons[String(s.name).toLowerCase()];
  return `<li><a class="footer-social__link" href="${esc(s.href)}" rel="external" aria-label="${esc(s.name)}">${svg || esc(s.name)}</a></li>`;
}

function renderFooter(site) {
  const {
    footer,
    contact,
    partners,
    footerNav,
    footerCtas,
    social,
    copyright,
    basePath,
  } = site;

  const [brand, ...seals] = partners ?? [];
  const brandImg = brand
    ? `<img class="footer-panel__logo" src="${esc(basePath + brand.logo)}" alt="${esc(brand.name)}" loading="lazy" decoding="async">`
    : "";
  const sealItems = seals
    .map((p) => {
      const name = esc(p.caption ? pick(p.caption) : p.name);
      const img = `<img src="${esc(basePath + p.logo)}" alt="${name}" title="${name}" loading="lazy" decoding="async">`;
      return `<li${p.chip ? ' class="footer-seal--chip"' : ""}>${img}</li>`;
    })
    .join("\n");
  const navItems = (footerNav ?? [])
    .map((i) => `<li><a href="${esc(localizeHref(i.href))}">${esc(pick(i.label))}</a></li>`)
    .join("\n");
  const ctaItems = (footerCtas ?? [])
    .map(
      (c) =>
        `<li><a class="footer-pill" href="${esc(localizeHref(c.href))}">${esc(pick(c.label))} ${icons.arrow}</a></li>`,
    )
    .join("\n");
  const socialItems = (social ?? []).map(socialLink).join("\n");

  const telHref = contact.phone.replace(/[^\d+]/g, "");
  // Non-breaking hyphen keeps the phone number on one line.
  const phoneDisplay = contact.phone.replace(/ /g, " ").replace(/-/g, "‑");

  return `<footer class="site-footer band band--dark" data-pagefind-ignore>
  <div class="footer-top">
    <aside class="footer-panel">
      ${brandImg}
      <ul class="footer-panel__seals">
${sealItems}
      </ul>
    </aside>
    <div class="footer-body">
      <nav class="footer-nav" aria-label="${esc(t("exhibitionSections"))}">
        <ul class="footer-nav__list">
${navItems}
        </ul>
      </nav>
      <hr class="footer-rule">
      <div class="footer-grid">
        <section class="footer-about" aria-labelledby="footer-about">
          <h2 class="footer-heading" id="footer-about">${esc(pick(footer.aboutHeading))}</h2>
          <p>${esc(pick(footer.aboutText))}</p>
          <p class="footer-exhibition">
            <span class="footer-exhibition__title">${esc(pick(site.exhibitionTitle))}</span>
            <span class="footer-exhibition__sub">${esc(pick(site.exhibitionSubtitle))}</span>
            
          </p>
                <p class="footer-panel__address">${icons.pin}<span>${esc(contact.address)}</span></p>

        </section>
        <div class="footer-side">
          <ul class="footer-ctas">
${ctaItems}
          </ul>
          <ul class="footer-social">
${socialItems}
          </ul>
          <div class="footer-contact">
            <span class="footer-contact__label">${esc(pick(footer.contactHeading))}</span>
            <a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a>
            <a href="tel:${esc(telHref)}">${esc(phoneDisplay)}</a>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="site-footer__bar">
    <p class="site-footer__copyright">${esc(pick(copyright))}</p>
  </div>
</footer>`;
}

export function renderPage({
  site,
  assets,
  path,
  title,
  description,
  content,
  image,
  isDev = false,
}) {
  const locale = getLocale();
  const origin = site.baseUrl.replace(/\/$/, "");
  const canonical = origin + hrefForLocale(path, locale);
  const altLinks = alternates(site.baseUrl, path)
    .map((a) => `  <link rel="alternate" hreflang="${esc(a.hreflang)}" href="${esc(a.href)}">`)
    .join("\n");
  const shareImage = image ?? defaultSocialImage(site);
  const twitter = twitterHandle(site);
  const socialTags = [
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="${esc(pick(site.exhibitionSubtitle))}">`,
    `  <meta property="og:locale" content="${esc(OG_LOCALES[locale] ?? locale)}">`,
    `  <meta property="og:title" content="${esc(title)}">`,
    `  <meta property="og:description" content="${esc(description)}">`,
    `  <meta property="og:url" content="${esc(canonical)}">`,
    `  <meta property="og:image" content="${esc(shareImage.url)}">`,
    `  <meta property="og:image:type" content="${esc(shareImage.type)}">`,
    `  <meta property="og:image:width" content="${shareImage.width}">`,
    `  <meta property="og:image:height" content="${shareImage.height}">`,
    `  <meta property="og:image:alt" content="${esc(shareImage.alt)}">`,
    `  <meta name="twitter:card" content="summary_large_image">`,
    twitter ? `  <meta name="twitter:site" content="${esc(twitter)}">` : "",
    `  <meta name="twitter:title" content="${esc(title)}">`,
    `  <meta name="twitter:description" content="${esc(description)}">`,
    `  <meta name="twitter:image" content="${esc(shareImage.url)}">`,
    `  <meta name="twitter:image:alt" content="${esc(shareImage.alt)}">`,
  ].filter(Boolean).join("\n");
  const reload = isDev
    ? `\n<script>new EventSource("/__reload").onmessage = () => location.reload();</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="${esc(locale)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <link rel="canonical" href="${esc(canonical)}">
${altLinks}
${socialTags}
  <link rel="stylesheet" href="${esc(assets.css)}">
  <script type="module" src="${esc(assets.js)}" defer></script>
</head>
<body>
  <a class="skip-link" href="#main">${esc(t("skipToContent"))}</a>
  <header class="site-header band band--dark" data-pagefind-ignore>
    <div class="container site-header__inner">
      <a class="site-header__brand" href="${esc(localizeHref(site.basePath))}">
        <img class="site-header__logo" src="${esc(site.basePath)}img/pamana-logo.webp" alt="PAMANA" width="480" height="299">
        <span class="site-header__brand-text">
          <span class="site-header__brand-title">${esc(pick(site.exhibitionTitle))}</span>
          <span class="site-header__brand-subtitle">${esc(pick(site.exhibitionSubtitle))}</span>
        </span>
      </a>
      ${renderNav(site, path)}
    </div>
  </header>
  <main id="main" data-pagefind-body>
${content}
  </main>
  ${renderFooter(site)}${reload}
</body>
</html>
`;
}
