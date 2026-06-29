/**
 * phaseGuard.ts — shared phase-transition guard for AI app stores.
 *
 * Each AI store (bg, caption, depth, summarize, transcribe, translate, upscale)
 * tracks a monotonic pipeline phase. Transitions should only advance forward
 * (or reset to idle). This utility provides that logic so it isn't duplicated
 * across 7 stores.
 *
 * Usage:
 *   import { phaseTransition } from "../../../kit/lib/phaseGuard";
 *   // In your store's setPhase action:
 *   setPhase: (phase) => set((s) => phaseTransition(s.phase, phase, PHASE_RANK)),
 */

/**
 * Compute the next state for a phase transition.
 *
 * @param currentPhase — the current phase from state
 * @param nextPhase — the desired phase
 * @param rank — map of phase name → numeric rank (higher = further along)
 *
 * Returns `{ phase: nextPhase }` if the transition is valid, or `{}` (no-op)
 * if the transition would regress.
 *
 * "idle" is always allowed (reset/cancel sentinel).
 */
export function phaseTransition<PhaseType extends string>(
  currentPhase: PhaseType,
  nextPhase: PhaseType,
  rank: Record<PhaseType, number>
): Record<string, unknown> {
  return nextPhase === "idle" || rank[nextPhase] >= rank[currentPhase]
    ? { phase: nextPhase }
    : {};
}
