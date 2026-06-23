import { expect, test } from "@playwright/test";

test.describe("OCR tool QoL", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Extract Text button is disabled and shows reason hint before image is added", async ({
    page,
  }) => {
    const btn = page.getByRole("button", { name: "Extract Text" });
    await expect(btn).toBeDisabled();
    await expect(page.locator("#ocr-run-hint")).toBeVisible();
    await expect(page.locator("#ocr-run-hint")).toHaveText("Add an image first");
  });

  test("Try a sample button is visible in empty state", async ({ page }) => {
    // The sample button is inside the dropzone (which itself has role=button),
    // so we locate it by its CSS class to avoid ARIA nesting constraints.
    await expect(page.locator(".ocr-sample-btn")).toBeVisible();
    await expect(page.locator(".ocr-sample-btn")).toHaveText(/try a sample/i);
  });

  test("Try a sample loads an image and enables Extract Text button", async ({ page }) => {
    await page.locator(".ocr-sample-btn").click();
    // After sample loads, Extract Text button should be enabled
    await expect(page.getByRole("button", { name: "Extract Text" })).toBeEnabled();
    // The reason hint should disappear
    await expect(page.locator("#ocr-run-hint")).not.toBeVisible();
  });

  test("language select persists across reload", async ({ page }) => {
    const select = page.locator("#ocr-lang");
    await select.selectOption("fra");
    await page.reload();
    await expect(select).toHaveValue("fra");
  });

  test("no horizontal overflow at 390px (mobile)", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth);
  });
});
