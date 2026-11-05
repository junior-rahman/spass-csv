type Attrs = Record<string, string | boolean | ((event: Event) => void)>;

/** Builds DOM with textContent only. Never use innerHTML with export data. */
export function el(tag: string, attrs: Attrs = {}, children: (Node | string | null)[] = []): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "function") node.addEventListener(key.replace(/^on/, ""), value);
    else if (key === "class") node.className = String(value);
    else if (value === true) node.setAttribute(key, "");
    else if (value !== false) node.setAttribute(key, String(value));
  }
  for (const child of children) {
    if (child === null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

const SVG_NS = "http://www.w3.org/2000/svg";

/** Material icon paths (24x24), inlined because CSP forbids remote fonts. */
const ICON_PATHS: Record<string, string> = {
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z",
  more_vert: "M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z",
  folder: "M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z",
  visibility: "M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z",
  visibility_off: "M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z",
  delete: "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z",
};

export const ICON_NAMES = Object.keys(ICON_PATHS);

/** Inline SVG icon built via DOM (no innerHTML). Unknown names render an empty span. */
export function icon(name: string): HTMLElement {
  const span = el("span", { class: "icon", "aria-hidden": "true", "data-icon": name }, []);
  const d = ICON_PATHS[name];
  if (d) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("focusable", "false");
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.append(path);
    span.append(svg);
  }
  return span;
}

/** Spcc P-ring mark geometry (512x512). Shared by the app bar, favicon and launcher icons. */
export const P_RING = {
  field: "#3F4F3A",
  ink: "#F7F4EF",
  ring: "M196 196 A92 92 0 1 1 268 300 H244",
  stem: "M244 300 V400",
  bars: [176, 216, 256],
};

/** Inline P-ring squircle mark, built via createElementNS (CSP-safe, no innerHTML). */
export function pRingMark(size = 56): HTMLElement {
  const span = el("span", { class: "mark", "data-mark": "p-ring", role: "img", "aria-label": "Spcc logo" }, []);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 512 512");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("focusable", "false");
  svg.setAttribute("aria-hidden", "true");
  const mk = (tag: string, attrs: Record<string, string>) => {
    const n = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    svg.append(n);
  };
  mk("rect", { width: "512", height: "512", rx: "128", fill: P_RING.field });
  mk("path", { d: P_RING.ring, fill: "none", stroke: P_RING.ink, "stroke-width": "40", "stroke-linecap": "butt" });
  mk("path", { d: P_RING.stem, fill: "none", stroke: P_RING.ink, "stroke-width": "40" });
  for (const y of P_RING.bars) mk("rect", { x: "136", y: String(y), width: "88", height: "22", fill: P_RING.ink });
  span.append(svg);
  return span;
}
