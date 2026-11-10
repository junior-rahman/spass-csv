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

/** Android save replies must always settle; a lost reply resolves false instead of hanging the UI. */
export const SAVE_TIMEOUT_MS = 60_000;

const androidPlatform = (b: WebMessageBridge): Platform => ({
  save(fileName, csv) {
    return new Promise((resolve) => {
      let settled = false;
      const settle = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        b.onmessage = null;
        resolve(ok);
      };
      const timer = setTimeout(() => settle(false), SAVE_TIMEOUT_MS);
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

const webPlatform: Platform = {
  async save(fileName, csv) {
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
