// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { installFlowJsdomShim, restoreFlowJsdomShim } from "@/components/planner/diagram/flow-jsdom-shim";
import { Planner } from "@/components/planner/Planner";
import { type Download, stubDialog, stubDownloads } from "@/components/planner/test-stubs";
import { serializeProject } from "@/lib/services/project-file";
import {
  addPredecessor,
  type CheckedProject,
  createEmptyProject,
  createTask,
  type EditContext,
  type EditResult,
  setCompletionDate,
  setDuration,
  setProjectName,
  setStartDate,
  setStatus,
  validateProject,
} from "@/lib/services/project";

const TODAY = "2026-09-05";
const CONTEXT: EditContext = { today: TODAY };

// React Flow's jsdom shim, applied for this file only.
beforeAll(() => {
  installFlowJsdomShim();
});

afterAll(() => {
  restoreFlowJsdomShim();
});

afterEach(() => {
  cleanup();
});

function accepted(result: EditResult): CheckedProject {
  if (!result.ok)
    throw new Error(`Expected the edit to be accepted, got ${result.error.rule}: ${result.error.message}`);
  return result.project;
}

const A_ID = 1;

/** START 2999-01-01 (far ahead of any real today), A (id 1, 5 days) and B (id 2, 3 days), independent: A alone is the critical path. */
function fixture(): CheckedProject {
  const withA = accepted(
    setDuration(accepted(createTask(createEmptyProject(CONTEXT), "A", CONTEXT)), A_ID, "5", CONTEXT),
  );
  const withB = accepted(setDuration(accepted(createTask(withA, "B", CONTEXT)), 2, "3", CONTEXT));
  return accepted(setStartDate(withB, "2999-01-01", CONTEXT));
}

type PlannerProps = NonNullable<Parameters<typeof Planner>[0]>;

function renderPlanner(selection: PlannerProps["initialSelection"] = A_ID, project: CheckedProject = fixture()): void {
  // Explicit props type: Planner's props parameter is optional, which createElement cannot infer.
  render(createElement<PlannerProps>(Planner, { initialProject: project, initialSelection: selection }));
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

    expect(await screen.findByRole("button", { name: "A, 5 days, on the critical path" })).toBeDefined();
    expect(await screen.findByRole("button", { name: "B, 3 days" })).toBeDefined();
  });

  it("withholds both Project Finish Dates while A lacks a Duration, then shows new ones once it has one", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: "A, 5 days, on the critical path" });

    const dated = textOf(forecastRegion());
    expect(dated).toContain("Resource-Unconstrained Project Finish Date 2999-01-06");
    expect(dated).toContain("Resource-Constrained Project Finish Date 2999-01-09");
    // A (5) alone is the longest chain; all work is A (5) + B (3) = 8.
    expect(dated).toContain("Critical-path time 5 days · Total-work time 8 days");

    commitDuration("");

    const withheld = forecastRegion();
    expect(textOf(withheld)).toContain("Validation Warning");
    expect(textOf(withheld)).toContain("Forecast not possible until every Task that is not Done has one.");
    expect(textOf(withheld)).not.toContain("Project Finish Date");
    // Over the whole markup, so a date in an attribute such as `dateTime` counts too.
    expect(withheld.outerHTML).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(textOf(withheld)).not.toContain("Critical-path time");
    expect(textOf(withheld)).not.toContain("Total-work time");
    expect(await screen.findByRole("button", { name: "A, no Duration (Validation Warning)" })).toBeDefined();
    expect(screen.queryByRole("button", { name: /on the critical path/ })).toBeNull();

    commitDuration("7");

    const restored = textOf(forecastRegion());
    expect(restored).toContain("Resource-Unconstrained Project Finish Date 2999-01-08");
    expect(restored).toContain("Resource-Constrained Project Finish Date 2999-01-11");
    expect(restored).not.toContain("2999-01-06");
    expect(restored).not.toContain("2999-01-09");
    expect(restored).not.toContain("Forecast not possible");
    // A (7) alone is the longest chain; all work is A (7) + B (3) = 10.
    expect(restored).toContain("Critical-path time 7 days · Total-work time 10 days");
    expect(restored).not.toContain("5 days");
    expect(restored).not.toContain("8 days");
    expect(await screen.findByRole("button", { name: "A, 7 days, on the critical path" })).toBeDefined();
  });

  it("names the rule for a rejected Duration and keeps every committed view on the previous project", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: "A, 5 days, on the critical path" });

    commitDuration("0");

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText("A Duration must be a positive whole number of days.")).toBeDefined();
    expect(alert.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(await screen.findByRole("button", { name: "A, 5 days, on the critical path" })).toBeDefined();
    const forecast = textOf(forecastRegion());
    expect(forecast).toContain("Resource-Unconstrained Project Finish Date 2999-01-06");
    expect(forecast).toContain("Resource-Constrained Project Finish Date 2999-01-09");
  });

  it("recomputes both Project Finish Dates and shows weekday units once Day counting is switched to Weekdays", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: "A, 5 days, on the critical path" });

    fireEvent.change(screen.getByLabelText("Day counting"), { target: { value: "weekdays" } });

    // START Tue 2999-01-01: A (5 weekdays) skips Sat 5 and Sun 6; with no parallelism, B (3) runs after A, to Fri 2999-01-11.
    const weekdays = textOf(forecastRegion());
    expect(weekdays).toContain("Resource-Unconstrained Project Finish Date 2999-01-08");
    expect(weekdays).toContain("Resource-Constrained Project Finish Date 2999-01-11");
    expect(weekdays).not.toContain("2999-01-06");
    expect(weekdays).not.toContain("2999-01-09");
    expect(await screen.findByRole("button", { name: "A, 5 weekdays, on the critical path" })).toBeDefined();
    expect(screen.getByLabelText("Duration (weekdays)")).toBeDefined();
  });
});

/**
 * START 2026-09-01, A (id 1) Done on 2026-09-03 → B (id 2, 3 days), To Do or
 * Done on 2026-09-04. A past START date, as any Done project needs, so these
 * tests assert only clock-free text: Planner reads the real clock for the
 * edits, the Completion date's max and the forecast.
 */
function doneFixture(bDone: boolean): CheckedProject {
  const created = accepted(
    setDuration(
      accepted(createTask(accepted(createTask(createEmptyProject(CONTEXT), "A", CONTEXT)), "B", CONTEXT)),
      2,
      "3",
      CONTEXT,
    ),
  );
  const dated = accepted(setStartDate(accepted(addPredecessor(created, 2, A_ID, CONTEXT)), "2026-09-01", CONTEXT));
  const doneA = accepted(
    setCompletionDate(accepted(setStatus(dated, A_ID, "done", CONTEXT)), A_ID, "2026-09-03", CONTEXT),
  );
  return bDone
    ? accepted(setCompletionDate(accepted(setStatus(doneA, 2, "done", CONTEXT)), 2, "2026-09-04", CONTEXT))
    : doneA;
}

/** A's node: Done, so named by its completion date, neither warned for its missing Duration nor on the critical path. */
const A_DONE_NODE = "A, Done on 2026-09-03";

function statusSelect(): HTMLSelectElement {
  return screen.getByLabelText<HTMLSelectElement>("Status");
}

function completionDateField(): HTMLInputElement | null {
  return screen.queryByLabelText<HTMLInputElement>("Completion date");
}

/** Types a Completion date draft and commits it on blur; the key press first, so the typed-draft path is taken. */
function commitCompletionDate(value: string): void {
  const field = completionDateField();
  if (field === null) throw new Error("Expected the Completion date field");
  fireEvent.keyDown(field, { key: "2" });
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
}

// The committed Status and completion date are read from both the Diagram node
// name and the panel: the Status select shows the committed Status, and Escape
// restores the committed completion date. A completion date of today is
// asserted only by its clock-free prefix, since Planner reads the real clock.
describe("Planner: Status and completion date", () => {
  it("shows a Done Task's Status and completion date in the panel", async () => {
    renderPlanner(A_ID, doneFixture(false));
    await screen.findByRole("button", { name: A_DONE_NODE });

    expect(statusSelect().value).toBe("done");
    expect(completionDateField()?.value).toBe("2026-09-03");
    expect(completionDateField()?.min).toBe("2026-09-01");
  });

  it("names the after-today rule for a completion date in the future and keeps the committed date", async () => {
    renderPlanner(A_ID, doneFixture(false));
    await screen.findByRole("button", { name: A_DONE_NODE });

    commitCompletionDate("2999-01-01");

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Task 1: A has the completion date 2999-01-01, which is after today");
    expect(alert.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(statusSelect().value).toBe("done");
    expect(await screen.findByRole("button", { name: A_DONE_NODE })).toBeDefined();
    const field = completionDateField();
    if (field === null) throw new Error("Expected the Completion date field");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field.value).toBe("2026-09-03");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refuses to revert A to To Do while its successor B is Done, naming B, and keeps A Done", async () => {
    renderPlanner(A_ID, doneFixture(true));
    await screen.findByRole("button", { name: A_DONE_NODE });

    fireEvent.change(statusSelect(), { target: { value: "to-do" } });

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Task 2: B cannot be Done while its predecessor 1: A is not Done.");
    expect(statusSelect().value).toBe("done");
    expect(completionDateField()?.value).toBe("2026-09-03");
    expect(await screen.findByRole("button", { name: A_DONE_NODE })).toBeDefined();
  });

  it("marks a To Do Task Done with today's date in the field, and removes the date once it leaves Done", async () => {
    renderPlanner(2, doneFixture(false));
    await screen.findByRole("button", { name: /^B, 3 days/ });
    expect(completionDateField()).toBeNull();

    fireEvent.change(statusSelect(), { target: { value: "done" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(statusSelect().value).toBe("done");
    // The real today, so only its shape is asserted; the draft follows the committed date.
    const field = completionDateField();
    if (field === null) throw new Error("Expected the Completion date field");
    expect(field.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Two clock reads (the edit's and the render's max), so midnight may fall between them.
    expect(field.value <= field.max).toBe(true);
    // The same real today, so only the clock-free prefix of the node name.
    expect(await screen.findByRole("button", { name: /^B, Done on / })).toBeDefined();

    fireEvent.change(statusSelect(), { target: { value: "in-progress" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(statusSelect().value).toBe("in-progress");
    expect(completionDateField()).toBeNull();
    // A is Done, so B is the only remaining work, and on the critical path.
    expect(await screen.findByRole("button", { name: "B, 3 days, In Progress, on the critical path" })).toBeDefined();
  });

  it("clears a Status refusal once removing the predecessor it named makes the Status possible", async () => {
    const withC = accepted(createTask(doneFixture(false), "C", CONTEXT));
    renderPlanner(2, accepted(addPredecessor(withC, 2, 3, CONTEXT)));
    await screen.findByRole("button", { name: /^B, 3 days/ });

    fireEvent.change(statusSelect(), { target: { value: "done" } });
    expect(screen.getByRole("alert").textContent).toContain("3: C");
    expect(statusSelect().value).toBe("to-do");

    fireEvent.click(screen.getByRole("button", { name: "Remove predecessor 3: C" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  // A closed select fires `change` on arrow keys, so browsing past Done and back is two edits.
  it("restores A's backdated completion date when A leaves Done and comes back in the same panel", async () => {
    renderPlanner(A_ID, doneFixture(false));
    await screen.findByRole("button", { name: A_DONE_NODE });

    fireEvent.change(statusSelect(), { target: { value: "in-progress" } });
    expect(completionDateField()).toBeNull();
    fireEvent.change(statusSelect(), { target: { value: "done" } });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(statusSelect().value).toBe("done");
    expect(completionDateField()?.value).toBe("2026-09-03");
    expect(await screen.findByRole("button", { name: A_DONE_NODE })).toBeDefined();
  });

  // jsdom never sets `validity.badInput` and sanitizes "2026-02-30" to "", so it is stubbed as Chromium reports it.
  it("names the completion date rule for an unreadable date and keeps the committed date", async () => {
    renderPlanner(A_ID, doneFixture(false));
    await screen.findByRole("button", { name: A_DONE_NODE });
    const field = completionDateField();
    if (field === null) throw new Error("Expected the Completion date field");

    fireEvent.keyDown(field, { key: "2" });
    Object.defineProperty(field, "validity", { configurable: true, value: { badInput: true } });
    fireEvent.change(field, { target: { value: "2026-02-30" } });
    fireEvent.blur(field);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("A completion date must be a calendar date from 0001-01-01 to 9999-12-31.");
    expect(statusSelect().value).toBe("done");
    fireEvent.keyDown(field, { key: "Escape" });
    expect(field.value).toBe("2026-09-03");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // Escape restores the committed date, so a date it leaves in place was committed.
  it("commits a date picked from the calendar at once, with no blur or Enter", async () => {
    renderPlanner(A_ID, doneFixture(false));
    await screen.findByRole("button", { name: A_DONE_NODE });
    const field = completionDateField();
    if (field === null) throw new Error("Expected the Completion date field");

    fireEvent.pointerDown(field);
    fireEvent.change(field, { target: { value: "2026-09-02" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(field.value).toBe("2026-09-02");
  });

  it("commits a typed date on Enter", async () => {
    renderPlanner(A_ID, doneFixture(false));
    await screen.findByRole("button", { name: A_DONE_NODE });
    const field = completionDateField();
    if (field === null) throw new Error("Expected the Completion date field");

    fireEvent.keyDown(field, { key: "2" });
    fireEvent.change(field, { target: { value: "2026-09-02" } });
    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(field.value).toBe("2026-09-02");
  });
});

const START_DATE_MESSAGE = "The START date must be a calendar date from 0001-01-01 to 9999-12-31.";

/**
 * Types a START date draft and commits it by Enter or blur. The key press comes
 * first, so the change takes the typed-draft path. With `badInput`, `validity`
 * is stubbed as Chromium reports an impossible date: jsdom never sets it, and
 * sanitizes "2026-02-30" to "", the value Chromium reports too.
 */
function commitStartDate(value: string, by: "Enter" | "blur", { badInput }: { badInput: boolean }): void {
  const field = screen.getByLabelText("START date");
  fireEvent.keyDown(field, { key: "2" });
  if (badInput) Object.defineProperty(field, "validity", { configurable: true, value: { badInput: true } });
  fireEvent.change(field, { target: { value } });
  if (by === "Enter") fireEvent.keyDown(field, { key: "Enter" });
  else fireEvent.blur(field);
}

describe("Planner: an unreadable START date keeps the previous one", () => {
  it("names the START date rule and keeps every committed view on the set START date", async () => {
    renderPlanner("start");
    await screen.findByRole("button", { name: "START, 2999-01-01" });

    commitStartDate("2026-02-30", "Enter", { badInput: true });

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(START_DATE_MESSAGE)).toBeDefined();
    expect(alert.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(await screen.findByRole("button", { name: "START, 2999-01-01" })).toBeDefined();
    const forecast = textOf(forecastRegion());
    expect(forecast).toContain("Resource-Unconstrained Project Finish Date 2999-01-06");
    expect(forecast).toContain("Resource-Constrained Project Finish Date 2999-01-09");
    expect(screen.queryByText(/^Not set/)).toBeNull();
  });

  it("names the START date rule and keeps the START date unset", async () => {
    renderPlanner("start", accepted(setStartDate(fixture(), "", CONTEXT)));
    await screen.findByRole("button", { name: "START, today" });

    commitStartDate("2026-02-30", "blur", { badInput: true });

    const alert = screen.getByRole("alert");
    expect(within(alert).getByText(START_DATE_MESSAGE)).toBeDefined();
    expect(alert.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(await screen.findByRole("button", { name: "START, today" })).toBeDefined();
    expect(screen.getByText(/^Not set: the forecast starts from today/)).toBeDefined();
  });

  it("still clears the START date once every segment is emptied", async () => {
    renderPlanner("start");
    await screen.findByRole("button", { name: "START, 2999-01-01" });

    commitStartDate("", "blur", { badInput: false });

    expect(screen.queryByRole("alert")).toBeNull();
    expect(await screen.findByRole("button", { name: "START, today" })).toBeDefined();
    expect(screen.getByText(/^Not set: the forecast starts from today/)).toBeDefined();
  });
});

/**
 * A (id 1) depends on B (id 2) and B on A, START 2999-01-01. Built by hand, not
 * through the edit functions, which would reject the cycle: it stands for a
 * project that makes a render throw (`forecast()` and `projectDiagram()` throw
 * "The project contains a cycle." for it), the way a too-long imported chain
 * does in the browser.
 * Cast, not `toCheckedProject`: the guardian would refuse the cycle it exists to hold.
 */
function cyclicProject(name: string | undefined): CheckedProject {
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
  } as CheckedProject;
}

describe("Planner: a render crash keeps the project exportable", () => {
  const downloads: Download[] = [];
  let restoreDownloads: () => void;
  let consoleError: MockInstance<typeof console.error>;

  beforeEach(() => {
    restoreDownloads = stubDownloads(downloads);
    // Silenced: React and the planner both report the crash on the console.
    consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    restoreDownloads();
  });

  function renderCrashing(project: CheckedProject): void {
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

    const validationError = validateProject(project, CONTEXT);
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
    const project: CheckedProject = {
      ...malformed,
      tasks: malformed.tasks.map((task) => (task.id === 1 ? { ...task, name: null as unknown as string } : task)),
    };
    expect(() => validateProject(project, CONTEXT)).toThrow(TypeError);
    renderCrashing(project);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("The project could not be checked for Validation Errors: TypeError:");
    fireEvent.click(within(alert).getByRole("button", { name: "Export the project as it was" }));
    expect(downloads).toHaveLength(1);
    expect(await downloads[0].blob.text()).toBe(serializeProject(project));
  });
});

describe("Planner: unexported changes are confirmed before they are replaced", () => {
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

  /** One Task "Imported" (2 days), named "Imported plan": the file a test imports. */
  function importedFile(): File {
    const project = accepted(
      setProjectName(
        accepted(setDuration(accepted(createTask(createEmptyProject(CONTEXT), "Imported", CONTEXT)), 1, "2", CONTEXT)),
        "Imported plan",
        CONTEXT,
      ),
    );
    return new File([serializeProject(project)], "imported-plan.json", { type: "application/json" });
  }

  /** The hidden input the Import button opens, given `file` as the user's pick. */
  function pickFile(file: File): void {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (input === null) throw new Error("Expected the Import file input");
    fireEvent.change(input, { target: { files: [file] } });
  }

  /** One accepted edit: the project name, committed on blur. */
  async function renderEdited(): Promise<void> {
    renderPlanner();
    await screen.findByRole("button", { name: /^A, 5 days/ });
    const name = screen.getByLabelText("Project name");
    fireEvent.change(name, { target: { value: "Kept plan" } });
    fireEvent.blur(name);
  }

  function newProjectButton(): HTMLElement {
    return screen.getByRole("button", { name: "New project" });
  }

  function newTaskInput(): HTMLElement {
    return screen.getByRole("textbox", { name: "New Task" });
  }

  /** The edited fixture, selection and name, exactly as before the dialog opened. */
  async function expectEditedProjectKept(): Promise<void> {
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("button", { name: /^A, 5 days/ })).toBeDefined();
    expect(screen.getByRole("button", { name: "B, 3 days" })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>("Task name").value).toBe("A");
    expect(screen.getByLabelText<HTMLInputElement>("Project name").value).toBe("Kept plan");
  }

  async function expectEmptyProject(): Promise<void> {
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText(/^No Tasks yet/)).toBeDefined();
    expect(screen.queryByRole("button", { name: /^A, / })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>("Project name").value).toBe("");
    expect(document.activeElement).toBe(newTaskInput());
  }

  async function expectImportedProject(): Promise<void> {
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByRole("button", { name: /^Imported, 2 days/ })).toBeDefined();
    expect(screen.queryByRole("button", { name: /^A, / })).toBeNull();
    expect(screen.getByLabelText<HTMLInputElement>("Project name").value).toBe("Imported plan");
    expect(document.activeElement).toBe(newTaskInput());
  }

  it("starts a new project at once when nothing changed since the planner opened", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: /^A, 5 days/ });

    fireEvent.click(newProjectButton());

    await expectEmptyProject();
  });

  it("asks before New project discards an edit, and Cancel keeps everything and focuses New project", async () => {
    await renderEdited();

    fireEvent.click(newProjectButton());

    const dialog = screen.getByRole("dialog", { name: TITLE });
    expect(dialog.textContent).toContain(
      "The current project has changes that were not exported. Starting a new project discards them.",
    );
    expect(dialog.textContent).not.toMatch(/invalid|conflict|blocked/i);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await expectEditedProjectKept();
    expect(document.activeElement).toBe(newProjectButton());
  });

  it("treats Escape (the dialog's cancel event) as Cancel and keeps the dialog's closing to React", async () => {
    await renderEdited();
    fireEvent.click(newProjectButton());

    const notPrevented = fireEvent(
      screen.getByRole("dialog", { name: TITLE }),
      new Event("cancel", { cancelable: true }),
    );

    expect(notPrevented).toBe(false);
    await expectEditedProjectKept();
    expect(document.activeElement).toBe(newProjectButton());
  });

  it("empties the project once discarding is confirmed", async () => {
    await renderEdited();
    fireEvent.click(newProjectButton());

    fireEvent.click(screen.getByRole("button", { name: "Discard and start a new project" }));

    await expectEmptyProject();
  });

  it("starts a new project without asking once the edited project was exported", async () => {
    await renderEdited();
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(downloads).toHaveLength(1);
    expect(downloads[0].fileName).toBe("Kept plan.json");

    fireEvent.click(newProjectButton());

    await expectEmptyProject();
  });

  it("keeps asking after an Export the project name stopped, since nothing was written", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: /^A, 5 days/ });
    commitDuration("7");
    await screen.findByRole("button", { name: /^A, 7 days/ });

    fireEvent.click(screen.getByRole("button", { name: "Export" }));

    expect(downloads).toHaveLength(0);
    expect(screen.getByRole("alert").textContent).toContain("Name the project to export it.");
    fireEvent.click(newProjectButton());
    expect(screen.getByRole("dialog", { name: TITLE })).toBeDefined();
  });

  it("asks before Import replaces an edit, naming the file, and Cancel keeps the project and focuses Import", async () => {
    await renderEdited();

    pickFile(importedFile());

    const dialog = await screen.findByRole("dialog", { name: TITLE });
    expect(dialog.textContent).toContain(
      "The current project has changes that were not exported. Importing imported-plan.json replaces the project and discards them.",
    );
    expect(dialog.textContent).not.toMatch(/invalid|conflict|blocked/i);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await expectEditedProjectKept();
    expect(screen.queryByRole("button", { name: /^Imported, / })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Import" }));
  });

  it("imports the file once discarding is confirmed", async () => {
    await renderEdited();
    pickFile(importedFile());

    fireEvent.click(await screen.findByRole("button", { name: "Discard and import" }));

    await expectImportedProject();
  });

  it("shows a file's Validation Error and never asks, even over an edit", async () => {
    await renderEdited();

    pickFile(new File([serializeProject(cyclicProject("Cyclic plan"))], "cyclic.json", { type: "application/json" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("cyclic.json was not imported.");
    expect(screen.queryByRole("dialog")).toBeNull();
    await expectEditedProjectKept();
  });

  it("imports a valid file at once when nothing changed since the planner opened", async () => {
    renderPlanner();
    await screen.findByRole("button", { name: /^A, 5 days/ });

    pickFile(importedFile());

    await expectImportedProject();
  });
});
