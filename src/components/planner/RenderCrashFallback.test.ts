// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { RenderCrashFallback } from "@/components/planner/RenderCrashFallback";
import { type Download, stubDialog, stubDownloads } from "@/components/planner/test-stubs";
import { createEmptyProject, type CheckedProject, type EditContext } from "@/lib/services/project";
import { serializeProject } from "@/lib/services/project-file";
import type { Project } from "@/types";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

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

describe("RenderCrashFallback: Go back asks before it discards unexported changes", () => {
  const downloads: Download[] = [];
  let restoreDownloads: () => void;
  let restoreDialog: () => void;

  beforeAll(() => {
    restoreDialog = stubDialog();
  });

  afterAll(() => {
    restoreDialog();
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
        previousProject: createEmptyProject(CONTEXT),
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
