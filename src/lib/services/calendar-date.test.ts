import { describe, expect, it } from "vitest";

import {
  addDays,
  compareIsoDates,
  isIsoDate,
  MAX_ISO_DATE,
  MIN_ISO_DATE,
  todayIsoDate,
} from "@/lib/services/calendar-date";

describe("isIsoDate", () => {
  it("accepts real dates from 0001-01-01 to 9999-12-31", () => {
    for (const date of [MIN_ISO_DATE, "0050-06-15", "2026-10-05", "2028-02-29", MAX_ISO_DATE]) {
      expect(isIsoDate(date)).toBe(true);
    }
  });

  it("rejects a date that does not exist", () => {
    for (const date of ["2026-02-29", "2100-02-29", "2026-04-31", "2026-13-01", "2026-00-10", "2026-01-00"]) {
      expect(isIsoDate(date)).toBe(false);
    }
  });

  it("rejects year 0 and anything not in the fixed yyyy-mm-dd form", () => {
    for (const date of ["0000-12-31", "10000-01-01", "2026-1-05", "26-10-05", "2026/10/05", " 2026-10-05", ""]) {
      expect(isIsoDate(date)).toBe(false);
    }
  });
});

describe("addDays", () => {
  it("rolls over months and years", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-09-01", 0)).toBe("2026-09-01");
  });

  it("counts leap days", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2028-01-01", 366)).toBe("2029-01-01");
  });

  it("is not shifted by a DST change", () => {
    // The EU clocks go back on 2026-10-25.
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("keeps years below 100 and zero-pads years below 1000", () => {
    expect(addDays("0050-12-31", 1)).toBe("0051-01-01");
    expect(addDays("0999-12-31", 1)).toBe("1000-01-01");
  });

  it("returns undefined past 9999-12-31", () => {
    expect(addDays("9999-12-01", 30)).toBe(MAX_ISO_DATE);
    expect(addDays(MAX_ISO_DATE, 1)).toBeUndefined();
    expect(addDays(MIN_ISO_DATE, Number.MAX_SAFE_INTEGER)).toBeUndefined();
  });
});

describe("compareIsoDates", () => {
  it("orders dates", () => {
    expect(compareIsoDates("2026-09-01", "2026-09-05")).toBeLessThan(0);
    expect(compareIsoDates("2026-09-05", "2026-09-01")).toBeGreaterThan(0);
    expect(compareIsoDates("2026-09-01", "2026-09-01")).toBe(0);
    expect(compareIsoDates("0999-12-31", "1000-01-01")).toBeLessThan(0);
  });
});

describe("todayIsoDate", () => {
  it("today is the user's local date, not the UTC date", () => {
    // Relies on TZ = Europe/Warsaw, pinned in vitest.config.ts. Each pair straddles local
    // midnight, where the Warsaw date is a day ahead of the UTC date.
    // CEST (UTC+2):
    expect(todayIsoDate(new Date("2026-10-09T21:59:00Z"))).toBe("2026-10-09");
    expect(todayIsoDate(new Date("2026-10-09T22:30:00Z"))).toBe("2026-10-10");
    // CET (UTC+1), across a year boundary:
    expect(todayIsoDate(new Date("2026-12-31T22:59:00Z"))).toBe("2026-12-31");
    expect(todayIsoDate(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});
