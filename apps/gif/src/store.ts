import { create } from "zustand";
import { persist } from "zustand/middleware";
import { extractVideoFrames, makeId } from "./gif";
import type { GifFrame } from "./gif";

export type { GifFrame };

interface GifStore {
  frames: GifFrame[];
  /** Global frame delay in ms (used when per-frame override is null). */
  globalDelayMs: number;
  /** 0 = loop forever, N = loop N times. */
  loops: number;
  /** Max output dimension for longest axis, in pixels. */
  maxDim: number;
  /** Caption text to burn into every frame at encode time. */
  caption: string;
  /** Number of frames to extract when importing a video. */
  videoFrameCount: number;

  addFrames: (files: File[]) => Promise<{ videoCount: number; imageCount: number }>;
  removeFrame: (id: string) => void;
  moveFrame: (fromIdx: number, toIdx: number) => void;
  setFrameDelay: (id: string, ms: number | null) => void;
  setGlobalDelay: (ms: number) => void;
  setLoops: (n: number) => void;
  setMaxDim: (n: number) => void;
  setCaption: (text: string) => void;
  setVideoFrameCount: (n: number) => void;
  clearAll: () => void;
}

async function loadFrame(file: File): Promise<GifFrame> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      resolve({
        id: makeId(),
        file,
        previewUrl: url,
        delayMs: null,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Could not load ${file.name}`));
    };
    img.src = url;
  });
}

async function loadFrameFromBlob(
  blob: Blob,
  sourceName: string,
  width: number,
  height: number
): Promise<GifFrame> {
  const url = URL.createObjectURL(blob);
  const file = new File([blob], sourceName, { type: blob.type });
  return { id: makeId(), file, previewUrl: url, delayMs: null, width, height };
}

export const useGifStore = create<GifStore>()(
  persist(
    (set, get) => ({
      frames: [],
      globalDelayMs: 100,
      loops: 0,
      maxDim: 800,
      caption: "",
      videoFrameCount: 10,

      addFrames: async (files) => {
        const imageFiles = files.filter((f) => f.type.startsWith("image/"));
        const videoFiles = files.filter((f) => f.type.startsWith("video/"));

        // Load image files in parallel
        const imageFrames = await Promise.all(imageFiles.map(loadFrame));

        // Extract video frames sequentially (video seeking is sequential anyway)
        const videoFrames: GifFrame[] = [];
        for (const vf of videoFiles) {
          const { maxDim, videoFrameCount } = get();
          const extracted = await extractVideoFrames(vf, videoFrameCount, maxDim);
          for (let i = 0; i < extracted.length; i++) {
            const { blob, width, height } = extracted[i];
            const frame = await loadFrameFromBlob(
              blob,
              `${vf.name}_frame${String(i + 1).padStart(3, "0")}.png`,
              width,
              height
            );
            videoFrames.push(frame);
          }
        }

        const allNew = [...imageFrames, ...videoFrames];
        set((s) => ({ frames: [...s.frames, ...allNew] }));
        return { videoCount: videoFiles.length, imageCount: imageFiles.length };
      },

      removeFrame: (id) =>
        set((s) => {
          const frame = s.frames.find((f) => f.id === id);
          if (frame) URL.revokeObjectURL(frame.previewUrl);
          return { frames: s.frames.filter((f) => f.id !== id) };
        }),

      moveFrame: (fromIdx, toIdx) =>
        set((s) => {
          const frames = [...s.frames];
          const [moved] = frames.splice(fromIdx, 1);
          frames.splice(toIdx, 0, moved);
          return { frames };
        }),

      setFrameDelay: (id, ms) =>
        set((s) => ({
          frames: s.frames.map((f) => (f.id === id ? { ...f, delayMs: ms } : f)),
        })),

      setGlobalDelay: (ms) => set({ globalDelayMs: ms }),
      setLoops: (n) => set({ loops: n }),
      setMaxDim: (n) => set({ maxDim: n }),
      setCaption: (text) => set({ caption: text }),
      setVideoFrameCount: (n) => set({ videoFrameCount: n }),

      clearAll: () =>
        set((s) => {
          for (const f of s.frames) URL.revokeObjectURL(f.previewUrl);
          return { frames: [] };
        }),
    }),
    {
      name: "gif-tool-settings",
      // Only persist settings, not frames (blob URLs don't survive page reload)
      partialize: (s) => ({
        globalDelayMs: s.globalDelayMs,
        loops: s.loops,
        maxDim: s.maxDim,
        caption: s.caption,
        videoFrameCount: s.videoFrameCount,
      }),
    }
  )
);
