// risk: observability audit 2026-10-13 B1 and A1 / test-plan.md #3 ("never throws or blanks"), browser
// side — a project that makes the first render throw must leave a fallback that still exports it and
// can go back to the project open before, never a blank page that loses both. A1's real path, an
// imported long chain that overflows the layout's stack in the built app, is the trigger here.
// Audit fix 2 (an import bound on Task count and chain depth) will turn this import into a rejection:
// when it lands, this case must be rewritten to reach a render throw another way, not deleted.
// The fallback itself is unit-tested in src/components/planner/Planner.test.ts, going back in
// src/hooks/useProject.test.ts.
// seed: e2e/seed.spec.ts
import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

/** The chain length: past the layout's stack depth in Chromium, under the 5 MB file guard (about 185 KB). */
const CHAIN_LENGTH = 2_500;

/** Opens the planner and waits until the island has hydrated (the skeleton has no New Task textbox). */
async function openPlanner(page: Page) {
  const response = await page.goto("/");
  // The served page is the built app with the no-egress CSP, not a reused `npm run dev` without one.
  expect(await response?.text()).toContain("connect-src 'none'");
  await expect(page.getByRole("textbox", { name: "New Task" })).toBeVisible();
}

/** A project file in which each Task's only predecessor is the one before it, written here, never by the exporter. */
function longChainFile(): string {
  const tasks = Array.from({ length: CHAIN_LENGTH }, (_, index) => ({
    id: index + 1,
    name: `Task ${index + 1}`,
    predecessors: index === 0 ? [] : [index],
    status: "to-do",
  }));
  return JSON.stringify({
    version: "0.1",
    name: "Long chain",
    start: {},
    finish: {},
    dayCountingMode: "calendar-days",
    nextTaskId: CHAIN_LENGTH + 1,
    tasks,
  });
}

test.describe("render crash recovery in the built app", () => {
  test("an import that crashes the first render shows a fallback that exports it and goes back to the project before", async ({
    page,
  }) => {
    // Attached before anything runs, so the crash line logged on the import's render is caught.
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });

    await openPlanner(page);
    const newTask = page.getByRole("textbox", { name: "New Task" });
    await newTask.fill("Keep me");
    await newTask.press("Enter");
    await expect(page.getByRole("button", { name: "Keep me, no Duration" })).toBeVisible();

    // Import the long chain: it passes every import rule, and its first render throws.
    const fileChooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Import" }).click();
    await (
      await fileChooser
    ).setFiles({ name: "long-chain.json", mimeType: "application/json", buffer: Buffer.from(longChainFile()) });

    // The fallback names the error in place of the planner.
    const alert = page.getByRole("alert");
    await expect(alert).toContainText("RangeError");
    await expect(newTask).toHaveCount(0);

    // Export saves the project the render threw on, every Task of it.
    const downloadEvent = page.waitForEvent("download");
    await alert.getByRole("button", { name: "Export the project as it was" }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("Long chain.json");
    const file = JSON.parse(await readFile(await download.path(), "utf8")) as { tasks: unknown[] };
    expect(file.tasks).toHaveLength(CHAIN_LENGTH);

    // The crash reached the console, the only signal there is with nothing leaving the device.
    expect(consoleErrors.some((text) => text.startsWith("Critical Path: the planner crashed while rendering."))).toBe(
      true,
    );

    // Going back brings the planner back with the project open before the import.
    await alert.getByRole("button", { name: "Go back to the project before the last change" }).click();
    await expect(page.getByRole("button", { name: "Keep me, no Duration" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);

    // No cleanup: the project lives only in this page's memory, and the download is deleted with the context.
  });
});
