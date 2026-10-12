// risk: test-plan.md #4, browser side — facet: the planner takes "today" from the browser's
// clock in the user's time zone and re-reads it on every edit, so a START date in the past is
// replaced by the local day, not the UTC day, and not by a day cached before midnight. The
// forecast arithmetic and `todayIsoDate` itself are unit-tested in src/lib/services/; only the
// glue from the clock to the rendered forecast is left to the running app (test-plan.md §6.5,
// Phase 1 note).
// seed: e2e/seed.spec.ts
import { expect, test, type Page } from "@playwright/test";

// The user's time zone, pinned so "local day" means the same on every machine and in CI.
test.use({ timezoneId: "Europe/Warsaw" });

/** 00:30 in Warsaw on 2030-01-10 is still 2030-01-09 in UTC, so a UTC "today" is a day early. */
const JUST_AFTER_MIDNIGHT = new Date("2030-01-10T00:30:00+01:00");
/** The following night, 00:10 in Warsaw on 2030-01-11 (2030-01-10 in UTC). */
const NEXT_NIGHT = new Date("2030-01-11T00:10:00+01:00");
/** In the past on both days, so the forecast always counts from today. */
const START_DATE = "2030-01-08";

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

/** Both Project Finish Dates, each bound to its own label, and the note naming the day they count from. */
async function expectForecastFromToday(page: Page, today: string, unconstrained: string, constrained: string) {
  await expect(page.getByRole("status").filter({ hasText: "Project Finish Date" })).toHaveText(
    new RegExp(
      `Resource-Unconstrained Project Finish Date\\s*${unconstrained}\\s*` +
        `Resource-Constrained Project Finish Date\\s*${constrained}\\s*` +
        `START date ${START_DATE} is in the past: forecasting from today, ${today}\\.`,
    ),
  );
}

test.describe("forecast counts from the user's local today", () => {
  test("a past START date is replaced by the local day, not the UTC day, and by the new day after midnight", async ({
    page,
  }) => {
    const projectName = `Midnight ${Date.now()}`;
    await page.clock.setFixedTime(JUST_AFTER_MIDNIGHT);
    await openPlanner(page);

    // Two Tasks in parallel, and a START date in the past.
    await addTaskWithDuration(page, "Alpha", 3);
    await addTaskWithDuration(page, "Beta", 2);
    await page.getByRole("button", { name: /^START,/ }).click();
    await page.getByRole("textbox", { name: "START date" }).fill(START_DATE);
    await expect(page.getByRole("button", { name: `START, ${START_DATE}` })).toBeVisible();

    // Today is 2030-01-10 in Warsaw. Worked by hand from the PRD (finish = base date + Duration):
    // unlimited parallelism ends with Alpha, 2030-01-10 + 3 = 2030-01-13; none runs both in turn,
    // 2030-01-10 + 3 + 2 = 2030-01-15. A UTC "today" would give 2030-01-12 and 2030-01-14.
    await expectForecastFromToday(page, "2030-01-10", "2030-01-13", "2030-01-15");

    // The next night, any edit re-reads the clock: renaming the project changes no Task or date.
    await page.clock.setFixedTime(NEXT_NIGHT);
    const nameField = page.getByRole("textbox", { name: "Project name" });
    await nameField.fill(projectName);
    await nameField.press("Enter");
    await expect(nameField).toHaveValue(projectName);

    // Today is now 2030-01-11: 2030-01-11 + 3 = 2030-01-14 and 2030-01-11 + 3 + 2 = 2030-01-16.
    // A "today" cached before midnight would keep 2030-01-13 and 2030-01-15.
    await expectForecastFromToday(page, "2030-01-11", "2030-01-14", "2030-01-16");

    // No cleanup: the project lives only in this page's memory and is gone when the context closes.
  });
});
