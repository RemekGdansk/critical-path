import { describe, expect, it } from "vitest";

import { formatDuration } from "@/lib/services/duration";

describe("formatDuration", () => {
  it("formats Durations in days or weekdays, by the mode", () => {
    expect([1, 2, 30].map((days) => formatDuration(days, "calendar-days"))).toEqual(["1 day", "2 days", "30 days"]);
    expect([1, 2, 30].map((days) => formatDuration(days, "weekdays"))).toEqual([
      "1 weekday",
      "2 weekdays",
      "30 weekdays",
    ]);
  });
});
