import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type TextLayer, addLayer, makeDefaultLayers, removeLayer, updateLayer } from "./meme";

interface MemeStore {
  imageDataUrl: string | null;
  layers: TextLayer[];
  setImage: (dataUrl: string) => void;
  clearImage: () => void;
  setLayers: (layers: TextLayer[]) => void;
  updateLayer: (id: string, patch: Partial<TextLayer>) => void;
  addLayer: () => void;
  removeLayer: (id: string) => void;
  reset: () => void;
}

export const useMemeStore = create<MemeStore>()(
  persist(
    (set, get) => ({
      imageDataUrl: null,
      layers: makeDefaultLayers(),

      setImage: (dataUrl) => set({ imageDataUrl: dataUrl }),
      clearImage: () => set({ imageDataUrl: null }),
      setLayers: (layers) => set({ layers }),
      updateLayer: (id, patch) => set({ layers: updateLayer(get().layers, id, patch) }),
      addLayer: () => set({ layers: addLayer(get().layers) }),
      removeLayer: (id) => set({ layers: removeLayer(get().layers, id) }),
      reset: () => set({ imageDataUrl: null, layers: makeDefaultLayers() }),
    }),
    {
      name: "meme-settings-v2",
      // Persist layers and positions but not the image (too large for localStorage)
      partialize: (state) => ({
        layers: state.layers,
      }),
    }
  )
);
