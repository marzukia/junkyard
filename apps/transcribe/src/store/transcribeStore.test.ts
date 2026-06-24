import { describe, expect, it, beforeEach } from "vitest";
import { useTranscribeStore } from "./transcribeStore";

describe("setTranscribeProgress merges fields (CoTiming fix)", () => {
  beforeEach(() => {
    // Reset to initial state between tests
    useTranscribeStore.getState().reset();
  });

  it("retains chunksProcessed when a second call only sets elapsedSec", () => {
    const { setTranscribeProgress } = useTranscribeStore.getState();

    setTranscribeProgress({ elapsedSec: 5 });
    setTranscribeProgress({ chunksProcessed: 3 });

    const { transcribeProgress } = useTranscribeStore.getState();
    expect(transcribeProgress.elapsedSec).toBe(5);
    expect(transcribeProgress.chunksProcessed).toBe(3);
  });

  it("retains elapsedSec when a second call only sets chunksProcessed", () => {
    const { setTranscribeProgress } = useTranscribeStore.getState();

    setTranscribeProgress({ chunksProcessed: 7 });
    setTranscribeProgress({ elapsedSec: 12 });

    const { transcribeProgress } = useTranscribeStore.getState();
    expect(transcribeProgress.chunksProcessed).toBe(7);
    expect(transcribeProgress.elapsedSec).toBe(12);
  });
});
