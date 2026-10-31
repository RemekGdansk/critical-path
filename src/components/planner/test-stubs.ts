// Browser stand-ins shared by the planner's jsdom tests (Planner.test.ts,
// RenderCrashFallback.test.ts). Browser APIs only, never the domain. Not a test
// file and imported by no view, so it never reaches the bundle; it holds no
// class names, so Tailwind's scan of it adds nothing to the production CSS.
import { vi } from "vitest";

export interface Download {
  fileName: string;
  blob: Blob;
}

/**
 * Captures downloads into `downloads`. jsdom has no object URLs and would
 * navigate on an anchor click, so the download is captured instead. Call it in
 * `beforeEach` and the returned restore in `afterEach`.
 */
export function stubDownloads(downloads: Download[]): () => void {
  downloads.length = 0;
  const urlKeys = ["createObjectURL", "revokeObjectURL"] as const;
  const blobs = new Map<string, Blob>();
  const urlOriginals = urlKeys.map((key) => Object.getOwnPropertyDescriptor(URL, key));
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    value: (blob: Blob) => {
      const url = `blob:test/${blobs.size + 1}`;
      blobs.set(url, blob);
      return url;
    },
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    value: () => {
      // Nothing to release: the test URLs hold no resource.
    },
  });
  const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs.get(this.href);
    if (blob !== undefined) downloads.push({ fileName: this.download, blob });
  });
  return () => {
    anchorClick.mockRestore();
    urlKeys.forEach((key, index) => {
      const original = urlOriginals[index];
      if (original) Object.defineProperty(URL, key, original);
      else Reflect.deleteProperty(URL, key);
    });
  };
}

/**
 * jsdom implements no `showModal`: these stand in for the browser, setting the
 * `open` attribute that makes the dialog visible to role queries. Call it in
 * `beforeAll` and the returned restore in `afterAll`.
 */
export function stubDialog(): () => void {
  const dialogKeys = ["showModal", "close"] as const;
  const dialogOriginals = dialogKeys.map((key) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key));
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value(this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  return () => {
    dialogKeys.forEach((key, index) => {
      const original = dialogOriginals[index];
      if (original) Object.defineProperty(HTMLDialogElement.prototype, key, original);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    });
  };
}
