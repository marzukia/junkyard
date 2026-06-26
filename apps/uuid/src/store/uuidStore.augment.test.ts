/**
 * Regression test for dogfood bug #3:
 * setNameValue only called set({nameValue}) — no regenerate trigger.
 * Typing a name for v3/v5 left a stale UUID until manual Regenerate.
 *
 * Fix: setNameValue now calls buildAndSet({nameValue}), matching setNamespaceName.
 *
 * Perturbation: revert setNameValue to `set({nameValue})` only — the test below
 * fails because ids is empty (store was just initialised, no build triggered).
 */
import { describe, expect, it } from "vitest";
import { UUID_NAMESPACES } from "../lib/uuid";
import { useUuidStore } from "./uuidStore";

const DNS_NS = UUID_NAMESPACES.DNS;
// RFC 4122 Appendix C test vector: v5 of DNS + "python.org"
const V5_PYTHON_ORG = "886313e1-3b8a-5372-9b90-0c9aee199e5d";

describe("uuidStore — setNameValue triggers regeneration (bug #3 regression)", () => {
  it("setNameValue with v5+DNS+count=1 produces the RFC vector for python.org", async () => {
    const store = useUuidStore.getState();

    // count=1 ensures generateNameBased uses the name as-is (no index suffix)
    store.setCount(1);
    store.setKind("v5");
    store.setNamespaceName("DNS");
    await new Promise((r) => setTimeout(r, 50));

    // Now set the name — this must trigger a rebuild (the fix)
    store.setNameValue("python.org");
    // Wait for async crypto.subtle SHA-1
    await new Promise((r) => setTimeout(r, 50));

    const { ids } = useUuidStore.getState();
    // ids[0] should equal the RFC vector for v5(DNS, "python.org")
    expect(ids[0]).toBe(V5_PYTHON_ORG);
  });

  it("setNameValue updates ids without calling generate() manually", async () => {
    const store = useUuidStore.getState();
    store.setCount(1);
    store.setKind("v5");
    store.setNamespaceName("DNS");
    store.setNameValue("initial.com");
    await new Promise((r) => setTimeout(r, 50));

    const before = useUuidStore.getState().ids[0];

    // Change name — should auto-regenerate
    store.setNameValue("example.com");
    await new Promise((r) => setTimeout(r, 50));

    const after = useUuidStore.getState().ids[0];
    // Different name => different UUID
    expect(after).not.toBe(before);
    // And it must be a well-formed v5 UUID
    expect(after).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
