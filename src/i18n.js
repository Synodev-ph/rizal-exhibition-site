export const LOCALES = [
    { id: "en", label: "English", short: "EN", hreflang: "en", flag: "flag-en" },
];
export const DEFAULT_LOCALE = "en";
const LOCALE_IDS = new Set(LOCALES.map((l) => l.id));
let _locale = DEFAULT_LOCALE;
let _basePath = "/";
let _catalogs = { en: {} };
export function setSiteConfig(site) {
    _basePath = site.basePath || "/";
}
export function setCatalogs(catalogs) {
    _catalogs = catalogs;
}
export function setLocale(locale) {
    _locale = LOCALE_IDS.has(locale) ? locale : DEFAULT_LOCALE;
}
export function getLocale() {
    return _locale;
}
export function localePrefix(locale) {
    return locale === DEFAULT_LOCALE ? "" : `${locale}/`;
}
export function localeBasePath(locale) {
    return _basePath + localePrefix(locale);
}
export function hrefForLocale(href, locale) {
    if (!href || !href.startsWith("/"))
        return href;
    const rest = href.startsWith(_basePath)
        ? href.slice(_basePath.length)
        : href.replace(/^\//, "");
    return _basePath + localePrefix(locale) + rest;
}
export function localizeHref(href) {
    return hrefForLocale(href, _locale);
}
export function pick(value) {
    if (value == null)
        return "";
    if (typeof value === "string")
        return value;
    return value[_locale] ?? value.en ?? "";
}
export function t(key, params) {
    const table = _catalogs[_locale] ?? {};
    const en = _catalogs.en ?? {};
    let str = table[key] ?? en[key];
    if (str === undefined) {
        throw new Error(`i18n: missing catalog key "${key}" (not defined in en.json)`);
    }
    if (params) {
        str = str.replace(/\{(\w+)\}/g, (m, name) => name in params ? String(params[name]) : m);
    }
    return str;
}
export function alternates(baseUrl, path) {
    const origin = baseUrl.replace(/\/$/, "");
    const list = LOCALES.map((l) => ({
        hreflang: l.hreflang,
        href: origin + hrefForLocale(path, l.id),
    }));
    list.push({ hreflang: "x-default", href: origin + hrefForLocale(path, DEFAULT_LOCALE) });
    return list;
}
