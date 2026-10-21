import { enterDocumentFullscreen } from "@/lib/fullscreen";

describe("enterDocumentFullscreen", () => {
  afterEach(() => {
    delete (document as Document & { webkitFullscreenElement?: Element | null }).webkitFullscreenElement;
    delete (document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void | Promise<void> }).webkitRequestFullscreen;
    delete (document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> }).requestFullscreen;
  });

  it("waits for legacy fullscreen change events before confirming entry", async () => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    Object.defineProperty(doc, "webkitFullscreenElement", { configurable: true, writable: true, value: null });
    const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    root.webkitRequestFullscreen = () => {
      setTimeout(() => {
        doc.webkitFullscreenElement = root;
        document.dispatchEvent(new Event("webkitfullscreenchange"));
      }, 0);
    };

    await expect(enterDocumentFullscreen()).resolves.toBeUndefined();
  });

  it("keeps fullscreen rejection actionable", async () => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
    root.requestFullscreen = jest.fn().mockRejectedValue(new Error("Fullscreen denied"));

    await expect(enterDocumentFullscreen()).rejects.toThrow("Fullscreen denied");
  });

  it("rejects when the browser resolves without entering fullscreen", async () => {
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
    const root = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
    root.requestFullscreen = jest.fn().mockResolvedValue(undefined);

    await expect(enterDocumentFullscreen()).rejects.toThrow("Fullscreen is required");
  });
});
