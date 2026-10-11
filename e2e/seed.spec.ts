// Seed — risk `csp-planner-boots` (test-plan.md risk #7, browser side): the built
// planner must hydrate and capture a Task with the no-egress CSP in effect, with no
// console error or CSP violation. The pattern every generated E2E test copies.
import { expect, test } from "@playwright/test";

test("built planner captures a Task under the no-egress CSP without console errors", async ({ page }) => {
  const taskName = `Seed Task ${Date.now()}`;
  // Chromium reports a CSP violation as a console error, so this list catches both.
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  await page.goto("/");

  // The textbox exists only once the island has hydrated (the skeleton shows a plain label),
  // so waiting for it means typed input is not lost.
  const newTask = page.getByRole("textbox", { name: "New Task" });
  await expect(newTask).toBeVisible();
  await newTask.fill(taskName);
  await newTask.press("Enter");

  await expect(page.getByRole("button", { name: `${taskName}, no Duration` })).toBeVisible();
  await expect(page.getByRole("button", { name: "Validation Warning: 1 Task without Duration." })).toBeVisible();
  expect(consoleErrors).toEqual([]);

  // The CSP is in effect: even a same-origin request is refused. Against `astro dev`
  // (no CSP) the fetch would succeed and this test would fail.
  const egress = await page.evaluate(() =>
    fetch("/").then(
      () => "sent",
      () => "blocked",
    ),
  );
  expect(egress).toBe("blocked");

  // No cleanup: the project lives only in this page's memory and is gone when the context closes.
});
