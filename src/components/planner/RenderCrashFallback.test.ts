// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RenderCrashFallback } from "@/components/planner/RenderCrashFallback";
import { createEmptyProject, type CheckedProject } from "@/lib/services/project";
import { serializeProject } from "@/lib/services/project-file";
import type { Project } from "@/types";

afterEach(() => {
  cleanup();
});

/**
 * A (id 1) depends on B (id 2) and B on A, START 2999-01-01. Built by hand, not
 * through the edit functions, which would reject the cycle: it stands for the
 * project a render threw on. A previous project plus a render throw cannot be
 * reached through `Planner` in jsdom without mocking the domain, so the
 * fallback is rendered directly with it.
 */
function cyclicProject(): CheckedProject {
  return {
    name: "Cyclic plan",
    start: { date: "2999-01-01" },
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: 3,
    tasks: [
      { id: 1, name: "A", predecessors: [2], duration: 5, status: "to-do" },
      { id: 2, name: "B", predecessors: [1], duration: 3, status: "to-do" },
    ],
  } as CheckedProject;
}

interface Download {
  fileName: string;
  blob: Blob;
}

/**
 * Captures downloads into `downloads`. Browser APIs only, never the domain:
 * jsdom has no object URLs and would navigate on an anchor click, so the
 * download is captured instead. Returns the restore.
 */
function stubDownloads(downloads: Download[]): () => void {
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

describe("RenderCrashFallback: Go back asks before it discards unexported changes", () => {
  // jsdom implements no showModal: these stand in for the browser, setting the
  // `open` attribute that makes the dialog visible to role queries.
  const dialogKeys = ["showModal", "close"] as const;
  let dialogOriginals: (PropertyDescriptor | undefined)[] = [];
  const downloads: Download[] = [];
  let restoreDownloads: () => void;

  beforeAll(() => {
    dialogOriginals = dialogKeys.map((key) => Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key));
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
  });

  afterAll(() => {
    dialogKeys.forEach((key, index) => {
      const original = dialogOriginals[index];
      if (original) Object.defineProperty(HTMLDialogElement.prototype, key, original);
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
    });
  });

  beforeEach(() => {
    restoreDownloads = stubDownloads(downloads);
  });

  afterEach(() => {
    restoreDownloads();
  });

  const TITLE = "Discard unexported changes?";
  const GO_BACK = "Go back to the project before the last change";

  type FallbackProps = Parameters<typeof RenderCrashFallback>[0];

  /** The fallback over the cyclic project, with a previous project to go back to and recording callbacks. */
  function renderFallback(unexported: boolean) {
    const project = cyclicProject();
    const onGoBack = vi.fn<() => void>();
    const onExported = vi.fn<(exported: Project) => void>();
    const hasUnexportedChanges = vi.fn(() => unexported);
    render(
      createElement<FallbackProps>(RenderCrashFallback, {
        error: new Error("The project contains a cycle."),
        project,
        previousProject: createEmptyProject(),
        onGoBack,
        hasUnexportedChanges,
        onExported,
      }),
    );
    return { project, onGoBack, onExported, hasUnexportedChanges };
  }

  function goBackButton(): HTMLElement {
    return screen.getByRole("button", { name: GO_BACK });
  }

  it("opens the dialog over unexported changes, and Cancel goes nowhere and focuses Go back", () => {
    const { onGoBack, hasUnexportedChanges } = renderFallback(true);
    // The check runs on click only, never while rendering.
    expect(hasUnexportedChanges).not.toHaveBeenCalled();

    fireEvent.click(goBackButton());

    const dialog = screen.getByRole("dialog", { name: TITLE });
    expect(dialog.textContent).toContain(
      "The project the planner stopped on has changes that were not exported. Going back discards them. Export it first to keep them.",
    );
    expect(dialog.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onGoBack).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onGoBack).toHaveBeenCalledTimes(0);
    expect(document.activeElement).toBe(goBackButton());
  });

  it("goes back once discarding is confirmed", () => {
    const { onGoBack } = renderFallback(true);
    fireEvent.click(goBackButton());

    fireEvent.click(screen.getByRole("button", { name: "Discard and go back" }));

    expect(onGoBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("goes back at once, with no dialog, when there are no unexported changes", () => {
    const { onGoBack, hasUnexportedChanges } = renderFallback(false);

    fireEvent.click(goBackButton());

    expect(hasUnexportedChanges).toHaveBeenCalledTimes(1);
    expect(onGoBack).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("reports the exported project once its download has started", async () => {
    const { project, onExported, onGoBack } = renderFallback(true);

    fireEvent.click(screen.getByRole("button", { name: "Export the project as it was" }));

    expect(downloads).toHaveLength(1);
    expect(downloads[0].fileName).toBe("Cyclic plan.json");
    expect(await downloads[0].blob.text()).toBe(serializeProject(project));
    expect(onExported).toHaveBeenCalledTimes(1);
    expect(onExported).toHaveBeenCalledWith(project);
    expect(onGoBack).not.toHaveBeenCalled();
  });
});
