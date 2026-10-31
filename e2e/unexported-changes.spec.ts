// risk: roadmap S-08 / FR-016, browser side — an Import over a project with unexported changes must
// ask first, in the built app's real modal <dialog> under the CSP's connect-src 'none': Escape and
// Cancel keep the project and return focus to Import, "Discard and import" replaces it. ConfirmDialog is native
// <dialog>, not Radix, because Radix's scroll lock injects a <style> the CSP blocks; a regression to
// it would show here as a console error.
// The decision and the dialog are unit-tested in src/hooks/useProject.test.ts,
// src/components/planner/Planner.test.ts and src/components/planner/RenderCrashFallback.test.ts.
// seed: e2e/seed.spec.ts
import { expect, test, type Page } from "@playwright/test";

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

/** A project file holding one To Do Task, written here, never by the exporter. */
const IMPORTED_FILE = JSON.stringify({
  version: "0.1",
  name: "Imported project",
  start: {},
  finish: {},
  dayCountingMode: "calendar-days",
  nextTaskId: 2,
  tasks: [{ id: 1, name: "Imported", predecessors: [], status: "to-do" }],
});

async function importFile(page: Page) {
  const fileChooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Import" }).click();
  await (
    await fileChooser
  ).setFiles({ name: "imported.json", mimeType: "application/json", buffer: Buffer.from(IMPORTED_FILE) });
}

test.describe("unexported changes in the built app", () => {
  test("Import over an unexported edit asks first: Escape and Cancel keep the project, Discard and import replaces it", async ({
    page,
  }) => {
    // Attached before the page loads, so nothing logged on the way in is missed.
    const consoleErrors = collectConsoleErrors(page);
    await openPlanner(page);
    const newTask = page.getByRole("textbox", { name: "New Task" });
    await newTask.fill("Keep me");
    await newTask.press("Enter");
    const keepMe = page.getByRole("button", { name: "Keep me, no Duration" });
    await expect(keepMe).toBeVisible();

    // "Keep me" was never exported, so the accepted file is held until the user confirms.
    await importFile(page);
    const confirmation = page.getByRole("dialog", { name: "Discard unexported changes?" });
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText("imported.json");

    // Escape, the browser's own cancel (which may close the dialog itself right after the file
    // picker), changes nothing and hands focus back to Import.
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(keepMe).toBeVisible();
    await expect(page.getByRole("button", { name: /^Imported,/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Import" })).toBeFocused();

    // Cancel does the same.
    await importFile(page);
    await expect(confirmation).toContainText("imported.json");
    await confirmation.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(keepMe).toBeVisible();
    await expect(page.getByRole("button", { name: /^Imported,/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Import" })).toBeFocused();

    // Importing again asks again; confirming replaces the project.
    await importFile(page);
    await expect(confirmation).toContainText("imported.json");
    await confirmation.getByRole("button", { name: "Discard and import" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Imported, no Duration" })).toBeVisible();
    await expect(keepMe).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Project name" })).toHaveValue("Imported project");
    await expect(newTask).toBeFocused();

    expect(consoleErrors).toEqual([]);

    // No cleanup: the project lives only in this page's memory and is gone when the context closes.
  });
});
