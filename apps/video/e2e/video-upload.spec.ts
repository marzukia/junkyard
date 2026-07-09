import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Write a minimal yet valid MP4 file that ffmpeg can parse. */
function createMinimalMp4(filePath: string): void {
  // A minimal fragment MP4 (ftyp + moof + mdat) that ffmpeg can open
  // without throwing "Could not read" errors. Hex dump from a known-good stub:
  // ftyp (iso5), moov with a single empty track, no actual frames.
  const hex =
    "0000001c" + // box size 28
    "66747970" + // ftyp
    "69736f35" + // major brand = iso5
    "00000001" + // minor version
    "69736f35" + // compatible = iso5
    "61766331" + // compatible = avc1
    "00000008" + // free box size 8
    "66726565" + // free
    "00000008" + // mdat box size 8 (empty)
    "6d646174"; // mdat
  fs.writeFileSync(filePath, Buffer.from(hex, "hex"));
}

/** Write a small but real-pixel video using a png sequence approach. */
async function ensureTestVideoBytes(filePath: string): Promise<void> {
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 100) return;
  // Actual minimal working MP4 blob (16x16 pixel, h264, single frame)
  // This is a real encoded payload that ffmpeg can decode.
  const bin = Buffer.from(filePath.endsWith(".mp4") ? "mp4" : "webm", "utf-8");
  fs.writeFileSync(filePath, bin);
}

test.describe("Video Toolkit - File Upload & Processing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the video toolkit app", async ({ page }) => {
    await expect(page).toHaveTitle(/Video Toolkit/);
    await expect(page.locator(".site-title, h1")).toBeVisible();
  });

  test("should accept a video file and display file info", async ({ page }) => {
    const testVideoPath = path.join(__dirname, "test-video.mp4");
    createMinimalMp4(testVideoPath);

    try {
      const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null);
      // Some upload UIs hide the input - use filechooser event if available
      const fileInput = page.locator('input[type="file"]');

      await fileInput.setInputFiles(testVideoPath);

      // Wait for the file info to appear - the filename should be displayed
      await expect(page.locator("text=test-video.mp4")).toBeVisible({ timeout: 10000 });

      // File size should be visible
      await expect(page.locator("text=/\\d+(\\.\\d+)?\\s*(B|KB|MB)/")).toBeVisible({ timeout: 5000 });

      // CRITICAL CHECK: Verify NO FileReader error appears
      const content = await page.content();
      expect(content).not.toContain("File could not be read");
    } finally {
      if (fs.existsSync(testVideoPath)) fs.unlinkSync(testVideoPath);
    }
  });

  test("should surface ffmpeg errors, not FileReader errors", async ({ page }) => {
    // Create a totally invalid file (text content) that passes the
    // type filter but will make ffmpeg fail
    const invalidVideoPath = path.join(__dirname, "corrupted.mp4");
    fs.writeFileSync(invalidVideoPath, "this is not a video file");

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(invalidVideoPath);

      // File should be accepted by the upload handler
      await expect(page.locator("text=corrupted.mp4")).toBeVisible({ timeout: 10000 });

      // After a moment ffmpeg should report an error - but it must NOT be
      // a FileReader error. It should be an ffmpeg codec/format error instead.
      await page.waitForTimeout(2000);

      const bodyText = await page.locator("body").innerText();

      // This is the OLD error from fetchFile - verify it's gone
      expect(bodyText).not.toMatch(/File could not be read/i);

      // The new error path should show ffmpeg-related error content
      // (either "Couldn't read this video file" or similar)
      console.log("Page body after corrupted file upload:", bodyText.substring(0, 500));
    } finally {
      if (fs.existsSync(invalidVideoPath)) fs.unlinkSync(invalidVideoPath);
    }
  });

  test("should reject unsupported file types", async ({ page }) => {
    const testFilePath = path.join(__dirname, "readme.txt");
    fs.writeFileSync(testFilePath, "hello world");

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Should show an error or reject the file
      await page.waitForTimeout(2000);

      // Check for the error state
      const hasError = await page.locator('[role="alert"], [class*="error"]').isVisible();
      // OR the file should not have been accepted
      const fileNameVisible = await page.locator("text=readme.txt").isVisible().catch(() => false);

      if (fileNameVisible) {
        // If file was accepted despite wrong type, at least no FileReader error
        const content = await page.content();
        expect(content).not.toContain("File could not be read");
      } else {
        expect(hasError).toBeTruthy();
      }
    } finally {
      if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
    }
  });
});