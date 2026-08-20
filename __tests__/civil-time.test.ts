/**
 * Civil Time Tests — Africa/Addis_Ababa + 12-Hour AM/PM
 *
 * Verifies that the timezone display layer:
 *   1. Converts UTC timestamps to Africa/Addis_Ababa civil time correctly
 *   2. Displays times in 12-hour AM/PM format (never Ethiopian 6-hour clock)
 *   3. Handles edge cases: midnight (12 AM), noon (12 PM), and boundaries
 *   4. Does NOT apply any ±6 hour Ethiopian clock offset
 */

import {
  formatCivilTime,
  formatHHMMAs12h,
  formatCivilFullDateTime,
  to12HourParts,
  getAddisAbabaTimeParts,
  formatEthiopianTime,
  toEthiopianTime,
} from "../lib/utils/ethiopian-time";

describe("Civil Time — Africa/Addis_Ababa + 12-Hour AM/PM", () => {
  // ─── 1. HH:MM string → 12h display ──────────────────────────────────────────

  describe("1. formatHHMMAs12h — HH:MM (24h) to 12-hour AM/PM display", () => {
    test("00:00 → '12:00 AM' (midnight)", () => {
      expect(formatHHMMAs12h("00:00")).toBe("12:00 AM");
    });

    test("00:30 → '12:30 AM'", () => {
      expect(formatHHMMAs12h("00:30")).toBe("12:30 AM");
    });

    test("08:00 → '8:00 AM'  (school morning start)", () => {
      expect(formatHHMMAs12h("08:00")).toBe("8:00 AM");
    });

    test("09:30 → '9:30 AM'", () => {
      expect(formatHHMMAs12h("09:30")).toBe("9:30 AM");
    });

    test("11:59 → '11:59 AM'", () => {
      expect(formatHHMMAs12h("11:59")).toBe("11:59 AM");
    });

    test("12:00 → '12:00 PM' (noon)", () => {
      expect(formatHHMMAs12h("12:00")).toBe("12:00 PM");
    });

    test("13:00 → '1:00 PM'  (afternoon start)", () => {
      expect(formatHHMMAs12h("13:00")).toBe("1:00 PM");
    });

    test("16:30 → '4:30 PM'", () => {
      expect(formatHHMMAs12h("16:30")).toBe("4:30 PM");
    });

    test("17:00 → '5:00 PM'  (school end)", () => {
      expect(formatHHMMAs12h("17:00")).toBe("5:00 PM");
    });

    test("23:59 → '11:59 PM'", () => {
      expect(formatHHMMAs12h("23:59")).toBe("11:59 PM");
    });
  });

  // ─── 2. UTC timestamp → Africa/Addis_Ababa → 12h AM/PM ──────────────────────
  // Africa/Addis_Ababa is UTC+3 with no Daylight Saving Time.

  describe("2. formatCivilTime — UTC timestamp to 12-hour AM/PM via Africa/Addis_Ababa", () => {
    test("2026-08-20T05:30:00.000Z → '8:30 AM'  (UTC+3)", () => {
      // UTC 05:30 + 3h = EAT 08:30
      expect(formatCivilTime("2026-08-20T05:30:00.000Z")).toBe("8:30 AM");
    });

    test("2026-08-20T00:00:00.000Z → '3:00 AM'", () => {
      // UTC 00:00 + 3h = EAT 03:00
      expect(formatCivilTime("2026-08-20T00:00:00.000Z")).toBe("3:00 AM");
    });

    test("2026-08-20T09:00:00.000Z → '12:00 PM' (noon in EAT)", () => {
      // UTC 09:00 + 3h = EAT 12:00
      expect(formatCivilTime("2026-08-20T09:00:00.000Z")).toBe("12:00 PM");
    });

    test("2026-08-19T21:00:00.000Z → '12:00 AM' (midnight boundary in EAT)", () => {
      // UTC 21:00 + 3h = EAT 00:00 (midnight)
      expect(formatCivilTime("2026-08-19T21:00:00.000Z")).toBe("12:00 AM");
    });

    test("2026-08-20T14:30:00.000Z → '5:30 PM'", () => {
      // UTC 14:30 + 3h = EAT 17:30
      expect(formatCivilTime("2026-08-20T14:30:00.000Z")).toBe("5:30 PM");
    });

    test("2026-08-20T10:00:00.000Z → '1:00 PM'", () => {
      // UTC 10:00 + 3h = EAT 13:00
      expect(formatCivilTime("2026-08-20T10:00:00.000Z")).toBe("1:00 PM");
    });
  });

  // ─── 3. to12HourParts — internal conversion correctness ──────────────────────

  describe("3. to12HourParts — 24h to 12h AM/PM components", () => {
    test("hour=0  → 12 AM  (midnight)", () => {
      const p = to12HourParts(0, 0);
      expect(p.hour12).toBe(12);
      expect(p.period).toBe("AM");
    });

    test("hour=1  → 1 AM", () => {
      const p = to12HourParts(1, 0);
      expect(p.hour12).toBe(1);
      expect(p.period).toBe("AM");
    });

    test("hour=11 → 11 AM", () => {
      const p = to12HourParts(11, 0);
      expect(p.hour12).toBe(11);
      expect(p.period).toBe("AM");
    });

    test("hour=12 → 12 PM  (noon — not 12 AM)", () => {
      const p = to12HourParts(12, 0);
      expect(p.hour12).toBe(12);
      expect(p.period).toBe("PM");
    });

    test("hour=13 → 1 PM", () => {
      const p = to12HourParts(13, 0);
      expect(p.hour12).toBe(1);
      expect(p.period).toBe("PM");
    });

    test("hour=23 → 11 PM", () => {
      const p = to12HourParts(23, 0);
      expect(p.hour12).toBe(11);
      expect(p.period).toBe("PM");
    });

    test("minuteStr is zero-padded", () => {
      const p = to12HourParts(8, 5);
      expect(p.minuteStr).toBe("05");
    });
  });

  // ─── 4. Date boundary — midnight in EAT ─────────────────────────────────────

  describe("4. Date boundary — midnight in Africa/Addis_Ababa", () => {
    test("getAddisAbabaTimeParts at EAT midnight returns hour=0", () => {
      // UTC 21:00 = EAT 00:00
      const { hour } = getAddisAbabaTimeParts("2026-08-19T21:00:00.000Z");
      expect(hour).toBe(0);
    });

    test("getAddisAbabaTimeParts at EAT noon returns hour=12", () => {
      // UTC 09:00 = EAT 12:00
      const { hour } = getAddisAbabaTimeParts("2026-08-20T09:00:00.000Z");
      expect(hour).toBe(12);
    });
  });

  // ─── 5. No Ethiopian 6-hour offset applied ───────────────────────────────────

  describe("5. Confirms NO ±6 hour Ethiopian clock offset", () => {
    test("08:00 AM must not be converted to '2:00 Ethiopian'", () => {
      const result = formatHHMMAs12h("08:00");
      expect(result).toBe("8:00 AM");
      expect(result).not.toContain("2:00");
      expect(result).not.toContain("Ethiopian");
    });

    test("17:00 (5 PM) must not be converted to '11:00 Ethiopian'", () => {
      const result = formatHHMMAs12h("17:00");
      expect(result).toBe("5:00 PM");
      expect(result).not.toContain("11:00");
      expect(result).not.toContain("Ethiopian");
    });

    test("12:00 PM (noon) must not be converted to '6:00 Ethiopian'", () => {
      const result = formatHHMMAs12h("12:00");
      expect(result).toBe("12:00 PM");
      expect(result).not.toContain("6:00");
      expect(result).not.toContain("Ethiopian");
    });

    test("toEthiopianTime (compat stub) returns 12h AM/PM in timeString, not Ethiopian clock", () => {
      // "08:00" → civil 8 AM, NOT Ethiopian 2 ጠዋት
      const et = toEthiopianTime("08:00");
      expect(et.timeString).toBe("8:00 AM");
      expect(et.timeString).not.toContain("2:00");
      expect(et.timeString).not.toContain("Ethiopian");
      expect(et.ethHour).toBe(8); // 12h civil hour for 8 AM is 8
    });
  });

  // ─── 6. Null / empty handling ────────────────────────────────────────────────

  describe("6. Null / empty / invalid input handling", () => {
    test("null → '—'", () => {
      expect(formatCivilTime(null)).toBe("—");
    });

    test("undefined → '—'", () => {
      expect(formatCivilTime(undefined)).toBe("—");
    });

    test("formatHHMMAs12h(null) → '—'", () => {
      expect(formatHHMMAs12h(null)).toBe("—");
    });

    test("formatHHMMAs12h(undefined) → '—'", () => {
      expect(formatHHMMAs12h(undefined)).toBe("—");
    });

    test("formatCivilFullDateTime(null) → '—'", () => {
      expect(formatCivilFullDateTime(null)).toBe("—");
    });
  });

  // ─── 7. Backward-compat alias ────────────────────────────────────────────────

  describe("7. formatEthiopianTime alias returns AM/PM (not Ethiopian clock)", () => {
    test("formatEthiopianTime is now formatCivilTime", () => {
      expect(formatEthiopianTime("08:00")).toBe("8:00 AM");
      expect(formatEthiopianTime("13:30")).toBe("1:30 PM");
      expect(formatEthiopianTime("17:00")).toBe("5:00 PM");
      expect(formatEthiopianTime(null)).toBe("—");
    });
  });
});
