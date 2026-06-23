/**
 * CellControls — the side-panel section shown when a grid cell is selected.
 * Controls: pan XY, zoom, remove photo.
 */
import { Slider } from "@mantine/core";
import { useCollageStore } from "../store/collageStore";

export function CellControls() {
  const { cells, selectedCellId, updateCell, removePhotoFromCell, setSelectedCellId } =
    useCollageStore();

  const cell = cells.find((c) => c.id === selectedCellId);
  if (!cell || !cell.photoUrl) return null;

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.25rem",
        }}
      >
        <span className="mono-label">Selected cell</span>
        <button
          type="button"
          className="btn-secondary"
          style={{ fontSize: "0.72rem", padding: "0.28rem 0.7rem" }}
          onClick={() => setSelectedCellId(null)}
        >
          Deselect
        </button>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="pan-x">
          Pan horizontal
          <span className="control-value">{Math.round(cell.panX * 100)}%</span>
        </label>
        <div className="slider-wrap">
          <Slider
            id="pan-x"
            min={-50}
            max={50}
            step={1}
            value={Math.round(cell.panX * 100)}
            onChange={(v) => updateCell(cell.id, { panX: v / 100 })}
            aria-label="Pan horizontal"
          />
        </div>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="pan-y">
          Pan vertical
          <span className="control-value">{Math.round(cell.panY * 100)}%</span>
        </label>
        <div className="slider-wrap">
          <Slider
            id="pan-y"
            min={-50}
            max={50}
            step={1}
            value={Math.round(cell.panY * 100)}
            onChange={(v) => updateCell(cell.id, { panY: v / 100 })}
            aria-label="Pan vertical"
          />
        </div>
      </div>

      <div className="control-group">
        <label className="control-label" htmlFor="cell-zoom">
          Zoom
          <span className="control-value">{cell.zoom.toFixed(1)}x</span>
        </label>
        <div className="slider-wrap">
          <Slider
            id="cell-zoom"
            min={100}
            max={300}
            step={5}
            value={Math.round(cell.zoom * 100)}
            onChange={(v) => updateCell(cell.id, { zoom: v / 100 })}
            aria-label="Photo zoom"
          />
        </div>
      </div>

      <button
        type="button"
        className="btn-secondary"
        style={{ color: "#d9594c", borderColor: "#d9594c", alignSelf: "flex-start" }}
        onClick={() => {
          removePhotoFromCell(cell.id);
          setSelectedCellId(null);
        }}
      >
        Remove photo
      </button>
    </div>
  );
}
