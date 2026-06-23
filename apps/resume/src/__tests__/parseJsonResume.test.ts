import { describe, expect, it } from "vitest";
import { parseJsonResume } from "../store/useResumeStore";

describe("parseJsonResume - internal format", () => {
  it("returns error for non-object", () => {
    expect(parseJsonResume("not an object")).toEqual({
      ok: false,
      error: "File must contain a JSON object.",
    });
    expect(parseJsonResume(null)).toEqual({ ok: false, error: "File must contain a JSON object." });
    expect(parseJsonResume([1, 2])).toEqual({
      ok: false,
      error: "File must contain a JSON object.",
    });
  });

  it("parses basic string fields", () => {
    const result = parseJsonResume({
      fullName: "Jane Smith",
      email: "jane@example.com",
      skills: "TypeScript, Go",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fullName).toBe("Jane Smith");
    expect(result.data.email).toBe("jane@example.com");
    expect(result.data.skills).toBe("TypeScript, Go");
  });

  it("parses experience entries", () => {
    const result = parseJsonResume({
      experience: [
        {
          company: "Acme",
          title: "Engineer",
          startDate: "Jan 2020",
          endDate: "Dec 2022",
          bullets: ["Built X", "Shipped Y"],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exp = result.data.experience;
    expect(exp).toHaveLength(1);
    expect(exp?.[0].company).toBe("Acme");
    expect(exp?.[0].bullets).toEqual(["Built X", "Shipped Y"]);
    // ids are generated fresh
    expect(typeof exp?.[0].id).toBe("string");
    expect((exp?.[0].id ?? "").length).toBeGreaterThan(0);
  });

  it("parses projects and certifications", () => {
    const result = parseJsonResume({
      projects: [{ name: "Harakeke", url: "https://github.com/x/y", description: "A CLI tool" }],
      certifications: [{ name: "AWS SA", issuer: "Amazon", date: "2023" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.projects?.[0].name).toBe("Harakeke");
    expect(result.data.certifications?.[0].issuer).toBe("Amazon");
  });

  it("only accepts valid template ids", () => {
    const valid = parseJsonResume({ template: "bold" });
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.data.template).toBe("bold");

    const invalid = parseJsonResume({ template: "fancy-custom" });
    expect(invalid.ok).toBe(true);
    if (!invalid.ok) return;
    // Invalid template should not be passed through
    expect(invalid.data.template).toBeUndefined();
  });
});

describe("parseJsonResume - JSON Resume schema", () => {
  it("parses basics section", () => {
    const result = parseJsonResume({
      basics: {
        name: "Alex Tane",
        email: "alex@example.com",
        phone: "+64 21 000 0000",
        summary: "Senior engineer",
        location: { city: "Wellington", region: "Wellington", countryCode: "NZ" },
        profiles: [{ network: "LinkedIn", url: "https://linkedin.com/in/alextane" }],
        url: "https://alextane.dev",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.fullName).toBe("Alex Tane");
    expect(result.data.email).toBe("alex@example.com");
    expect(result.data.location).toBe("Wellington, Wellington, NZ");
    expect(result.data.linkedin).toContain("linkedin.com");
    expect(result.data.website).toBe("https://alextane.dev");
  });

  it("parses work experience from JSON Resume schema", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      work: [
        {
          name: "Acme Corp",
          position: "Engineer",
          startDate: "2020-01",
          endDate: "2022-06",
          highlights: ["Built X", "Shipped Y"],
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const exp = result.data.experience;
    expect(exp).toHaveLength(1);
    expect(exp?.[0].company).toBe("Acme Corp");
    expect(exp?.[0].title).toBe("Engineer");
    expect(exp?.[0].startDate).toBe("Jan 2020");
    expect(exp?.[0].endDate).toBe("Jun 2022");
    expect(exp?.[0].bullets).toEqual(["Built X", "Shipped Y"]);
  });

  it("parses education from JSON Resume schema", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      education: [
        {
          institution: "VUW",
          studyType: "Bachelor of Science",
          area: "Computer Science",
          startDate: "2014",
          endDate: "2017",
        },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const edu = result.data.education;
    expect(edu?.[0].institution).toBe("VUW");
    expect(edu?.[0].degree).toBe("Bachelor of Science");
    expect(edu?.[0].field).toBe("Computer Science");
  });

  it("parses skills keywords from JSON Resume schema", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      skills: [
        { name: "Frontend", keywords: ["React", "TypeScript"] },
        { name: "Backend", keywords: ["Go", "PostgreSQL"] },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.skills).toBe("React, TypeScript, Go, PostgreSQL");
  });

  it("parses languages from JSON Resume schema", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      languages: [
        { language: "English", fluency: "Native speaker" },
        { language: "Spanish", fluency: "Professional" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.languages).toBe("English (Native speaker), Spanish (Professional)");
  });

  it("parses certificates from JSON Resume schema", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      certificates: [{ name: "AWS SA", issuer: "Amazon", date: "2022-03" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.certifications?.[0].name).toBe("AWS SA");
    expect(result.data.certifications?.[0].date).toBe("Mar 2022");
  });
});

describe("formatJsonResumeDate (via parseJsonResume)", () => {
  it("converts YYYY-MM-DD to Mon YYYY", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      work: [{ name: "X", position: "Y", startDate: "2021-03-15", endDate: "" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.experience?.[0].startDate).toBe("Mar 2021");
  });

  it("passes through plain year strings", () => {
    const result = parseJsonResume({
      basics: { name: "A" },
      education: [{ institution: "X", studyType: "BSc", area: "CS", startDate: "2014" }],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.education?.[0].startDate).toBe("2014");
  });
});
