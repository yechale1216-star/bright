import {
  toEthiopianDate,
  formatEthiopianDate,
  formatEthiopianDateDMY,
  formatEthiopianDateTimeDMY,
  gregorianToJDN,
  jdnToEthiopic,
  ethiopicToJDN,
  jdnToGregorian,
  getAddisAbabaDateParts,
} from "../lib/utils/ethiopian-calendar";
import {
  formatLocalizedDate,
  formatLocalizedTime,
  formatLocalizedDateTime,
} from "../lib/utils/date-utils";

describe("Ethiopian Calendar & Date Localization Utilities", () => {
  describe("1. Gregorian to Ethiopian Conversion Math", () => {
    test("Converts August 7, 2026 to Ethiopian Nehase 1, 2018 EC", () => {
      const ec = toEthiopianDate("2026-08-07");
      expect(ec.year).toBe(2018);
      expect(ec.month).toBe(11); // 0-indexed 11 = Nehase
      expect(ec.day).toBe(1);
    });

    test("Converts August 6, 2026 to Ethiopian Hamle 30, 2018 EC", () => {
      const ec = toEthiopianDate("2026-08-06");
      expect(ec.year).toBe(2018);
      expect(ec.month).toBe(10); // 0-indexed 10 = Hamle
      expect(ec.day).toBe(30);
    });

    test("Ethiopian New Year Boundary: September 12, 2023 is Meskerem 1, 2016 EC", () => {
      const ec = toEthiopianDate("2023-09-12");
      expect(ec.year).toBe(2016);
      expect(ec.month).toBe(0); // Meskerem
      expect(ec.day).toBe(1);
    });

    test("Ethiopian New Year Boundary: September 11, 2024 is Meskerem 1, 2017 EC", () => {
      const ec = toEthiopianDate("2024-09-11");
      expect(ec.year).toBe(2017);
      expect(ec.month).toBe(0); // Meskerem
      expect(ec.day).toBe(1);
    });

    test("Pagume 6 Leap Year Boundary: September 11, 2023 is Pagume 6, 2015 EC", () => {
      const ec = toEthiopianDate("2023-09-11");
      expect(ec.year).toBe(2015);
      expect(ec.month).toBe(12); // Pagume
      expect(ec.day).toBe(6);
    });

    test("Pagume 5 Non-Leap Year Boundary: September 10, 2024 is Pagume 5, 2016 EC", () => {
      const ec = toEthiopianDate("2024-09-10");
      expect(ec.year).toBe(2016);
      expect(ec.month).toBe(12); // Pagume
      expect(ec.day).toBe(5);
    });
  });

  describe("2. Bidirectional JDN Conversion Roundtrip", () => {
    test("jdnToEthiopic and ethiopicToJDN are consistent", () => {
      const year = 2018;
      const month0 = 11; // Nehase
      const day = 1;

      const jdn = ethiopicToJDN(year, month0, day);
      const ec = jdnToEthiopic(jdn);

      expect(ec.year).toBe(year);
      expect(ec.month).toBe(month0);
      expect(ec.day).toBe(day);
    });

    test("jdnToGregorian and gregorianToJDN roundtrip", () => {
      const gJdn = gregorianToJDN(2026, 8, 7);
      const d = jdnToGregorian(gJdn);
      expect(d.getUTCFullYear()).toBe(2026);
      expect(d.getUTCMonth() + 1).toBe(8);
      expect(d.getUTCDate()).toBe(7);
    });
  });

  describe("3. Timezone Edge Cases & UTC Midnight Parsing", () => {
    test("Date-only string '2026-08-07' does not drift one day backward", () => {
      const parts = getAddisAbabaDateParts("2026-08-07");
      expect(parts.year).toBe(2026);
      expect(parts.month).toBe(8);
      expect(parts.day).toBe(7);

      const ec = toEthiopianDate("2026-08-07");
      expect(ec.month).toBe(11); // Nehase
      expect(ec.day).toBe(1);
    });

    test("ISO UTC string '2026-08-07T00:00:00.000Z' formats correctly in Africa/Addis_Ababa timezone", () => {
      const ec = toEthiopianDate("2026-08-07T00:00:00.000Z");
      expect(ec.year).toBe(2018);
      expect(ec.month).toBe(11); // Nehase
      expect(ec.day).toBe(1);
    });
  });

  describe("4. Language Switching & Localization Formatting", () => {
    test("English language displays Gregorian date in Africa/Addis_Ababa timezone", () => {
      const formatted = formatLocalizedDate("2026-08-07", "en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      expect(formatted).toContain("Aug");
      expect(formatted).toContain("7");
      expect(formatted).toContain("2026");
    });

    test("Amharic language displays correct Ethiopian date format", () => {
      const formatted = formatLocalizedDate("2026-08-07", "am", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      expect(formatted).toContain("ነሐሴ");
      expect(formatted).toContain("1");
      expect(formatted).toContain("2018 ዓ.ም");
    });

    test("Language switching preserves underlying date value consistency", () => {
      const testDate = "2026-08-07T14:30:00.000Z";
      const enResult = formatLocalizedDate(testDate, "en", { month: "short", day: "numeric" });
      const amResult = formatLocalizedDate(testDate, "am", { month: "short", day: "numeric" });

      expect(enResult).toContain("Aug 7");
      expect(amResult).toContain("ነሐሴ 1");
    });
  });

  describe("5. Historical and Future Dates", () => {
    test("Historical date: Ethiopian Millennium (Meskerem 1, 2000 EC = Sept 12, 2007)", () => {
      const ec = toEthiopianDate("2007-09-12");
      expect(ec.year).toBe(2000);
      expect(ec.month).toBe(0); // Meskerem
      expect(ec.day).toBe(1);
    });

    test("Future date: August 7, 2030", () => {
      const ec = toEthiopianDate("2030-08-07");
      expect(ec.year).toBe(2022);
      expect(ec.month).toBe(11); // Nehase
      expect(ec.day).toBe(1);
    });
  });
});
