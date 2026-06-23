import { create } from "zustand";

export interface ImageEntry {
  id: string;
  file: File;
  objectUrl: string;
  /** Raw exifr EXIF output — undefined while loading, null on read failure */
  exif: Record<string, unknown> | null | undefined;
  /** Raw exifr XMP output */
  xmp: Record<string, unknown> | null | undefined;
  /** Raw exifr IPTC output */
  iptc: Record<string, unknown> | null | undefined;
  /** True while exifr is parsing */
  loading: boolean;
  /** Strip result object URL, set after canvas re-encode */
  cleanUrl: string | null;
  /** Error message if strip failed */
  stripError: string | null;
}

interface ExifStore {
  images: ImageEntry[];
  selectedId: string | null;
  addImages: (files: File[]) => void;
  setExif: (
    id: string,
    exif: Record<string, unknown> | null,
    xmp?: Record<string, unknown> | null,
    iptc?: Record<string, unknown> | null
  ) => void;
  setClean: (id: string, url: string) => void;
  setStripError: (id: string, err: string) => void;
  selectImage: (id: string) => void;
  removeImage: (id: string) => void;
  clearAll: () => void;
}

export const useExifStore = create<ExifStore>((set) => ({
  images: [],
  selectedId: null,

  addImages: (files) => {
    set((state) => {
      const next = files.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        objectUrl: URL.createObjectURL(file),
        exif: undefined,
        xmp: undefined,
        iptc: undefined,
        loading: true,
        cleanUrl: null,
        stripError: null,
      }));
      const newImages = [...state.images, ...next];
      const firstNew = next[0];
      return {
        images: newImages,
        selectedId: state.selectedId ?? firstNew?.id ?? null,
      };
    });
  },

  setExif: (id, exif, xmp = null, iptc = null) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, exif, xmp, iptc, loading: false } : img
      ),
    }));
  },

  setClean: (id, url) => {
    set((state) => ({
      images: state.images.map((img) =>
        img.id === id ? { ...img, cleanUrl: url, stripError: null } : img
      ),
    }));
  },

  setStripError: (id, err) => {
    set((state) => ({
      images: state.images.map((img) => (img.id === id ? { ...img, stripError: err } : img)),
    }));
  },

  selectImage: (id) => set({ selectedId: id }),

  removeImage: (id) => {
    set((state) => {
      const img = state.images.find((i) => i.id === id);
      if (img) {
        URL.revokeObjectURL(img.objectUrl);
        if (img.cleanUrl) URL.revokeObjectURL(img.cleanUrl);
      }
      const remaining = state.images.filter((i) => i.id !== id);
      const newSelected = state.selectedId === id ? (remaining[0]?.id ?? null) : state.selectedId;
      return { images: remaining, selectedId: newSelected };
    });
  },

  clearAll: () => {
    set((state) => {
      for (const img of state.images) {
        URL.revokeObjectURL(img.objectUrl);
        if (img.cleanUrl) URL.revokeObjectURL(img.cleanUrl);
      }
      return { images: [], selectedId: null };
    });
  },
}));
