/**
 * Pure stream/MediaRecorder logic for the Screen Recorder tool.
 * Kept separate from React so it can be unit-tested without a DOM.
 *
 * Why here vs inline in App.tsx: the stream lifecycle (getDisplayMedia,
 * getUserMedia, MediaRecorder, track-ended events, chunk collection,
 * blob assembly) is complex enough that keeping it in a dedicated module
 * makes it individually testable and keeps App.tsx focused on UI state.
 */

/** Preferred MIME types in priority order. */
const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
];

/** Returns the best supported MIME type, or empty string if none detected. */
export function bestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const mime of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

/** Returns true if getDisplayMedia is available in this browser. */
export function isScreenCaptureSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  );
}

export interface RecorderOptions {
  systemAudio: boolean;
  microphone: boolean;
}

export interface RecorderHandlers {
  /** Called each time a chunk arrives. */
  onChunk: (chunk: Blob) => void;
  /** Called when the video track ends (user clicked browser Stop Sharing). */
  onTrackEnded: () => void;
}

export interface ActiveRecording {
  mediaRecorder: MediaRecorder;
  /** Stop the recording and release all tracks. */
  stop: () => void;
}

/**
 * Start a screen recording session.
 *
 * Returns an ActiveRecording or throws if permission is denied / user cancels.
 *
 * Throws with a readable message on:
 *   - NotAllowedError (permission denied)
 *   - AbortError (user dismissed the picker)
 *   - NotSupportedError / NotFoundError (no capture source available)
 *   - anything else (unexpected)
 */
export async function startRecording(
  opts: RecorderOptions,
  handlers: RecorderHandlers
): Promise<ActiveRecording> {
  // 1. Get display stream
  const displayStream = await navigator.mediaDevices
    .getDisplayMedia({
      video: true,
      // Request system audio when the user toggled it on.
      // Some browsers (Firefox, Safari) ignore or block this; they'll just give
      // us a video-only stream, which is fine — we check below.
      audio: opts.systemAudio,
    })
    .catch((err: unknown) => {
      throw translateMediaError(err);
    });

  // 2. Optionally get mic stream and merge tracks
  let micStream: MediaStream | null = null;
  if (opts.microphone) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      // Mic denied: release display stream and re-throw with a clear message.
      for (const t of displayStream.getTracks()) t.stop();
      throw translateMediaError(err, "mic");
    }
  }

  // 3. Build a combined stream: video track from display + all audio tracks
  const tracks: MediaStreamTrack[] = [];
  const videoTracks = displayStream.getVideoTracks();
  if (videoTracks.length > 0) tracks.push(videoTracks[0]);

  // System audio tracks from the display stream (may be absent)
  for (const t of displayStream.getAudioTracks()) tracks.push(t);

  // Mic audio tracks
  if (micStream) {
    for (const t of micStream.getAudioTracks()) tracks.push(t);
  }

  const combinedStream = new MediaStream(tracks);

  // 4. Create MediaRecorder
  const mimeType = bestMimeType();
  const mr = mimeType
    ? new MediaRecorder(combinedStream, { mimeType })
    : new MediaRecorder(combinedStream);

  mr.ondataavailable = (e: BlobEvent) => {
    if (e.data && e.data.size > 0) handlers.onChunk(e.data);
  };

  // 5. Listen for native Stop Sharing (browser chrome button)
  const videoTrack = combinedStream.getVideoTracks()[0];
  if (videoTrack) {
    videoTrack.addEventListener("ended", () => {
      handlers.onTrackEnded();
    });
  }

  // 6. Start recording — collect a chunk every 250 ms so we get data promptly
  mr.start(250);

  function stop() {
    if (mr.state !== "inactive") mr.stop();
    for (const t of combinedStream.getTracks()) t.stop();
    if (micStream) {
      for (const t of micStream.getTracks()) t.stop();
    }
  }

  return { mediaRecorder: mr, stop };
}

/** Assemble chunks into a downloadable Blob. */
export function assembleBlob(chunks: Blob[], mimeType: string): Blob {
  return new Blob(chunks, { type: mimeType || "video/webm" });
}

/** Translate raw MediaError into a user-readable string. */
function translateMediaError(err: unknown, context?: "mic"): Error {
  if (err instanceof Error) {
    const name = err.name;
    if (name === "NotAllowedError" || name === "PermissionDeniedError") {
      return context === "mic"
        ? new Error(
            "Microphone access denied. Allow microphone access in your browser settings and try again."
          )
        : new Error(
            "Screen capture permission denied. Allow screen recording in your browser settings and try again."
          );
    }
    if (name === "AbortError") {
      return new Error("Screen capture cancelled. Click Start Recording to try again.");
    }
    if (name === "NotSupportedError") {
      return new Error("Screen capture is not supported in this browser. Try Chrome or Edge.");
    }
    if (name === "NotFoundError") {
      return new Error(
        "No screen capture source found. Check that your browser allows screen sharing."
      );
    }
    return new Error(`Recording failed: ${err.message}`);
  }
  return new Error("An unexpected error occurred. Please try again.");
}
