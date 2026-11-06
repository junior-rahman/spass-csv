// @vitest-environment jsdom
import { mount } from "../src/ui/app";
import { icon, ICON_NAMES } from "../src/ui/dom";

describe("icons render as inline SVG (CSP blocks icon fonts)", () => {
  it("icon('lock') has an svg child and keeps hooks", () => {
    const node = icon("lock");
    expect(node.className).toBe("icon");
    expect(node.getAttribute("aria-hidden")).toBe("true");
    expect(node.dataset.icon).toBe("lock");
    const svg = node.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg!.querySelector("path")?.getAttribute("d")).toBeTruthy();
  });

  it("every used icon name has a path", () => {
    for (const name of ["more_vert", "folder", "visibility", "visibility_off", "delete", "close", "chevron_right", "check", "description", "credit_card", "notes", "home"]) {
      expect(ICON_NAMES).toContain(name);
      expect(icon(name).querySelector("svg path")).not.toBeNull();
    }
  });

  it("every .icon-btn after mount contains an svg", () => {
    document.body.innerHTML = '<main id="app"></main>';
    const root = document.getElementById("app")!;
    mount(root, { platform: { save: async () => true } });
    const buttons = root.querySelectorAll(".icon-btn");
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach((b) => expect(b.querySelector(".icon svg path")).not.toBeNull());
  });
});
