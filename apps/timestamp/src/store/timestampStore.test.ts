import { afterEach, describe, expect, it } from "vitest";
import { useTimestampStore } from "./timestampStore";

const TZ_STORAGE_KEY = "ts-tool-timezone";

afterEach(() => {
  localStorage.clear();
});

describe("timezone persistence", () => {
  it("setTimezone writes the chosen timezone to localStorage", () => {
    useTimestampStore.getState().setTimezone("Pacific/Auckland");
    expect(localStorage.getItem(TZ_STORAGE_KEY)).toBe("Pacific/Auckland");
  });

  it("setTimezone overwrites a previously stored timezone", () => {
    useTimestampStore.getState().setTimezone("Asia/Tokyo");
    useTimestampStore.getState().setTimezone("America/New_York");
    expect(localStorage.getItem(TZ_STORAGE_KEY)).toBe("America/New_York");
  });

  it("store reflects the timezone set via setTimezone", () => {
    useTimestampStore.getState().setTimezone("Europe/London");
    expect(useTimestampStore.getState().timezone).toBe("Europe/London");
  });
});
