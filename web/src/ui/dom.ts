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

export function icon(name: string): HTMLElement {
  return el("span", { class: "icon", "aria-hidden": "true", "data-icon": name }, []);
}
