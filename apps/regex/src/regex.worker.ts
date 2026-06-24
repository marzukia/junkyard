/**
 * Web Worker: execute regex matching and replace off the main thread.
 *
 * Receives: WorkerRequest
 * Posts:    WorkerResponse
 *
 * Running in a worker means a catastrophic-backtracking pattern can't freeze
 * the browser tab — the main thread stays responsive and can terminate() this
 * worker if it doesn't respond within the timeout.
 */

import { execRegex, execReplace } from "./lib/regex";
import type { RegexFlag, RegexOutcome } from "./lib/regex";

export interface WorkerRequest {
  id: number;
  pattern: string;
  /** JSON-serialised Set<RegexFlag> — workers can't transfer Set objects */
  flags: RegexFlag[];
  text: string;
  replacement: string;
}

export interface WorkerResponse {
  id: number;
  result: RegexOutcome;
  replaceOutput: string;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, pattern, flags, text, replacement } = e.data;
  const flagSet = new Set<RegexFlag>(flags);

  const result = execRegex(pattern, flagSet, text);
  const replaceOutput = execReplace(pattern, flagSet, text, replacement);

  const response: WorkerResponse = { id, result, replaceOutput };
  self.postMessage(response);
};
