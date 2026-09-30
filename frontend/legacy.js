/** Fixed compatibility routes; legacy scores, identities and NFC secrets are discarded. */
export const LEGACY_ROUTES = Object.freeze({
  "daily.html": "home",
  "test.html": "talents",
  "result.html": "talents",
  "thumb.html": "fingerprint",
  "island.html": "explore",
  "blindbox.html": "explore",
  "report.html": "reports",
});

export function legacyTarget(href, currentOrigin) {
  let source;
  try {
    source = new URL(href);
    if (!["http:", "https:"].includes(source.protocol)) return null;
    if (currentOrigin && source.origin !== new URL(currentOrigin).origin)
      return null;
  } catch {
    return null;
  }
  const page = source.pathname.split("/").pop();
  if (!Object.hasOwn(LEGACY_ROUTES, page)) return null;
  const route = LEGACY_ROUTES[page];
  const target = new URL("index.html", source);
  target.search = "";
  target.hash = route;
  return target.href;
}

if (typeof window !== "undefined") {
  const target = legacyTarget(window.location.href, window.location.origin);
  if (target) window.location.replace(target);
}
