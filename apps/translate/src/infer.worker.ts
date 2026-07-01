/**
 * Web Worker for translate: runs model load + inference off the main thread.
 */
import type { WorkerRequest } from "@junkyardsh/kit";
import { postError, postResult } from "../../../kit/lib/workerInference";
import type { TranslationResult } from "./lib/translator";
import { isTranslatorLoaded, loadTranslator, translateText } from "./lib/translator";

type Args = {
  text: string;
  sourceLang: string;
  targetLang: string;
};

self.onmessage = async (e: MessageEvent<WorkerRequest<Args>>) => {
  if (e.data.type !== "run") return;
  const { text, sourceLang, targetLang } = e.data.args;

  try {
    if (!isTranslatorLoaded()) {
      await loadTranslator();
    }

    const result = await translateText(text, sourceLang, targetLang, (done, total) => {
      const msg: WorkerMsg<TranslationResult> = { type: "chunk_progress", done, total };
      self.postMessage(msg);
    });

    postResult<TranslationResult>(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error during translation.";
    postError<TranslationResult>(message);
  }
};
