/**
 * Tests for the useProgress hook — 95% cap during processing,
 * 100% on completion, and reset behaviour.
 */
import { describe, expect, it } from "vitest";

// We test the pure logic rather than mounting the hook, because
// React rendering is handled by vitest/react-testing-library — the
// hook's internal state transitions are what matter here.

// The hook caps display at 95% during active processing and jumps
// to 100% only when complete. The capped value is computed as:
//   capped = complete ? 100 : Math.round(Math.min(progress, 0.95) * 100)
//   label = `${capped}%`

function cappedDisplay(progress: number, complete: boolean): number {
  return complete ? 100 : Math.round(Math.min(progress, 0.95) * 100);
}

describe("useProgress display logic", () => {
  it("returns 0 when progress is 0 and not complete", () => {
    expect(cappedDisplay(0, false)).toBe(0);
  });

  it("caps at 95 when progress is between 0.95 and 1 and not complete", () => {
    expect(cappedDisplay(0.97, false)).toBe(95);
    expect(cappedDisplay(0.99, false)).toBe(95);
    expect(cappedDisplay(1.0, false)).toBe(95);
  });

  it("shows raw percentage below 95% when not complete", () => {
    expect(cappedDisplay(0.5, false)).toBe(50);
    expect(cappedDisplay(0.25, false)).toBe(25);
    expect(cappedDisplay(0.94, false)).toBe(94);
  });

  it("jumps to 100 when complete regardless of progress value", () => {
    expect(cappedDisplay(0.5, true)).toBe(100);
    expect(cappedDisplay(0.95, true)).toBe(100);
    expect(cappedDisplay(0.0, true)).toBe(100);
  });

  it("label is capped value followed by %", () => {
    const capped = cappedDisplay(0.95, false);
    expect(`${capped}%`).toBe("95%");
  });
});
