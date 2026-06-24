import { create } from "zustand";
import { persist } from "zustand/middleware";

interface JwtStore {
  rawToken: string;
  setRawToken: (token: string) => void;
  clearToken: () => void;
}

export const useJwtStore = create<JwtStore>()(
  persist(
    (set) => ({
      rawToken: "",
      setRawToken: (token) => set({ rawToken: token }),
      clearToken: () => set({ rawToken: "" }),
    }),
    {
      name: "jwt-tool-state",
      merge: (persisted, current) => {
        const p = persisted as Partial<JwtStore>;
        return {
          ...current,
          rawToken: typeof p.rawToken === "string" ? p.rawToken : "",
        };
      },
    }
  )
);
