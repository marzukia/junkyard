/**
 * Tests for collageStore undo behaviour and localStorage persistence.
 */
import { beforeEach, describe, expect, it } from "vitest";

// Mock localStorage before importing the store
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

// Import store after mocking
import { useCollageStore } from "./collageStore";

beforeEach(() => {
  localStorageMock.clear();
  // Reset store to initial state between tests
  useCollageStore.setState({
    cells: [
      { id: "cell-0", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
      { id: "cell-1", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
      { id: "cell-2", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
      { id: "cell-3", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
    ],
    undoStack: [],
    canUndo: false,
    templateId: "4-grid",
    aspectId: "1:1",
    gutter: 8,
    radius: 0,
    background: "#ffffff",
    collageShape: "rectangle",
  });
});

describe("undo: swapCells", () => {
  it("records a snapshot before swapping and restores it on undo", () => {
    const store = useCollageStore.getState();

    // Give cells fake photo URLs
    useCollageStore.setState({
      cells: store.cells.map((c, i) => ({ ...c, photoUrl: `photo-${i}.jpg` })),
    });

    const before0 = useCollageStore.getState().cells[0].photoUrl;
    const before1 = useCollageStore.getState().cells[1].photoUrl;

    useCollageStore.getState().swapCells("cell-0", "cell-1");

    const after = useCollageStore.getState();
    expect(after.cells[0].photoUrl).toBe(before1);
    expect(after.cells[1].photoUrl).toBe(before0);
    expect(after.canUndo).toBe(true);
    expect(after.undoStack.length).toBe(1);

    // Undo should restore original order
    useCollageStore.getState().undo();
    const restored = useCollageStore.getState();
    expect(restored.cells[0].photoUrl).toBe(before0);
    expect(restored.cells[1].photoUrl).toBe(before1);
  });

  it("canUndo is false after undoing the only snapshot", () => {
    const cells = useCollageStore.getState().cells.map((c, i) => ({
      ...c,
      photoUrl: `photo-${i}.jpg`,
    }));
    useCollageStore.setState({ cells });

    useCollageStore.getState().swapCells("cell-0", "cell-1");
    expect(useCollageStore.getState().canUndo).toBe(true);

    useCollageStore.getState().undo();
    expect(useCollageStore.getState().canUndo).toBe(false);
  });
});

describe("undo: removePhotoFromCell", () => {
  it("records a snapshot before removal and restores it on undo", () => {
    useCollageStore.setState({
      cells: useCollageStore.getState().cells.map((c, i) => ({
        ...c,
        photoUrl: `photo-${i}.jpg`,
        photoFile: null,
      })),
    });

    const originalUrl = useCollageStore.getState().cells[2].photoUrl;
    useCollageStore.getState().removePhotoFromCell("cell-2");

    expect(useCollageStore.getState().cells[2].photoUrl).toBeNull();
    expect(useCollageStore.getState().canUndo).toBe(true);

    useCollageStore.getState().undo();
    expect(useCollageStore.getState().cells[2].photoUrl).toBe(originalUrl);
  });
});

describe("localStorage persistence", () => {
  it("saves settings to localStorage when setGutter is called", () => {
    useCollageStore.getState().setGutter(16);
    const raw = localStorageMock.getItem("collage:settings:v2");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string);
    expect(parsed.gutter).toBe(16);
  });

  it("saves background colour when setBackground is called", () => {
    useCollageStore.getState().setBackground("#000000");
    const raw = localStorageMock.getItem("collage:settings:v2");
    const parsed = JSON.parse(raw as string);
    expect(parsed.background).toBe("#000000");
  });

  it("saves aspectId when setAspectId is called", () => {
    useCollageStore.getState().setAspectId("16:9");
    const raw = localStorageMock.getItem("collage:settings:v2");
    const parsed = JSON.parse(raw as string);
    expect(parsed.aspectId).toBe("16:9");
  });

  it("saves borderWidth when setBorderWidth is called", () => {
    useCollageStore.getState().setBorderWidth(3);
    const raw = localStorageMock.getItem("collage:settings:v2");
    const parsed = JSON.parse(raw as string);
    expect(parsed.borderWidth).toBe(3);
  });

  it("saves borderColor when setBorderColor is called", () => {
    useCollageStore.getState().setBorderColor("#ff0000");
    const raw = localStorageMock.getItem("collage:settings:v2");
    const parsed = JSON.parse(raw as string);
    expect(parsed.borderColor).toBe("#ff0000");
  });
});

describe("undo: undo with empty stack is a no-op", () => {
  it("does not throw when undoStack is empty", () => {
    expect(useCollageStore.getState().undoStack.length).toBe(0);
    expect(() => useCollageStore.getState().undo()).not.toThrow();
  });
});
