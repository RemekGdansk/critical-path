// risk: roadmap S-07 / US-04, browser side — marking a Task Done must take the browser's local
// today as its completion date, in the user's time zone, and both Project Finish Dates must then
// count from today once every Task that follows START is Done. The Done rules, `setStatus` and the
// progress-aware forecast are unit-tested in src/lib/services/, and the hook and panels in jsdom
// with "today" passed in; only the hook's default clock read on an edit, under the CSP, is left
// to the running app (the e2e/forecast-today.spec.ts pattern).
// seed: e2e/seed.spec.ts
import { expect, test, type Page } from "@playwright/test";

// The user's time zone, pinned so "local day" means the same on every machine and in CI.
test.use({ timezoneId: "Europe/Warsaw" });

/** 00:30 in Warsaw on 2030-01-03 is still 2030-01-02 in UTC, so a UTC "today" is a day early. */
const JUST_AFTER_MIDNIGHT = new Date("2030-01-03T00:30:00+01:00");
/** In the past, so the completion date is not before it and, once A is Done, the forecast counts from today. */
const START_DATE = "2030-01-01";

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

/** Adds a predecessor to the Task whose panel is open, by its "<id>: <name>" label. */
async function addPredecessor(page: Page, predecessorLabel: string) {
  await page.getByRole("combobox", { name: "Add predecessor" }).selectOption({ label: predecessorLabel });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: `Remove predecessor ${predecessorLabel}` })).toBeVisible();
}

test.describe("marking a Task Done takes the user's local today", () => {
  test("Done sets the local day as the completion date and both Project Finish Dates count from it", async ({
    page,
  }) => {
    await page.clock.setFixedTime(JUST_AFTER_MIDNIGHT);
    await openPlanner(page);

    // A(5) → B(3), and a START date in the past.
    await addTaskWithDuration(page, "A", 5);
    await addTaskWithDuration(page, "B", 3);
    await addPredecessor(page, "1: A");
    await page.getByRole("button", { name: /^START,/ }).click();
    await page.getByRole("textbox", { name: "START date" }).fill(START_DATE);
    await expect(page.getByRole("button", { name: `START, ${START_DATE}` })).toBeVisible();

    // Marking A Done in its panel: the edit reads the clock, and today is 2030-01-03 in Warsaw.
    await page.getByRole("button", { name: "A, 5 days" }).click();
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption({ label: "Done" });
    await expect(page.getByRole("button", { name: "A, Done on 2030-01-03", exact: true })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Completion date" })).toHaveValue("2030-01-03");

    // Worked by hand from the PRD: A, the only Task that follows START, is Done, so the forecast
    // counts from today, 2030-01-03. Only B remains: 2030-01-03 + 3 = 2030-01-06 with or without
    // parallelism. A UTC "today" would give a completion date of 2030-01-02 and 2030-01-05.
    await expect(page.getByRole("status").filter({ hasText: "Project Finish Date" })).toHaveText(
      new RegExp(
        `Resource-Unconstrained Project Finish Date\\s*2030-01-06\\s*` +
          `Resource-Constrained Project Finish Date\\s*2030-01-06\\s*` +
          `Critical-path time\\s*3 days\\s*·\\s*Total-work time\\s*3 days\\s*` +
          `The Tasks that follow START are Done: forecasting from today, 2030-01-03\\.`,
      ),
    );

    // No cleanup: the project lives only in this page's memory and is gone when the context closes.
  });
});
