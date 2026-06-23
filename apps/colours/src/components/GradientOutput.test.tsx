// @vitest-environment jsdom
//
// Component-level regression guard for the Copy CSS copy path.
//
// Bug context: `handleCopyCss` previously wrote `previewGradient` (CVD-simulated
// colours) to the clipboard instead of `realGradient` (original palette). The
// pure `toCssGradient` helper tests in color.test.ts are VACUOUS for this bug —
// reverting the production fix leaves them green. This test fails under that
// revert by asserting that the string actually written to the clipboard after
// clicking "Copy CSS" contains the real hexes and not the simulated ones.
//
// Perturbation proof: temporarily changing `handleCopyCss` to write
// `previewGradient` instead of `realGradient` makes this test fail with:
//   "expected string containing '#ff0000'" / "expected string not containing '#968a00'"
// Restoring the fix returns it to passing.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GradientOutput } from "./GradientOutput";

// These colours are intentionally chosen to be visually distinct so any
// accidental leak of simulated values into the real string is caught.
const REAL_COLORS = ["#ff0000", "#00ff00", "#0000ff"];
// Plausible deuteranopia-simulated substitutes (different from real values).
const SIMULATED_COLORS = ["#968a00", "#968a00", "#1616ff"];

describe("GradientOutput — Copy CSS writes real colours, not CVD-simulated colours", () => {
  let clipboardSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clipboardSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: clipboardSpy },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("clipboard receives the real hex values after clicking 'Copy CSS'", async () => {
    render(<GradientOutput colors={REAL_COLORS} displayColors={SIMULATED_COLORS} />);

    const copyBtn = screen.getByRole("button", {
      name: /copy css/i,
    });
    fireEvent.click(copyBtn);

    // Flush the microtask that awaits navigator.clipboard.writeText
    await vi.waitFor(() => expect(clipboardSpy).toHaveBeenCalledOnce());

    const written: string = clipboardSpy.mock.calls[0][0];

    // Must contain every real hex
    for (const hex of REAL_COLORS) {
      expect(written, `clipboard string should contain real colour ${hex}`).toContain(hex);
    }
  });

  it("clipboard does NOT contain any CVD-simulated colour when 'Copy CSS' is clicked", async () => {
    render(<GradientOutput colors={REAL_COLORS} displayColors={SIMULATED_COLORS} />);

    fireEvent.click(screen.getByRole("button", { name: /copy css/i }));

    await vi.waitFor(() => expect(clipboardSpy).toHaveBeenCalledOnce());

    const written: string = clipboardSpy.mock.calls[0][0];

    // Simulated-only values must not appear in the clipboard string.
    // #968a00 exists only in SIMULATED_COLORS, never in REAL_COLORS.
    expect(
      written,
      "clipboard must not contain #968a00 (simulated red/green substitute)"
    ).not.toContain("#968a00");
    expect(written, "clipboard must not contain #1616ff (simulated blue substitute)").not.toContain(
      "#1616ff"
    );
  });

  it("clipboard receives real colours even when displayColors is omitted", async () => {
    render(<GradientOutput colors={REAL_COLORS} />);

    fireEvent.click(screen.getByRole("button", { name: /copy css/i }));

    await vi.waitFor(() => expect(clipboardSpy).toHaveBeenCalledOnce());

    const written: string = clipboardSpy.mock.calls[0][0];

    for (const hex of REAL_COLORS) {
      expect(written).toContain(hex);
    }
  });
});
