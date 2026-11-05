import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPlatform, SAVE_TIMEOUT_MS } from "../src/ui/platform";

describe("android save bridge", () => {
  afterEach(() => {
    delete (globalThis as { passBridge?: unknown }).passBridge;
    vi.useRealTimers();
  });

  it("resolves false when the bridge never replies", async () => {
    vi.useFakeTimers();
    (globalThis as { passBridge?: unknown }).passBridge = { postMessage: () => {}, onmessage: null };
    const p = detectPlatform().save("samsung-pass-google.csv", "a,b");
    vi.advanceTimersByTime(SAVE_TIMEOUT_MS);
    await expect(p).resolves.toBe(false);
  });

  it("resolves with the saved reply", async () => {
    const b: { postMessage: () => void; onmessage: ((e: { data: string }) => void) | null } = { postMessage: () => b.onmessage?.({ data: JSON.stringify({ type: "saved", ok: true }) }), onmessage: null };
    (globalThis as { passBridge?: unknown }).passBridge = b;
    await expect(detectPlatform().save("samsung-pass-google.csv", "a,b")).resolves.toBe(true);
  });
});
