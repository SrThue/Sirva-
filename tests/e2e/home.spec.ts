import { expect, test } from "@playwright/test";

test("página inicial mostra o Sirvaí", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "sirvaí" })).toBeVisible();
});
