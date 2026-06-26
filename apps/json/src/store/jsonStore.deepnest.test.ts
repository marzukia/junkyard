/**
 * Regression tests for jsonStore deep-nesting robustness (Bug 4).
 *
 * buildTree is unbounded-recursive; a 5000-deep structure exceeds the JS call
 * stack. deriveSync now wraps the buildTree call in try/catch so tree is set
 * to null instead of throwing an uncaught "Maximum call stack size exceeded".
 */
import { beforeEach, describe, expect, it } from "vitest";

/** Build a JSON string that nests objects N levels deep: {"a":{"a":{...}}} */
function deepJson(depth: number): string {
  return `${"{"}"a":`.repeat(depth) + "1" + `${"}"}`.repeat(depth);
}

describe("jsonStore — deep nesting does not throw (Bug 4)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("setInput with a 5000-deep JSON does not throw", async () => {
    const { useJsonStore } = await import("./jsonStore");
    const json = deepJson(5000);
    expect(() => useJsonStore.getState().setInput(json)).not.toThrow();
  });

  it("tree is null (not a crashed state) after a stack-overflow-depth input", async () => {
    const { useJsonStore } = await import("./jsonStore");
    const json = deepJson(5000);
    useJsonStore.getState().setInput(json);
    // tree should be null — graceful degradation
    expect(useJsonStore.getState().tree).toBeNull();
  });

  it("setInput with a 5000-deep JSON in tree viewMode also does not throw", async () => {
    const { useJsonStore } = await import("./jsonStore");
    useJsonStore.getState().setViewMode("tree");
    const json = deepJson(5000);
    expect(() => useJsonStore.getState().setInput(json)).not.toThrow();
  });

  it("normal shallow JSON still builds a valid tree", async () => {
    const { useJsonStore } = await import("./jsonStore");
    useJsonStore.getState().setViewMode("tree");
    useJsonStore.getState().setInput('{"name":"Alice","age":30}');
    const tree = useJsonStore.getState().tree;
    expect(tree).not.toBeNull();
    expect(tree?.kind).toBe("object");
  });
});
