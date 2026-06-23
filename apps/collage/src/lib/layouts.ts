/**
 * Grid layout template definitions.
 *
 * Each template describes N cells as fractional rectangles (0–1) of the canvas.
 * CellRect { x, y, w, h } — all in [0,1] normalised space.
 * These are the source of truth for grid rendering and export.
 */

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutTemplate {
  id: string;
  label: string;
  cells: CellRect[];
  /** Visible description for the picker */
  description: string;
}

const g = (x: number, y: number, w: number, h: number): CellRect => ({ x, y, w, h });

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    id: "single",
    label: "1",
    description: "Single photo",
    cells: [g(0, 0, 1, 1)],
  },
  {
    id: "2-horizontal",
    label: "2H",
    description: "2 side by side",
    cells: [g(0, 0, 0.5, 1), g(0.5, 0, 0.5, 1)],
  },
  {
    id: "2-vertical",
    label: "2V",
    description: "2 stacked",
    cells: [g(0, 0, 1, 0.5), g(0, 0.5, 1, 0.5)],
  },
  {
    id: "3-left-large",
    label: "3L",
    description: "Large left + 2 right",
    cells: [g(0, 0, 0.6, 1), g(0.6, 0, 0.4, 0.5), g(0.6, 0.5, 0.4, 0.5)],
  },
  {
    id: "3-top-large",
    label: "3T",
    description: "Large top + 2 bottom",
    cells: [g(0, 0, 1, 0.6), g(0, 0.6, 0.5, 0.4), g(0.5, 0.6, 0.5, 0.4)],
  },
  {
    id: "3-equal",
    label: "3E",
    description: "3 equal columns",
    cells: [g(0, 0, 1 / 3, 1), g(1 / 3, 0, 1 / 3, 1), g(2 / 3, 0, 1 / 3, 1)],
  },
  {
    id: "4-grid",
    label: "4",
    description: "2x2 grid",
    cells: [g(0, 0, 0.5, 0.5), g(0.5, 0, 0.5, 0.5), g(0, 0.5, 0.5, 0.5), g(0.5, 0.5, 0.5, 0.5)],
  },
  {
    id: "4-banner",
    label: "4B",
    description: "Large top + 3 bottom",
    cells: [
      g(0, 0, 1, 0.55),
      g(0, 0.55, 1 / 3, 0.45),
      g(1 / 3, 0.55, 1 / 3, 0.45),
      g(2 / 3, 0.55, 1 / 3, 0.45),
    ],
  },
  {
    id: "6-grid",
    label: "6",
    description: "3x2 grid",
    cells: [
      g(0, 0, 1 / 3, 0.5),
      g(1 / 3, 0, 1 / 3, 0.5),
      g(2 / 3, 0, 1 / 3, 0.5),
      g(0, 0.5, 1 / 3, 0.5),
      g(1 / 3, 0.5, 1 / 3, 0.5),
      g(2 / 3, 0.5, 1 / 3, 0.5),
    ],
  },
  {
    id: "9-grid",
    label: "9",
    description: "3x3 grid",
    cells: [
      g(0, 0, 1 / 3, 1 / 3),
      g(1 / 3, 0, 1 / 3, 1 / 3),
      g(2 / 3, 0, 1 / 3, 1 / 3),
      g(0, 1 / 3, 1 / 3, 1 / 3),
      g(1 / 3, 1 / 3, 1 / 3, 1 / 3),
      g(2 / 3, 1 / 3, 1 / 3, 1 / 3),
      g(0, 2 / 3, 1 / 3, 1 / 3),
      g(1 / 3, 2 / 3, 1 / 3, 1 / 3),
      g(2 / 3, 2 / 3, 1 / 3, 1 / 3),
    ],
  },
];

export function getTemplate(id: string): LayoutTemplate | undefined {
  return LAYOUT_TEMPLATES.find((t) => t.id === id);
}
