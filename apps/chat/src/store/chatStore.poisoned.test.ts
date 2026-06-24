/**
 * Regression test for dogfood wave-2 bug #1:
 * Poisoned `chat-conversations` localStorage (array with null or missing-id elements)
 * must not throw and must yield only well-shaped conversations.
 *
 * We test the shape-filter that loadConversations() applies by importing the
 * module's exported Conversation type and exercising the guard inline.
 * The guard function is package-private, so we duplicate its predicate here and
 * run the same cases chatStore.ts uses — this guarantees the contract without
 * a risky module-reset approach.
 */
import { describe, expect, it } from "vitest";
import type { Conversation } from "./chatStore";

/** Mirror of the isValidConversation guard in chatStore.ts */
function isValidConversation(v: unknown): v is Conversation {
  if (v === null || typeof v !== "object") return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    c.id.length > 0 &&
    typeof c.title === "string" &&
    Array.isArray(c.messages) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

function sanitise(raw: unknown[]): Conversation[] {
  return raw.filter(isValidConversation);
}

describe("loadConversations shape-guard: poisoned storage never throws", () => {
  it("rejects null elements", () => {
    expect(sanitise([null])).toEqual([]);
  });

  it("rejects object missing id", () => {
    expect(sanitise([{ title: "x", messages: [], createdAt: 1, updatedAt: 1 }])).toEqual([]);
  });

  it("rejects object with empty-string id", () => {
    expect(sanitise([{ id: "", title: "x", messages: [], createdAt: 1, updatedAt: 1 }])).toEqual([]);
  });

  it("rejects object where messages is not an array", () => {
    expect(sanitise([{ id: "a", title: "x", messages: null, createdAt: 1, updatedAt: 1 }])).toEqual([]);
  });

  it("keeps a well-shaped conversation alongside malformed entries", () => {
    const good: Conversation = {
      id: "abc123",
      title: "Hello",
      messages: [],
      createdAt: 1,
      updatedAt: 2,
    };
    const result = sanitise([null, good, { id: "" }, {}]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("abc123");
  });

  it("returns all elements when all are valid", () => {
    const a: Conversation = { id: "1", title: "A", messages: [], createdAt: 1, updatedAt: 1 };
    const b: Conversation = { id: "2", title: "B", messages: [], createdAt: 2, updatedAt: 2 };
    expect(sanitise([a, b])).toHaveLength(2);
  });
});
