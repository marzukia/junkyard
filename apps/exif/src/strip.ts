/**
 * Strip EXIF from an image by re-encoding it through an HTMLCanvasElement.
 * Canvas drawImage discards all metadata; toBlob produces a clean image.
 */
export function stripExif(
  objectUrl: string,
  outputType: "image/jpeg" | "image/png"
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get 2D canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob returned null"));
            return;
          }
          resolve(URL.createObjectURL(blob));
        },
        outputType,
        outputType === "image/jpeg" ? 0.95 : undefined
      );
    };

    img.onerror = () => reject(new Error("Failed to load image for stripping"));
    img.src = objectUrl;
  });
}
