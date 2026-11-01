// risk: roadmap S-03 / test-plan.md #2 and #3, browser side — the project file must leave the
// device as a download and come back through the file picker in the built app, under the CSP's
// connect-src 'none', and a file holding a Validation Error must be rejected without harm.
// The file contract itself is unit-tested in src/lib/services/project-file.test.ts.
// seed: e2e/seed.spec.ts
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

/** "Today" in the browser, a week before the round-trip's START date, so the forecast counts from START, not from the real clock. */
const TODAY = new Date("2029-12-31T12:00:00");

/** Collects console errors and uncaught exceptions; Chromium reports a CSP violation as a console error. */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** Opens the planner and waits until the island has hydrated (the skeleton has no New Task textbox). */
async function openPlanner(page: Page) {
  const response = await page.goto("/");
  // The served page is the built app with the no-egress CSP, not a reused `npm run dev` without one.
  expect(await response?.text()).toContain("connect-src 'none'");
  await expect(page.getByRole("textbox", { name: "New Task" })).toBeVisible();
}

async function addTask(page: Page, name: string) {
  const newTask = page.getByRole("textbox", { name: "New Task" });
  await newTask.fill(name);
  await newTask.press("Enter");
  await expect(page.getByRole("button", { name: `${name}, no Duration` })).toBeVisible();
}

async function setDuration(page: Page, taskName: string, days: number) {
  await page.getByRole("button", { name: `${taskName}, no Duration` }).click();
  const duration = page.getByRole("textbox", { name: "Duration (days)" });
  await duration.fill(String(days));
  await duration.press("Enter");
  await expect(page.getByRole("button", { name: `${taskName}, ${days} ${days === 1 ? "day" : "days"}` })).toBeVisible();
}

/** Adds a predecessor to the Task whose panel is open, by its "<id>: <name>" label. */
async function addPredecessor(page: Page, predecessorLabel: string) {
  await page.getByRole("combobox", { name: "Add predecessor" }).selectOption({ label: predecessorLabel });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove predecessor ${predecessorLabel}` })).toBeVisible();
}

async function setStartDate(page: Page, date: string) {
  await page.getByRole("button", { name: /^START,/ }).click();
  await page.getByRole("textbox", { name: "START date" }).fill(date);
  await expect(page.getByRole("button", { name: `START, ${date}` })).toBeVisible();
}

/** Both Project Finish Dates, each bound to its own label. */
async function expectProjectFinishDates(page: Page, unconstrained: string, constrained: string) {
  await expect(page.getByRole("status").filter({ hasText: "Project Finish Date" })).toHaveText(
    new RegExp(
      `Resource-Unconstrained Project Finish Date\\s*${unconstrained}\\s*Resource-Constrained Project Finish Date\\s*${constrained}`,
    ),
  );
}

async function exportProject(page: Page) {
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  return downloadEvent;
}

test.describe("project file round-trip in the built app", () => {
  test("Export downloads <project name>.json holding the Tasks, with no console error or CSP violation", async ({
    page,
  }) => {
    const projectName = `Export ${Date.now()}`;
    const consoleErrors = collectConsoleErrors(page);
    await openPlanner(page);

    // Build a named project with two Tasks.
    await addTask(page, "Alpha");
    await addTask(page, "Beta");
    await page.getByRole("textbox", { name: "Project name" }).fill(projectName);

    // Export it: the file is saved through a download, never a network request.
    const download = await exportProject(page);

    expect(download.suggestedFilename()).toBe(`${projectName}.json`);
    const file = JSON.parse(await readFile(await download.path(), "utf8")) as {
      version: string;
      name: string;
      tasks: { name: string }[];
    };
    expect(file.version).toBe("1.0");
    expect(file.name).toBe(projectName);
    expect(file.tasks.map((task) => task.name)).toEqual(["Alpha", "Beta"]);
    expect(consoleErrors).toEqual([]);

    // No cleanup: the project lives only in this page's memory, and the download is deleted with the context.
  });

  test("a project exported in one browser imports in a fresh one with the same name, Tasks, predecessors and Project Finish Dates", async ({
    page,
    browser,
  }) => {
    const projectName = `Round-trip ${Date.now()}`;
    await page.clock.setFixedTime(TODAY);
    await openPlanner(page);

    // Build the project in browser context A: Beta depends on Alpha, Gamma runs in parallel.
    // Expected dates follow the PRD by hand (finish = start + Duration; a successor starts on its
    // predecessor's finish): with unlimited parallelism Beta ends last, 2030-01-07 + 3 + 2 =
    // 2030-01-12; with none, all three run in turn, 2030-01-07 + 3 + 2 + 1 = 2030-01-13. A lost
    // predecessor would move the first date to Alpha's 2030-01-10.
    await addTask(page, "Alpha");
    await addTask(page, "Beta");
    await addTask(page, "Gamma");
    await setDuration(page, "Alpha", 3);
    await setDuration(page, "Gamma", 1);
    await setDuration(page, "Beta", 2);
    // Beta's panel is still open from its Duration.
    await addPredecessor(page, "1: Alpha");
    await setStartDate(page, "2030-01-07");
    await page.getByRole("textbox", { name: "Project name" }).fill(projectName);
    await expectProjectFinishDates(page, "2030-01-12", "2030-01-13");

    // Export it from context A.
    const download = await exportProject(page);
    const exportedFile = await download.path();

    // Import the downloaded file in a fresh context B, which shares no state with A.
    const contextB = await browser.newContext();
    try {
      const pageB = await contextB.newPage();
      await pageB.clock.setFixedTime(TODAY);
      const consoleErrorsB = collectConsoleErrors(pageB);
      await openPlanner(pageB);
      const fileChooser = pageB.waitForEvent("filechooser");
      await pageB.getByRole("button", { name: "Import" }).click();
      await (await fileChooser).setFiles(exportedFile);

      // Context B shows the same project.
      await expect(pageB.getByRole("textbox", { name: "Project name" })).toHaveValue(projectName);
      await expect(pageB.getByRole("button", { name: "Alpha, 3 days" })).toBeVisible();
      await expect(pageB.getByRole("button", { name: "Gamma, 1 day" })).toBeVisible();
      await expect(pageB.getByRole("button", { name: "START, 2030-01-07" })).toBeVisible();
      await expectProjectFinishDates(pageB, "2030-01-12", "2030-01-13");
      await expect(pageB.getByRole("alert")).toHaveCount(0);
      await expect(pageB.getByRole("textbox", { name: "New Task" })).toBeFocused();
      await pageB.getByRole("button", { name: "Beta, 2 days" }).click();
      await expect(pageB.getByRole("button", { name: "Remove predecessor 1: Alpha" })).toBeVisible();
      expect(consoleErrorsB).toEqual([]);
    } finally {
      // Cleanup: context B is ours, not a fixture, so close it ourselves.
      await contextB.close();
    }
  });

  test("importing a file with a cycle shows an alert naming the cycle and keeps the current project", async ({
    page,
  }) => {
    const projectName = `Keep ${Date.now()}`;
    const taskName = `Kept Task ${Date.now()}`;
    await openPlanner(page);
    await addTask(page, taskName);
    const nameField = page.getByRole("textbox", { name: "Project name" });
    await nameField.fill(projectName);
    await nameField.press("Enter");

    // A hand-edited file holding the Validation Error A → B → A, written here, never by the exporter.
    const cycleFile = {
      version: "0.1",
      start: {},
      finish: {},
      dayCountingMode: "calendar-days",
      nextTaskId: 3,
      tasks: [
        { id: 1, name: "Draft", predecessors: [2], status: "to-do" },
        { id: 2, name: "Review", predecessors: [1], status: "to-do" },
      ],
    };
    const fileChooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import" }).click();
    await (
      await fileChooser
    ).setFiles({ name: "cycle.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(cycleFile)) });

    // The import is rejected with the rule and the cycle named, and the current project stays as it was.
    await expect(page.getByRole("alert")).toHaveText(
      "cycle.json was not imported. The project contains the cycle 1: Draft → 2: Review → 1: Draft.",
    );
    await expect(page.getByRole("button", { name: `${taskName}, no Duration` })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Draft,/ })).toHaveCount(0);
    await expect(nameField).toHaveValue(projectName);

    // No cleanup: the project lives only in this page's memory.
  });
});
