/**
 * Integration test: resumePdf Unicode crash regression.
 *
 * Verifies that generateResumePdf() resolves to a non-empty Uint8Array
 * even when the input contains non-WinAnsi characters (e.g. Japanese name,
 * Arabic summary, Devanagari location). CDN fetch is stubbed to fail so
 * the sanitize-fallback path is exercised.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateResumePdf } from "../lib/resumePdf";

const MOCK_FETCH_FAIL = () =>
  Promise.resolve({
    ok: false,
    status: 503,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response);

const BASE_INPUT = {
  fullName: "Jane Smith",
  email: "jane@example.com",
  phone: "+1 555 0100",
  location: "Auckland, NZ",
  linkedin: "",
  website: "",
  summary: "",
  experience: [],
  education: [],
  skills: "",
  projects: [],
  certifications: [],
  languages: "",
  template: "clean" as const,
};

describe("generateResumePdf – WinAnsi crash guard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(MOCK_FETCH_FAIL));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("produces bytes for a Latin name (baseline)", async () => {
    const result = await generateResumePdf(BASE_INPUT);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces bytes (does not throw) with a Japanese full name", async () => {
    const result = await generateResumePdf({ ...BASE_INPUT, fullName: "田中 花子" });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces bytes with an Arabic summary", async () => {
    const result = await generateResumePdf({
      ...BASE_INPUT,
      summary: "مهندس برمجيات ذو خبرة",
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces bytes with a Devanagari location", async () => {
    const result = await generateResumePdf({
      ...BASE_INPUT,
      location: "मुंबई, भारत",
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });

  it("produces bytes with experience containing non-Latin company name", async () => {
    const result = await generateResumePdf({
      ...BASE_INPUT,
      experience: [
        {
          id: "1",
          title: "Engineer",
          company: "会社名株式会社",
          startDate: "2020-01",
          endDate: "",
          bullets: ["Built stuff"],
        },
      ],
    });
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
  });
});
