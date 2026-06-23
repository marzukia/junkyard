/**
 * Augmented tests for resume/resumeJson.ts.
 * exportResumeJson is a pure serialisation function not covered by any
 * existing test in src/__tests__/. downloadJson requires a live DOM/browser
 * and is not testable here.
 */
import { describe, expect, it } from "vitest";
import { exportResumeJson } from "../lib/resumeJson";
import type { ResumeData } from "../store/useResumeStore";

function makeResumeData(overrides: Partial<ResumeData> = {}): ResumeData {
  return {
    fullName: "Jane Smith",
    email: "jane@example.com",
    phone: "+64 21 000 0000",
    location: "Wellington, NZ",
    linkedin: "https://linkedin.com/in/janesmith",
    website: "https://janesmith.dev",
    summary: "Senior software engineer.",
    experience: [
      {
        id: "exp1",
        company: "Acme Corp",
        title: "Engineer",
        startDate: "Jan 2020",
        endDate: "Dec 2022",
        bullets: ["Built scalable APIs", "Led team of 5"],
      },
    ],
    education: [
      {
        id: "edu1",
        institution: "VUW",
        degree: "BSc",
        field: "Computer Science",
        startDate: "2014",
        endDate: "2017",
      },
    ],
    skills: "TypeScript, Go, React",
    ...overrides,
  };
}

// ── exportResumeJson ──────────────────────────────────────────────────────────

describe("exportResumeJson", () => {
  it("returns a valid JSON string", () => {
    const data = makeResumeData();
    const json = exportResumeJson(data);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("round-trips through JSON.parse with the same fullName", () => {
    const data = makeResumeData({ fullName: "Alex Tane" });
    const json = exportResumeJson(data);
    const parsed = JSON.parse(json) as ResumeData;
    expect(parsed.fullName).toBe("Alex Tane");
  });

  it("preserves experience entries including bullets", () => {
    const data = makeResumeData();
    const json = exportResumeJson(data);
    const parsed = JSON.parse(json) as ResumeData;
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.experience[0]?.bullets).toEqual(["Built scalable APIs", "Led team of 5"]);
  });

  it("preserves education entries", () => {
    const data = makeResumeData();
    const json = exportResumeJson(data);
    const parsed = JSON.parse(json) as ResumeData;
    expect(parsed.education?.[0]?.institution).toBe("VUW");
  });

  it("output is pretty-printed (contains newlines)", () => {
    const data = makeResumeData();
    const json = exportResumeJson(data);
    expect(json).toContain("\n");
  });

  it("produces identical output when called twice on the same data", () => {
    const data = makeResumeData();
    expect(exportResumeJson(data)).toBe(exportResumeJson(data));
  });

  it("serialises empty arrays without dropping them", () => {
    const data = makeResumeData({ experience: [], education: [] });
    const parsed = JSON.parse(exportResumeJson(data)) as ResumeData;
    expect(Array.isArray(parsed.experience)).toBe(true);
    expect(parsed.experience).toHaveLength(0);
  });

  it("handles special characters in text fields without mangling them", () => {
    const data = makeResumeData({ summary: 'Led "cross-team" efforts & shipped <v2>' });
    const parsed = JSON.parse(exportResumeJson(data)) as ResumeData;
    expect(parsed.summary).toBe('Led "cross-team" efforts & shipped <v2>');
  });
});
