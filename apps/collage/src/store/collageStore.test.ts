/**
 * Tests for collageStore undo behaviour and localStorage persistence.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("library: blob URL lifecycle (H2)", () => {
  beforeEach(() => {
    // Reset library between tests
    useCollageStore.setState({ library: [] });
  });

  it("removeFromLibrary revokes the object URL before dropping the entry", () => {
    const revokedUrls: string[] = [];
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
      originalRevoke(url);
    };

    // Stub createObjectURL so we control the returned string
    const originalCreate = URL.createObjectURL.bind(URL);
    let counter = 0;
    URL.createObjectURL = () => `blob:stub-${++counter}`;

    const fakeFile = new File(["x"], "photo.jpg");
    useCollageStore.getState().addPhotos([fakeFile]);
    const { library } = useCollageStore.getState();
    expect(library.length).toBe(1);
    const addedUrl = library[0].url;

    useCollageStore.getState().removeFromLibrary(addedUrl);

    expect(useCollageStore.getState().library.length).toBe(0);
    expect(revokedUrls).toContain(addedUrl);

    // Restore
    URL.revokeObjectURL = originalRevoke;
    URL.createObjectURL = originalCreate;
  });

  it("clearLibrary revokes all library URLs", () => {
    const revokedUrls: string[] = [];
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url: string) => {
      revokedUrls.push(url);
      originalRevoke(url);
    };
    let counter = 0;
    const originalCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = () => `blob:stub-${++counter}`;

    const files = [new File(["a"], "a.jpg"), new File(["b"], "b.jpg")];
    useCollageStore.getState().addPhotos(files);
    const urls = useCollageStore.getState().library.map((e) => e.url);
    expect(urls.length).toBe(2);

    useCollageStore.getState().clearLibrary();
    expect(useCollageStore.getState().library.length).toBe(0);
    for (const url of urls) {
      expect(revokedUrls).toContain(url);
    }

    URL.revokeObjectURL = originalRevoke;
    URL.createObjectURL = originalCreate;
  });
});

describe("cell/freeform: object-URL leak guard (gauntlet w3)", () => {
  beforeEach(() => {
    useCollageStore.setState({
      cells: [
        { id: "cell-0", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-1", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-2", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-3", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
      ],
      freeformCards: [],
      undoStack: [],
      canUndo: false,
    });
  });

  it("assignPhotoToCell revokes the old photoUrl when overwriting a filled cell", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCollageStore.setState({
      cells: [
        { id: "cell-0", photoUrl: "blob:old-photo", photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-1", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-2", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-3", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
      ],
    });

    useCollageStore.getState().assignPhotoToCell("cell-0", "blob:new-photo", new File(["x"], "a.jpg"));

    expect(revoke).toHaveBeenCalledWith("blob:old-photo");
    expect(useCollageStore.getState().cells[0].photoUrl).toBe("blob:new-photo");
    revoke.mockRestore();
  });

  it("assignPhotoToCell does NOT revoke when cell was empty", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCollageStore.getState().assignPhotoToCell("cell-0", "blob:first-photo", new File(["x"], "a.jpg"));

    expect(revoke).not.toHaveBeenCalled();
    revoke.mockRestore();
  });

  it("removePhotoFromCell revokes the cell photoUrl", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCollageStore.setState({
      cells: [
        { id: "cell-0", photoUrl: "blob:to-remove", photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-1", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-2", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
        { id: "cell-3", photoUrl: null, photoFile: null, panX: 0, panY: 0, zoom: 1 },
      ],
    });

    useCollageStore.getState().removePhotoFromCell("cell-0");

    expect(revoke).toHaveBeenCalledWith("blob:to-remove");
    expect(useCollageStore.getState().cells[0].photoUrl).toBeNull();
    revoke.mockRestore();
  });

  it("removeFreeformCard revokes the card photoUrl", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCollageStore.setState({
      freeformCards: [
        { id: "fc-1", photoUrl: "blob:fc-photo", x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0 },
        { id: "fc-2", photoUrl: "blob:fc-other", x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0 },
      ],
    });

    useCollageStore.getState().removeFreeformCard("fc-1");

    expect(revoke).toHaveBeenCalledWith("blob:fc-photo");
    expect(revoke).not.toHaveBeenCalledWith("blob:fc-other");
    expect(useCollageStore.getState().freeformCards).toHaveLength(1);
    revoke.mockRestore();
  });

  it("clearFreeformCards revokes all card photoUrls", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");

    useCollageStore.setState({
      freeformCards: [
        { id: "fc-1", photoUrl: "blob:fc-a", x: 0, y: 0, w: 0.5, h: 0.5, rotation: 0 },
        { id: "fc-2", photoUrl: "blob:fc-b", x: 0.5, y: 0.5, w: 0.5, h: 0.5, rotation: 0 },
      ],
    });

    useCollageStore.getState().clearFreeformCards();

    expect(revoke).toHaveBeenCalledWith("blob:fc-a");
    expect(revoke).toHaveBeenCalledWith("blob:fc-b");
    expect(useCollageStore.getState().freeformCards).toHaveLength(0);
    revoke.mockRestore();
  });
});
