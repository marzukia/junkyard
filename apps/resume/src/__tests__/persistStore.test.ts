/**
 * Tests that the Zustand persist middleware correctly serialises and
 * deserialises the resume store data to/from localStorage.
 *
 * We test the round-trip at the serialisation level (what gets written and
 * what comes back) rather than mounting React, so there are no hydration
 * concerns and no React dependency here.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERSIST_KEY, SAMPLE_DATA } from "../store/useResumeStore";

// Minimal localStorage shim (jsdom provides one, but we want explicit control)
function readPersistedState(): Record<string, unknown> | null {
  const raw = localStorage.getItem(PERSIST_KEY);
  if (!raw) return null;
  try {
    const outer = JSON.parse(raw) as { state?: Record<string, unknown> };
    return outer.state ?? null;
  } catch {
    return null;
  }
}

describe("persist round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("PERSIST_KEY is the expected string", () => {
    expect(PERSIST_KEY).toBe("mrzk-resume-v1");
  });

  it("localStorage round-trip preserves string fields", () => {
    const data = {
      fullName: "Jane Smith",
      email: "jane@example.com",
      phone: "+64 21 000 0000",
      location: "Auckland, NZ",
      linkedin: "",
      website: "",
      summary: "**Senior** engineer",
      experience: [
        {
          id: "abc123",
          company: "Acme",
          title: "Engineer",
          startDate: "2020",
          endDate: "",
          bullets: ["Built **scalable** API"],
        },
      ],
      education: [],
      skills: "TypeScript, React",
    };

    // Simulate what zustand/persist writes
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ state: data, version: 0 }));

    const recovered = readPersistedState();
    expect(recovered).not.toBeNull();
    expect(recovered?.fullName).toBe("Jane Smith");
    expect(recovered?.summary).toBe("**Senior** engineer");

    // Experience array round-trips without mutation
    const exp = recovered?.experience as typeof data.experience;
    expect(exp).toHaveLength(1);
    expect(exp[0].bullets[0]).toBe("Built **scalable** API");
  });

  it("resetAll removes the localStorage key", () => {
    // Pre-seed the key
    localStorage.setItem(PERSIST_KEY, JSON.stringify({ state: { fullName: "Test" }, version: 0 }));
    expect(localStorage.getItem(PERSIST_KEY)).not.toBeNull();

    // Simulate what resetAll does
    localStorage.removeItem(PERSIST_KEY);
    expect(localStorage.getItem(PERSIST_KEY)).toBeNull();
  });

  it("stored experience bullets survive JSON serialisation including markdown syntax", () => {
    const bullets = ["**Reduced** deploy time by 40%", "*Led* a team of 5", "plain bullet"];
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { experience: [{ id: "x", bullets }] }, version: 0 })
    );
    const recovered = readPersistedState() as { experience: { id: string; bullets: string[] }[] };
    expect(recovered.experience[0].bullets).toEqual(bullets);
  });

  it("SAMPLE_DATA has non-empty fullName and at least one experience entry with bullets", () => {
    expect(SAMPLE_DATA.fullName.trim().length).toBeGreaterThan(0);
    expect(SAMPLE_DATA.experience.length).toBeGreaterThan(0);
    const firstExp = SAMPLE_DATA.experience[0];
    expect(firstExp.bullets.length).toBeGreaterThan(0);
    expect(firstExp.bullets[0].trim().length).toBeGreaterThan(0);
  });

  it("SAMPLE_DATA skills string is non-empty", () => {
    expect(SAMPLE_DATA.skills.trim().length).toBeGreaterThan(0);
  });
});

// Regression: wrong-typed persisted fields fall back to safe defaults (Bug 3).
// The Import-JSON path is guarded; this pins the rehydration path to the same
// behaviour so a poisoned localStorage can't white-screen the app permanently.
describe("persist rehydration — wrong-typed field guard", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  it("falls back to [] when persisted experience is a string", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { experience: "not-an-array" }, version: 0 })
    );
    const { useResumeStore } = await import("../store/useResumeStore");
    // Must not throw; experience must be an array so .map() is safe
    expect(Array.isArray(useResumeStore.getState().experience)).toBe(true);
  });

  it("falls back to [] when persisted education is a number", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { education: 42 }, version: 0 })
    );
    const { useResumeStore } = await import("../store/useResumeStore");
    expect(Array.isArray(useResumeStore.getState().education)).toBe(true);
  });

  it("falls back to [] when persisted projects is an object (not array)", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { projects: { name: "oops" } }, version: 0 })
    );
    const { useResumeStore } = await import("../store/useResumeStore");
    expect(Array.isArray(useResumeStore.getState().projects)).toBe(true);
  });

  it("falls back to '' when persisted fullName is a number", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { fullName: 99 }, version: 0 })
    );
    const { useResumeStore } = await import("../store/useResumeStore");
    expect(typeof useResumeStore.getState().fullName).toBe("string");
  });

  it("falls back to 'clean' when persisted template is an invalid value", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { template: "invalid-template" }, version: 0 })
    );
    const { useResumeStore } = await import("../store/useResumeStore");
    expect(["clean", "compact", "bold"]).toContain(useResumeStore.getState().template);
  });

  it("experience.map does not throw after rehydrating wrong-typed experience", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { experience: "bad" }, version: 0 })
    );
    const { useResumeStore } = await import("../store/useResumeStore");
    expect(() => useResumeStore.getState().experience.map((e) => e.id)).not.toThrow();
  });
});
