import { resolveWordPressDateTime } from "fluent-wp-client";
import { describe, expect, it } from "vitest";

/**
 * Integration coverage for resolving WordPress local datetimes with catalog timezones.
 */
describe("WordPress datetime helpers", () => {
  it("combines a WordPress local datetime with an IANA timezone offset", () => {
    const resolved = resolveWordPressDateTime(
      "2025-01-01T12:00:00",
      "America/New_York",
    );

    expect(resolved).toMatchObject({
      iso: "2025-01-01T12:00:00-05:00",
      offset: "-05:00",
      offsetMinutes: -300,
      timezone: "America/New_York",
      value: "2025-01-01T12:00:00",
    });
  });

  it("returns undefined when timezone metadata is unavailable", () => {
    expect(
      resolveWordPressDateTime("2025-01-01T12:00:00", undefined),
    ).toBeUndefined();
  });
});
