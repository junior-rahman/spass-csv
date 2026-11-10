// @vitest-environment jsdom
// 2.0.24: credential fields must opt out of password-manager autofill (autocomplete="off",
// never "new-password"; data-1p-ignore / data-lpignore). Verbatim typing flags stay intact.
import { webcrypto } from "node:crypto";
import { mount } from "../src/ui/app";
import { TEST_PASSWORD, sampleSpass } from "./helpers";

Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });

const AUTOFILL = {
  autocomplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true"
};

function expectAutofillOff(el: Element, id: string) {
  expect([id, el.getAttribute("autocomplete"), el.getAttribute("data-1p-ignore"), el.getAttribute("data-lpignore")])
    .toEqual([id, AUTOFILL.autocomplete, AUTOFILL["data-1p-ignore"], AUTOFILL["data-lpignore"]]);
  expect(el.getAttribute("autocomplete")).not.toBe("new-password");
}

describe("credential fields opt out of autofill", () => {
  it("export password, username, website, password, and notes use autocomplete=off plus 1Password/LastPass ignore flags", async () => {
    document.body.innerHTML = '<main id="app"></main>';
    const root = document.getElementById("app")!;
    mount(root, { platform: { save: async () => true } });
    const input = root.querySelector<HTMLInputElement>("#spass-file")!;
    Object.defineProperty(input, "files", { value: [new File([await sampleSpass()], "Pass.spass")], configurable: true });
    input.dispatchEvent(new Event("change"));
    await vi.waitFor(() => expect(root.querySelector("#spass-password")).not.toBeNull());
    const pw = root.querySelector<HTMLInputElement>("#spass-password")!;
    expectAutofillOff(pw, "spass-password");
    expect([pw.getAttribute("autocapitalize"), pw.getAttribute("autocorrect")]).toEqual(["off", "off"]);

    pw.value = TEST_PASSWORD;
    pw.dispatchEvent(new Event("input"));
    root.querySelector<HTMLButtonElement>("[data-testid=convert]")!.click();
    await vi.waitFor(() => expect(root.querySelector("[data-testid=vault]")).not.toBeNull());
    root.querySelector<HTMLButtonElement>("[data-testid=browse-logins]")!.click();
    root.querySelector<HTMLButtonElement>("[data-testid=login]")!.click();

    for (const id of ["edit-username", "edit-url", "edit-password", "edit-notes"]) {
      const el = root.querySelector(`#${id}`)!;
      expectAutofillOff(el, id);
    }
    for (const id of ["edit-username", "edit-url", "edit-password"]) {
      const el = root.querySelector(`#${id}`)!;
      expect([id, el.getAttribute("autocapitalize"), el.getAttribute("autocorrect")]).toEqual([id, "off", "off"]);
    }
  });
});
