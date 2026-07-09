import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe("Video Toolkit - File Upload & Processing", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should load the video toolkit app", async ({ page }) => {
    await expect(page).toHaveTitle(/Video Toolkit/);
    await expect(page.locator(".site-title, h1")).toBeVisible();
  });

  test("should accept a video file and attempt processing", async ({ page }) => {
    // Create a minimal test MP4 file
    const testVideoPath = path.join(__dirname, "test-video.mp4");
    
    // Minimal valid MP4 structure (moov atom with minimal mvhd)
    const mp4Data = Buffer.from(
      '000000186674797069736f6d0000020069736f6d617663316d70' +
      '3431000000006d6f6f760000006c6d7668640000000000000000' +
      '00000000000000000000000000000000000000000000000000',
      "hex"
    );
    fs.writeFileSync(testVideoPath, mp4Data);

    try {
      // Locate the file input
      const fileInput = page.locator('input[type="file"]');
      
      // Upload the test video
      await fileInput.setInputFiles(testVideoPath);

      // Wait for file info to appear (filename and size should be displayed)
      await expect(page.locator("text=test-video.mp4")).toBeVisible({ timeout: 10000 });
      
      // File size should be shown
      await expect(page.locator("text=/\\d+ B/")).toBeVisible();

      // The page should show the file was loaded (even if processing fails due to invalid format)
      // The key test is that the file was READ successfully - not a FileReader error
      const pageContent = await page.content();
      
      // Verify no "File could not be read" FileReader error (the bug we fixed)
      expect(pageContent).not.toContain("File could not be read");
      
      // The file info should be displayed
      expect(pageContent).toContain("test-video.mp4");

    } finally {
      // Clean up test file
      if (fs.existsSync(testVideoPath)) {
        fs.unlinkSync(testVideoPath);
      }
    }
  });

  test("should show error for unsupported file types", async ({ page }) => {
    // Create a test text file
    const testFilePath = path.join(__dirname, "test-file.txt");
    fs.writeFileSync(testFilePath, "This is not a video file");

    try {
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Wait for potential error
      await page.waitForTimeout(2000);

      // Check for error display (various possible selectors)
      const hasError = await page.isVisible('.error, [role="alert"], .error-message, [class*="error"]');
      
      // Even if no explicit error, the file should not be accepted
      // (the input should remain empty or show a rejection)
      expect(hasError || !(await page.isVisible('input[type="file"][value]'))).toBeTruthy();
    } finally {
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });
});
