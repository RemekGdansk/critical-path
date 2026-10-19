// risk: test-plan.md #5, view side — a START date the browser cannot read (an impossible or a
// partly filled date) must keep the committed START date and name the START date rule, never
// clear it. Chromium reports such a date as "" with `validity.badInput`, which jsdom cannot
// produce; the panel's handling is unit-tested with a stubbed `validity` in
// src/components/planner/Planner.test.ts, and only the browser premise and the built app are left here.
// Chromium on macOS takes the date segment order from the system region, not from the context
// locale, so the spec detects the order instead of pinning a locale.
// seed: e2e/seed.spec.ts
import { expect, test, type Locator, type Page } from "@playwright/test";

/** Far in the future, so the forecast counts from START, not from the real clock. */
const START_DATE = "2999-01-01";
const START_DATE_MESSAGE = "The START date must be a calendar date from 0001-01-01 to 9999-12-31.";

type Segment = "year" | "month" | "day";

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

async function addTaskWithDuration(page: Page, name: string, days: number) {
  const newTask = page.getByRole("textbox", { name: "New Task" });
  await newTask.fill(name);
  await newTask.press("Enter");
  await page.getByRole("button", { name: `${name}, no Duration` }).click();
  const duration = page.getByRole("textbox", { name: "Duration (days)" });
  await duration.fill(String(days));
  await duration.press("Enter");
  await expect(page.getByRole("button", { name: `${name}, ${days} days` })).toBeVisible();
}

/** Both Project Finish Dates, each bound to its own label. */
async function expectProjectFinishDates(page: Page, unconstrained: string, constrained: string) {
  await expect(page.getByRole("status").filter({ hasText: "Project Finish Date" })).toHaveText(
    new RegExp(
      `Resource-Unconstrained Project Finish Date\\s*${unconstrained}\\s*Resource-Constrained Project Finish Date\\s*${constrained}`,
    ),
  );
}

/** The field's value and whether the browser reports it unreadable: the premise jsdom can only stub. */
function readField(field: Locator) {
  return field.evaluate((input: HTMLInputElement) => ({ value: input.value, badInput: input.validity.badInput }));
}

/** Puts focus in the field's first segment: focus that arrives from another element lands there. */
async function focusFirstSegment(page: Page, field: Locator) {
  await page.getByRole("textbox", { name: "Project name" }).focus();
  await field.focus();
}

/**
 * The field's segment order, from the segment ArrowUp moves when focus enters it. Escape then
 * restores the committed date, so nothing is committed.
 */
async function segmentOrder(page: Page, field: Locator): Promise<Segment[]> {
  await focusFirstSegment(page, field);
  await page.keyboard.press("ArrowUp");
  const [year, month] = (await field.inputValue()).split("-");
  await page.keyboard.press("Escape");
  await expect(field).toHaveValue(START_DATE);
  const [startYear, startMonth] = START_DATE.split("-");
  if (year !== startYear) return ["year", "month", "day"];
  if (month !== startMonth) return ["month", "day", "year"];
  return ["day", "month", "year"];
}

test.describe("an unreadable START date in the built app", () => {
  test("an impossible or partly filled START date keeps the committed one and names the START date rule", async ({
    page,
  }) => {
    const consoleErrors = collectConsoleErrors(page);
    await openPlanner(page);

    // One Task and a START date in the future: 2999-01-01 + 3 = 2999-01-04 with or without parallelism.
    await addTaskWithDuration(page, "Alpha", 3);
    await page.getByRole("button", { name: /^START,/ }).click();
    const startDate = page.getByRole("textbox", { name: "START date" });
    await startDate.fill(START_DATE);
    const startNode = page.getByRole("button", { name: `START, ${START_DATE}` });
    await expect(startNode).toBeVisible();
    await expectProjectFinishDates(page, "2999-01-04", "2999-01-04");

    // Type 2026-02-30, segment by segment in the field's own order.
    const parts: Record<Segment, string> = { year: "2026", month: "02", day: "30" };
    const order = await segmentOrder(page, startDate);
    await focusFirstSegment(page, startDate);
    for (const segment of order) await page.keyboard.type(parts[segment]);

    // The browser premise: an impossible date reads as an empty value, flagged as unreadable.
    expect(await readField(startDate)).toEqual({ value: "", badInput: true });

    // Enter names the rule and keeps the START date and both Project Finish Dates.
    await page.keyboard.press("Enter");
    const alert = page.getByRole("alert");
    await expect(alert).toHaveText(START_DATE_MESSAGE);
    await expect(startNode).toBeVisible();
    await expectProjectFinishDates(page, "2999-01-04", "2999-01-04");

    // Escape puts the committed date back in the field and removes the alert.
    await page.keyboard.press("Escape");
    await expect(startDate).toHaveValue(START_DATE);
    await expect(alert).toHaveCount(0);

    // A partly filled date: emptying one segment of the committed date, whichever the order.
    await page.keyboard.press("Backspace");
    expect(await readField(startDate)).toEqual({ value: "", badInput: true });
    await page.keyboard.press("Enter");
    await expect(alert).toHaveText(START_DATE_MESSAGE);
    await expect(startNode).toBeVisible();

    expect(consoleErrors).toEqual([]);

    // No cleanup: the project lives only in this page's memory and is gone when the context closes.
  });
});
