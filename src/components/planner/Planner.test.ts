// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { Planner } from "@/components/planner/Planner";
import { serializeProject } from "@/lib/services/project-file";
import {
  createEmptyProject,
  createTask,
  type EditResult,
  setDuration,
  setStartDate,
  validateProject,
} from "@/lib/services/project";
import type { Project } from "@/types";

/** Every property the shim below replaces, restored in `afterAll` so it never outlives this file. */
const shimmed: [object, string][] = [
  [globalThis, "ResizeObserver"],
  [globalThis, "DOMMatrixReadOnly"],
  [HTMLElement.prototype, "offsetHeight"],
  [HTMLElement.prototype, "offsetWidth"],
  [SVGElement.prototype, "getBBox"],
];
let originals: (PropertyDescriptor | undefined)[] = [];

/**
 * React Flow's documented jsdom shim: jsdom has no layout, so React Flow
 * measures nothing and renders no node without it. Applied in this file only.
 */
beforeAll(() => {
  originals = shimmed.map(([target, key]) => Object.getOwnPropertyDescriptor(target, key));

  class ResizeObserverShim {
    constructor(private readonly callback: ResizeObserverCallback) {}
    // Fires once per observed element, so React Flow measures each node. React
    // Flow 12 also reads the pane's size from `contentRect`, which the shim in
    // its docs omits; it is taken from the shimmed offset size below.
    observe(target: Element) {
      const { offsetWidth: width, offsetHeight: height } = target as HTMLElement;
      this.callback([{ target, contentRect: { width, height } } as ResizeObserverEntry], this);
    }
    unobserve() {
      // Nothing to stop: the shim never observes over time.
    }
    disconnect() {
      // Nothing to stop: the shim never observes over time.
    }
  }

  class DOMMatrixReadOnlyShim {
    m22: number;
    constructor(transform?: string) {
      const scale = transform?.match(/scale\(([1-9.])\)/)?.[1];
      this.m22 = scale === undefined ? 1 : Number(scale);
    }
  }

  globalThis.ResizeObserver = ResizeObserverShim;
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyShim as unknown as typeof DOMMatrixReadOnly;
  Object.defineProperties(HTMLElement.prototype, {
    offsetHeight: {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.height) || 1;
      },
    },
    offsetWidth: {
      configurable: true,
      get(this: HTMLElement) {
        return Number.parseFloat(this.style.width) || 1;
      },
    },
  });
  // On SVGElement, as React Flow's shim has it; TypeScript types getBBox on SVGGraphicsElement only.
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
});

afterAll(() => {
  shimmed.forEach(([target, key], index) => {
    const original = originals[index];
    if (original) Object.defineProperty(target, key, original);
    else Reflect.deleteProperty(target, key);
  });
});

afterEach(() => {
  cleanup();
});

function accepted(result: EditResult): Project {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

const A_ID = 1;

/** START 2999-01-01 (far ahead of any real today), A (id 1, 5 days) and B (id 2, 3 days), independent. */
function fixture(): Project {
  const withA = accepted(setDuration(accepted(createTask(createEmptyProject(), "A")), A_ID, "5"));
  const withB = accepted(setDuration(accepted(createTask(withA, "B")), 2, "3"));
  return accepted(setStartDate(withB, "2999-01-01"));
}

function renderPlanner(): void {
  // Explicit props type: Planner's props parameter is optional, which createElement cannot infer.
  render(
    createElement<NonNullable<Parameters<typeof Planner>[0]>>(Planner, {
      initialProject: fixture(),
      initialSelection: A_ID,
    }),
  );
}

/** The forecast's live region, told apart from any other status region by its content. */
function forecastRegion(): HTMLElement {
  const regions = screen
    .getAllByRole("status")
    .filter((region) => /Project Finish Date|Validation Warning|Forecast not possible/.test(region.textContent));
  expect(regions).toHaveLength(1);
  return regions[0];
}

/** The region's text nodes joined by spaces, so a label and its value read as one phrase. */
function textOf(region: HTMLElement): string {
  const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
  const parts: string[] = [];
  while (walker.nextNode()) parts.push(walker.currentNode.nodeValue ?? "");
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Commits a Duration draft the way the panel does: typed, then blurred. */
function commitDuration(value: string): void {
  const field = screen.getByLabelText("Duration (days)");
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

describe("Planner: the forecast follows the committed project", () => {
  it("renders the Task nodes on the diagram by their accessible names", async () => {
    renderPlanner();

    expect(await screen.findByRole("button", { name: "A, 5 days" })).toBeDefined();
    expect(await screen.findByRole("button", { name: "B, 3 days" })).toBeDefined();
  });

  it("withholds both Project Finish Dates while A lacks a Duration, then shows new ones once it has one", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: "A, 5 days" });

    const dated = textOf(forecastRegion());
    expect(dated).toContain("Resource-Unconstrained Project Finish Date 2999-01-06");
    expect(dated).toContain("Resource-Constrained Project Finish Date 2999-01-09");

    commitDuration("");

    const withheld = forecastRegion();
    expect(textOf(withheld)).toContain("Validation Warning");
    expect(textOf(withheld)).toContain("Forecast not possible");
    expect(textOf(withheld)).not.toContain("Project Finish Date");
    // Over the whole markup, so a date in an attribute such as `dateTime` counts too.
    expect(withheld.outerHTML).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(await screen.findByRole("button", { name: "A, no Duration (Validation Warning)" })).toBeDefined();

    commitDuration("7");

    const restored = textOf(forecastRegion());
    expect(restored).toContain("Resource-Unconstrained Project Finish Date 2999-01-08");
    expect(restored).toContain("Resource-Constrained Project Finish Date 2999-01-11");
    expect(restored).not.toContain("2999-01-06");
    expect(restored).not.toContain("2999-01-09");
    expect(restored).not.toContain("Forecast not possible");
    expect(await screen.findByRole("button", { name: "A, 7 days" })).toBeDefined();
  });

  it("names the rule for a rejected Duration and keeps every committed view on the previous project", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: "A, 5 days" });

    commitDuration("0");

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("A Duration must be a positive whole number of days.")).toBeDefined();
    expect(alert.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(await screen.findByRole("button", { name: "A, 5 days" })).toBeDefined();
    const forecast = textOf(forecastRegion());
    expect(forecast).toContain("Resource-Unconstrained Project Finish Date 2999-01-06");
    expect(forecast).toContain("Resource-Constrained Project Finish Date 2999-01-09");
  });

  it("recomputes both Project Finish Dates and shows weekday units once Day counting is switched to Weekdays", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: "A, 5 days" });

    fireEvent.change(screen.getByLabelText("Day counting"), { target: { value: "weekdays" } });

    // START Tue 2999-01-01: A (5 weekdays) skips Sat 5 and Sun 6; with no parallelism, B (3) runs after A, to Fri 2999-01-11.
    const weekdays = textOf(forecastRegion());
    expect(weekdays).toContain("Resource-Unconstrained Project Finish Date 2999-01-08");
    expect(weekdays).toContain("Resource-Constrained Project Finish Date 2999-01-11");
    expect(weekdays).not.toContain("2999-01-06");
    expect(weekdays).not.toContain("2999-01-09");
    expect(await screen.findByRole("button", { name: "A, 5 weekdays" })).toBeDefined();
    expect(screen.getByLabelText("Duration (weekdays)")).toBeDefined();
  });
});

/**
 * A (id 1) depends on B (id 2) and B on A, START 2999-01-01. Built by hand, not
 * through the edit functions, which would reject the cycle: it stands for a
 * project that makes a render throw (`forecast()` throws "The project contains
 * a cycle." for it), the way a too-long imported chain does in the browser.
 */
function cyclicProject(name: string | undefined): Project {
  return {
    ...(name === undefined ? {} : { name }),
    start: { date: "2999-01-01" },
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: 3,
    tasks: [
      { id: 1, name: "A", predecessors: [2], duration: 5, status: "to-do" },
      { id: 2, name: "B", predecessors: [1], duration: 3, status: "to-do" },
    ],
  };
}

describe("Planner: a render crash keeps the project exportable", () => {
  // Browser APIs only, never the domain: jsdom has no object URLs and would
  // navigate on an anchor click, so the download is captured instead.
  const downloads: { fileName: string; blob: Blob }[] = [];
  const urlKeys = ["createObjectURL", "revokeObjectURL"] as const;
  let urlOriginals: (PropertyDescriptor | undefined)[] = [];
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    downloads.length = 0;
    const blobs = new Map<string, Blob>();
    urlOriginals = urlKeys.map((key) => Object.getOwnPropertyDescriptor(URL, key));
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
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      const blob = blobs.get(this.href);
      if (blob !== undefined) downloads.push({ fileName: this.download, blob });
    });
    // Silenced: React and the planner both report the crash on the console.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    urlKeys.forEach((key, index) => {
      const original = urlOriginals[index];
      if (original) Object.defineProperty(URL, key, original);
      else Reflect.deleteProperty(URL, key);
    });
  });

  function renderCrashing(project: Project): void {
    render(createElement<NonNullable<Parameters<typeof Planner>[0]>>(Planner, { initialProject: project }));
  }

  it("shows the error in place of the planner, exports the project as it was and logs it", async () => {
    const project = cyclicProject("Cyclic plan");
    renderCrashing(project);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Error: The project contains a cycle.");
    expect(screen.queryByRole("textbox", { name: "New Task" })).toBeNull();

    fireEvent.click(within(alert).getByRole("button", { name: "Export the project as it was" }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].fileName).toBe("Cyclic plan.json");
    expect(await downloads[0].blob.text()).toBe(serializeProject(project));

    const validationError = validateProject(project);
    expect(validationError).toBeDefined();
    expect(alert.textContent).toContain("Validation Error");
    expect(alert.textContent).toContain(validationError?.message);
    expect(alert.textContent).not.toMatch(/invalid|conflict|blocked/i);

    expect(screen.queryByRole("button", { name: "Go back to the project before the last change" })).toBeNull();

    expect(consoleError).toHaveBeenCalledWith(
      "Critical Path: the planner crashed while rendering.",
      expect.objectContaining({ message: "The project contains a cycle." }),
      expect.objectContaining({ project: expect.stringContaining(serializeProject(project)) as unknown }),
    );
  });

  it("names the recovery file critical-path-recovered.json when the project has no name", () => {
    renderCrashing(cyclicProject(undefined));

    fireEvent.click(screen.getByRole("button", { name: "Export the project as it was" }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].fileName).toBe("critical-path-recovered.json");
  });

  it("still shows the fallback, with the reason, when the project cannot even be checked for Validation Errors", async () => {
    // A shape no Project type allows (a Task name that is not a string), as only
    // an import-parser bug could produce: `validateProject` itself throws on it.
    const malformed = cyclicProject("Malformed plan");
    const project: Project = {
      ...malformed,
      tasks: malformed.tasks.map((task) => (task.id === 1 ? { ...task, name: null as unknown as string } : task)),
    };
    expect(() => validateProject(project)).toThrow(TypeError);
    renderCrashing(project);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("The project could not be checked for Validation Errors: TypeError:");
    fireEvent.click(within(alert).getByRole("button", { name: "Export the project as it was" }));
    expect(downloads).toHaveLength(1);
    expect(await downloads[0].blob.text()).toBe(serializeProject(project));
  });
});
