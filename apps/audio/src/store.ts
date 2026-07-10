/** Zustand store for audio converter state. */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AudioFormat, ChannelMode, QualityPreset, SampleRate } from "./lib/formats";

export interface AudioFile {
  id: string;
  file: File;
  previewUrl: string | null;
  status: "pending" | "processing" | "done" | "error";
  progressPct: number | null;
  outputUrl: string | null;
  outputName: string | null;
  outputSize: number | null;
  errorMsg: string | null;
}

export interface AudioState {
  files: AudioFile[];
  format: AudioFormat;
  quality: QualityPreset;
  customBitrate: number;
  sampleRate: SampleRate;
  channelMode: ChannelMode;

  // actions
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  updateFile: (id: string, updates: Partial<AudioFile>) => void;
  setFormat: (f: AudioFormat) => void;
  setQuality: (q: QualityPreset) => void;
  setCustomBitrate: (b: number) => void;
  setSampleRate: (sr: SampleRate) => void;
  setChannelMode: (cm: ChannelMode) => void;
}

let idCounter = 0;
function nextId(): string {
  return `audio-${Date.now()}-${++idCounter}`;
}

export const useAudioStore = create<AudioState>()(
  persist(
    (set) => ({
      files: [],
      format: "mp3" as AudioFormat,
      quality: "medium" as QualityPreset,
      customBitrate: 192,
      sampleRate: "original" as SampleRate,
      channelMode: "stereo" as ChannelMode,

      addFiles: (incoming: File[]) => {
        const newFiles: AudioFile[] = incoming.map((f) => ({
          id: nextId(),
          file: f,
          previewUrl: null,
          status: "pending",
          progressPct: null,
          outputUrl: null,
          outputName: null,
          outputSize: null,
          errorMsg: null,
        }));
        set((s: AudioState) => ({ files: [...s.files, ...newFiles] }));
      },

      removeFile: (id: string) => {
        set((s: AudioState) => {
          const file = s.files.find((f: AudioFile) => f.id === id);
          if (file?.outputUrl) URL.revokeObjectURL(file.outputUrl);
          return { files: s.files.filter((f: AudioFile) => f.id !== id) };
        });
      },

      clearAll: () => {
        set((s: AudioState) => {
          for (const f of s.files) {
            if (f.outputUrl) URL.revokeObjectURL(f.outputUrl);
          }
          return { files: [] };
        });
      },

      updateFile: (id: string, updates: Partial<AudioFile>) => {
        set((s: AudioState) => ({
          files: s.files.map((f: AudioFile) => (f.id === id ? { ...f, ...updates } : f)),
        }));
      },

      setFormat: (format: AudioFormat) => set({ format }),
      setQuality: (quality: QualityPreset) => set({ quality }),
      setCustomBitrate: (customBitrate: number) => set({ customBitrate }),
      setSampleRate: (sampleRate: SampleRate) => set({ sampleRate }),
      setChannelMode: (channelMode: ChannelMode) => set({ channelMode }),
    }),
    {
      name: "audio-tool-prefs",
      partialize: (state: AudioState) => ({
        format: state.format,
        quality: state.quality,
        customBitrate: state.customBitrate,
        sampleRate: state.sampleRate,
        channelMode: state.channelMode,
      }),
    }
  )
);