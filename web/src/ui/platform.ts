/** Android injects `passBridge` via WebViewCompat.addWebMessageListener, origin-gated to the asset host. */
interface WebMessageBridge {
  postMessage(message: string): void;
  onmessage: ((event: { data: string }) => void) | null;
}

export interface Platform {
  /** Resolves true only after the file was actually written. */
  save(fileName: string, csv: string): Promise<boolean>;
  /** Leave the app after the user confirmed "Leave and clear?" (Android: hand Back to the system). */
  leave?(): void;
}

function bridge(): WebMessageBridge | null {
  const candidate = (globalThis as unknown as { passBridge?: WebMessageBridge }).passBridge;
  return candidate && typeof candidate.postMessage === "function" ? candidate : null;
}

/**
 * Android save replies must always settle; a lost reply resolves false instead of hanging the UI.
 * The clock only runs while the page is visible: the system "Save to" picker hides the page, and a user may
 * take minutes there (pick a folder, rename). Once the page is visible again the reply is due quickly.
 */
export const SAVE_TIMEOUT_MS = 60_000;
export const SAVE_RETURN_TIMEOUT_MS = 15_000;

const androidPlatform = (b: WebMessageBridge): Platform => ({
  save(fileName, csv) {
    return new Promise((resolve) => {
      let settled = false;
      const doc = typeof document === "undefined" ? null : document;
      const onVisibility = () => {
        clearTimeout(timer);
        if (doc?.visibilityState === "visible") timer = setTimeout(() => settle(false), SAVE_RETURN_TIMEOUT_MS);
      };
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        doc?.removeEventListener("visibilitychange", onVisibility);
        b.onmessage = null;
        resolve(ok);
      };
      let timer = setTimeout(() => settle(false), SAVE_TIMEOUT_MS);
      doc?.addEventListener("visibilitychange", onVisibility);
      b.onmessage = (event) => {
        try {
          const reply = JSON.parse(event.data) as { type: string; ok: boolean };
          if (reply.type === "saved") settle(reply.ok === true);
        } catch {
          settle(false);
        }
      };
      b.postMessage(JSON.stringify({ type: "save", fileName, csv }));
    });
  },
  leave() {
    b.postMessage(JSON.stringify({ type: "leave" }));
  }
});

/** Android WebView without the save bridge (very old WebView): a blob download does nothing there. */
function isAndroidWebView(): boolean {
  return typeof navigator !== "undefined" && /; wv\)/.test(navigator.userAgent);
}

const webPlatform: Platform = {
  async save(fileName, csv) {
    if (isAndroidWebView()) return false;
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      return true;
    } catch {
      return false;
    }
  }
};

export function detectPlatform(): Platform {
  const b = bridge();
  return b ? androidPlatform(b) : webPlatform;
}
