/**
 * ShapeClipWrapper — applies a shape mask to its children for the live canvas preview.
 *
 * Rectangle: no clipping (pass-through)
 * Rounded: CSS border-radius via clip-path inset
 * Circle: CSS clip-path ellipse
 * Heart: SVG <clipPath> element with the parametric heart path
 *
 * The export pipeline uses canvas clip instead (see canvasExport.ts).
 */
import type { ReactNode } from "react";
import { getShape } from "../lib/collageShapes";
import type { CollageShapeId } from "../lib/collageShapes";

interface Props {
  shapeId: CollageShapeId;
  width: number;
  height: number;
  cssClipPath: string;
  children: ReactNode;
}

const HEART_CLIP_ID = "collage-heart-clip";

export function ShapeClipWrapper({ shapeId, width, height, cssClipPath, children }: Props) {
  if (shapeId === "rectangle") {
    return <>{children}</>;
  }

  if (shapeId === "heart") {
    const shape = getShape("heart");
    const d = shape.path(width, height);
    return (
      <div
        style={{ position: "relative", width, height, overflow: "hidden" }}
        data-testid="shape-clip-heart"
      >
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden="true">
          <defs>
            <clipPath id={HEART_CLIP_ID} clipPathUnits="userSpaceOnUse">
              <path d={d} />
            </clipPath>
          </defs>
        </svg>
        <div
          style={{
            width,
            height,
            clipPath: `url(#${HEART_CLIP_ID})`,
            position: "relative",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  // Rounded + Circle: CSS clip-path works cleanly
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        clipPath: cssClipPath,
      }}
      data-testid={`shape-clip-${shapeId}`}
    >
      {children}
    </div>
  );
}
