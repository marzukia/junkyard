import { describe, expect, it } from "vitest";
import {
  filteredBullets,
  formatDateRange,
  hasContactInfo,
  hasEducationContent,
  hasExperienceContent,
  parseSkills,
} from "../lib/resumeUtils";
import type { EducationEntry, ExperienceEntry } from "../store/useResumeStore";

describe("formatDateRange", () => {
  it("returns empty string when both fields are empty", () => {
    expect(formatDateRange("", "")).toBe("");
  });

  it("appends Present when endDate is empty", () => {
    expect(formatDateRange("Jan 2020", "")).toBe("Jan 2020 - Present");
  });

  it("returns full range when both provided", () => {
    expect(formatDateRange("2019", "2023")).toBe("2019 - 2023");
  });

  it("returns endDate only when start is empty", () => {
    expect(formatDateRange("", "2022")).toBe("2022");
  });

  it("trims whitespace from inputs", () => {
    expect(formatDateRange("  Mar 2021  ", "  Dec 2022  ")).toBe("Mar 2021 - Dec 2022");
  });
});

describe("parseSkills", () => {
  it("splits on commas", () => {
    const result = parseSkills("TypeScript, React, Go");
    expect(result).toEqual(["TypeScript", "React", "Go"]);
  });

  it("splits on newlines", () => {
    const result = parseSkills("Python\nDjango\nPostgres");
    expect(result).toEqual(["Python", "Django", "Postgres"]);
  });

  it("filters empty tokens", () => {
    const result = parseSkills("A,,B,,C");
    expect(result).toEqual(["A", "B", "C"]);
  });

  it("returns empty array for blank input", () => {
    expect(parseSkills("   ")).toEqual([]);
  });

  it("trims each token", () => {
    const result = parseSkills("  Docker ,  Kubernetes  ");
    expect(result).toEqual(["Docker", "Kubernetes"]);
  });

  it("preserves multi-char tokens like C++ intact", () => {
    // Splits only on comma/newline — the '+' chars must survive untouched
    expect(parseSkills("C++, Python")).toEqual(["C++", "Python"]);
  });

  it("preserves C# intact", () => {
    expect(parseSkills("C#, Java, Go")).toEqual(["C#", "Java", "Go"]);
  });

  it("preserves .NET intact", () => {
    expect(parseSkills(".NET, Node.js, TypeScript")).toEqual([".NET", "Node.js", "TypeScript"]);
  });

  it("handles mixed comma and newline delimiters with special tokens", () => {
    const result = parseSkills("C++\nC#\n.NET, Node.js");
    expect(result).toEqual(["C++", "C#", ".NET", "Node.js"]);
  });
});

describe("hasContactInfo", () => {
  it("returns false when all fields are empty", () => {
    expect(hasContactInfo({ fullName: "", email: "", phone: "", location: "" })).toBe(false);
  });

  it("returns true when fullName is filled", () => {
    expect(hasContactInfo({ fullName: "Jane", email: "", phone: "", location: "" })).toBe(true);
  });

  it("returns true when only email is filled", () => {
    expect(hasContactInfo({ fullName: "", email: "j@example.com", phone: "", location: "" })).toBe(
      true
    );
  });

  it("treats whitespace-only as empty", () => {
    expect(hasContactInfo({ fullName: "   ", email: "  ", phone: "", location: "" })).toBe(false);
  });
});

describe("hasExperienceContent", () => {
  function makeExp(overrides: Partial<ExperienceEntry> = {}): ExperienceEntry {
    return {
      id: "x",
      company: "",
      title: "",
      startDate: "",
      endDate: "",
      bullets: [""],
      ...overrides,
    };
  }

  it("returns false for an empty entry", () => {
    expect(hasExperienceContent(makeExp())).toBe(false);
  });

  it("returns true when company is filled", () => {
    expect(hasExperienceContent(makeExp({ company: "Acme" }))).toBe(true);
  });

  it("returns true when any bullet has content", () => {
    expect(hasExperienceContent(makeExp({ bullets: ["Did something great"] }))).toBe(true);
  });
});

describe("hasEducationContent", () => {
  function makeEdu(overrides: Partial<EducationEntry> = {}): EducationEntry {
    return {
      id: "e",
      institution: "",
      degree: "",
      field: "",
      startDate: "",
      endDate: "",
      ...overrides,
    };
  }

  it("returns false for an empty entry", () => {
    expect(hasEducationContent(makeEdu())).toBe(false);
  });

  it("returns true when institution is set", () => {
    expect(hasEducationContent(makeEdu({ institution: "MIT" }))).toBe(true);
  });
});

describe("filteredBullets", () => {
  it("removes empty and whitespace-only lines", () => {
    const result = filteredBullets(["Built X", "", "  ", "Shipped Y"]);
    expect(result).toEqual(["Built X", "Shipped Y"]);
  });

  it("trims each bullet", () => {
    const result = filteredBullets(["  trimmed  "]);
    expect(result).toEqual(["trimmed"]);
  });

  it("returns empty array for all-blank input", () => {
    expect(filteredBullets(["", " ", ""])).toEqual([]);
  });
});
