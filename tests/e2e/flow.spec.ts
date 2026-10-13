import { expect, test, type Page } from "@playwright/test";

/**
 * End-to-end journeys against a production build. Place search is mocked at the network
 * layer so tests never call the external geocoder; every calculation is real.
 */

const NEW_DELHI = {
  id: "1261481",
  label: "New Delhi, Delhi, India",
  latitude: 28.6139,
  longitude: 77.209,
  timeZone: "Asia/Kolkata",
  country: "India",
  admin1: "Delhi",
  population: 317797,
};

async function mockGeocoder(page: Page) {
  await page.route("**/api/v1/geocode?**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, data: { results: [NEW_DELHI], attribution: "Location data: Open-Meteo, GeoNames (CC BY 4.0)" } }),
    }),
  );
}

async function continueTo(page: Page) {
  await page.getByRole("button", { name: /^continue/i }).click();
}

async function fillProfile(page: Page, date = "1990-10-15") {
  await page.getByLabel("Date of birth").fill(date);
  await continueTo(page);
}

async function fillBirthKnown(page: Page) {
  await page.getByRole("radio", { name: /^yes/i }).check();
  const time = page.getByRole("textbox", { name: "Birth time", exact: true });
  await time.pressSequentially("230"); // the colon is inserted automatically
  await expect(time).toHaveValue("02:30");
  await page.getByRole("radio", { name: "PM", exact: true }).check();
  await page.getByRole("radio", { name: /search/i }).check();
  await page.getByRole("combobox").fill("New Delhi");
  await page.getByRole("option", { name: /New Delhi/ }).click();
  await continueTo(page);
}

async function acknowledgeAndReview(page: Page) {
  await page.getByRole("checkbox", { name: /experimental/i }).check();
  await continueTo(page);
}

async function calculate(page: Page) {
  await page.getByRole("button", { name: /calculate my reading/i }).click();
}

async function reveal(page: Page) {
  await page.getByTestId("checkpoint-reveal").click();
}

test.beforeEach(async ({ page }) => {
  await mockGeocoder(page);
});

test("landing page explains the symbolic nature and links to the flow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/symbolic/i).first()).toBeVisible();
  await expect(page.getByText(/%/)).toHaveCount(0);
  await page.getByRole("link", { name: /discover my initial/i }).first().click();
  await expect(page).toHaveURL(/\/discover/);
});

test("full journey: reference birth details → stages → checkpoint → reveal", async ({ page }) => {
  await page.goto("/discover");
  await fillProfile(page);
  await fillBirthKnown(page);
  await acknowledgeAndReview(page);
  await expect(page.getByText("1990-10-15").first()).toBeVisible();
  await calculate(page);

  for (const stage of ["validate", "chart", "indicators", "numerology", "reading"]) {
    await expect(page.getByTestId(`stage-${stage}`)).toBeVisible();
  }
  await expect(page.getByTestId("checkpoint-reveal")).toBeVisible();
  await expect(page.getByText(/Purva Phalguni/).first()).toBeVisible();
  await reveal(page);

  const syllable = page.getByTestId("reveal-syllable");
  await expect(syllable).toContainText("टी");
  await expect(page.getByTestId("primary-candidate")).toContainText("Ti");
  await expect(page.getByTestId("primary-candidate")).toContainText(/experimental symbolic interpretation/i);
  await expect(page.getByTestId("native-syllable")).toContainText(/not a partner prediction/i);
  await expect(page.getByText(/not a scientifically validated prediction/i).first()).toBeVisible();
  // Jupiter Darakaraka is boundary-sensitive: both neighbouring syllables are disclosed.
  await expect(page.getByTestId("alternatives")).toContainText("Da");
  await expect(page.getByTestId("alternatives")).toContainText("Di");
  await expect(page.locator("body")).not.toContainText(/\d+(\.\d+)?\s?%/);
});

test("back and continue preserve answers", async ({ page }) => {
  await page.goto("/discover");
  await page.getByLabel("Name").fill("Asha");
  await fillProfile(page);
  await page.getByRole("button", { name: /^back/i }).click();
  await expect(page.getByLabel("Date of birth")).toHaveValue("1990-10-15");
  await expect(page.getByLabel("Name")).toHaveValue("Asha");
});

test("invalid input is reported per field and nothing is calculated", async ({ page }) => {
  await page.goto("/discover");
  await continueTo(page);
  await expect(page.getByText(/enter your date of birth/i)).toBeVisible();
  await page.getByLabel("Date of birth").fill("1990-10-15");
  await continueTo(page);
  await continueTo(page);
  await expect(page.getByText(/whether you know your birth time/i)).toBeVisible();
  await expect(page.getByText(/birthplace/i).first()).toBeVisible();
});

test("unknown birth time: no invented Ascendant, time-dependent possibilities only", async ({ page }) => {
  await page.goto("/discover");
  await fillProfile(page);
  await page.getByRole("radio", { name: /don.t know my birth time/i }).check();
  await page.getByRole("radio", { name: /search/i }).check();
  await page.getByRole("combobox").fill("New Delhi");
  await page.getByRole("option", { name: /New Delhi/ }).click();
  await continueTo(page);
  await acknowledgeAndReview(page);
  await calculate(page);
  await reveal(page);
  await expect(page.getByTestId("primary-candidate")).toHaveCount(0);
  await expect(page.getByText(/depends on|time-dependent|birth time/i).first()).toBeVisible();
  await expect(page.getByText(/ascendant/i).first()).toBeVisible();
});

test("missing location: reading still works with reduced coverage", async ({ page }) => {
  await page.goto("/discover");
  await fillProfile(page);
  await page.getByRole("radio", { name: /^yes/i }).check();
  // A pasted 24-hour time is converted to 02:30 with PM selected.
  await page.getByRole("textbox", { name: "Birth time", exact: true }).fill("14:30");
  await expect(page.getByRole("textbox", { name: "Birth time", exact: true })).toHaveValue("02:30");
  await expect(page.getByRole("radio", { name: "PM", exact: true })).toBeChecked();
  await page.getByRole("radio", { name: /skip/i }).check();
  await continueTo(page);
  await acknowledgeAndReview(page);
  await calculate(page);
  await expect(page.getByText(/time zone/i).first()).toBeVisible();
  await reveal(page);
  await expect(page.getByTestId("native-syllable")).toBeVisible();
});

test("calculation failure shows a typed error with retry, never a fake result", async ({ page }) => {
  await page.route("**/api/v1/readings", (route) =>
    route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "CALCULATION_FAILED", message: "The chart could not be calculated for these details." } }),
    }),
  );
  await page.goto("/discover");
  await fillProfile(page);
  await fillBirthKnown(page);
  await acknowledgeAndReview(page);
  await calculate(page);
  await expect(page.getByText(/could not be calculated/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /retry|try again/i })).toBeVisible();
  await expect(page.getByTestId("reveal-syllable")).toHaveCount(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the reveal renders its final state immediately", async ({ page }) => {
    await page.goto("/discover");
    await fillProfile(page);
    await fillBirthKnown(page);
    await acknowledgeAndReview(page);
    await calculate(page);
    await reveal(page);
    await expect(page.getByTestId("reveal-syllable")).toBeVisible({ timeout: 2000 });
  });
});

test.describe("sharing", () => {
  test("copy, download and a privacy-safe share link", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only here");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/discover");
    await page.getByLabel("Name").fill("Asha Verma");
    await fillProfile(page);
    await fillBirthKnown(page);
    await acknowledgeAndReview(page);
    await calculate(page);
    await reveal(page);

    await page.getByTestId("share-copy").click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain("Ti");
    for (const secret of ["1990", "14:30", "Delhi", "Asha", "Purva Phalguni"]) expect(copied).not.toContain(secret);

    const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("share-download").click()]);
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    await page.getByTestId("share-link-create").click();
    const url = (await page.getByTestId("share-link-url").inputValue().catch(() => page.getByTestId("share-link-url").innerText())).trim();
    expect(url).toMatch(/\/s\/[A-Za-z0-9_-]+$/);
    for (const secret of ["1990", "1430", "Delhi", "Asha", "28.61"]) expect(url).not.toContain(secret);

    await page.goto(url);
    await expect(page.getByText("टी").first()).toBeVisible();
    const body = await page.locator("body").innerText();
    for (const secret of ["1990", "14:30", "Delhi", "Kolkata", "Asha", "Purva Phalguni", "28.61"]) expect(body).not.toContain(secret);
  });

  test("an invalid share token shows a not-found page", async ({ page }) => {
    const res = await page.goto("/s/not-a-real-token");
    expect(res?.status()).toBe(404);
  });
});

test("methodology and privacy pages render the registry and policy", async ({ page }) => {
  await page.goto("/methodology");
  await expect(page.getByText(/experimental symbolic interpretation/i).first()).toBeVisible();
  await expect(page.getByText(/Disabled — insufficient evidence/).first()).toBeVisible();
  await expect(page.getByText("ङ")).toBeVisible();
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("calculation settings show the user's own computed values, live", async ({ page }) => {
  await page.goto("/discover");
  await fillProfile(page);
  await fillBirthKnown(page);
  const panel = page.getByTestId("conventions-panel");
  await expect(panel).toContainText("Simha");
  await expect(panel).toContainText("सिंह");
  await expect(panel).toContainText("Purva Phalguni");
  await expect(panel).toContainText("Makara");
  await expect(panel).toContainText("Karka");
  await expect(panel).toContainText(/Chandra/);
  await expect(panel).toContainText(/23°43′/);
  await expect(page.getByTestId("node-result-mean")).toContainText("Rahu in Makara");
  await expect(page.getByTestId("node-result-true")).toContainText("Rahu in Makara");
  await expect(page.getByTestId("karaka-result-seven_planet")).toContainText("Guru");
  await expect(page.getByText("Fixed conventions")).toHaveCount(0);

  // Changing the birth details changes the values (nothing is hard-coded).
  await page.getByRole("button", { name: /^back/i }).click();
  await page.getByRole("button", { name: /^back/i }).click();
  await page.getByLabel("Date of birth").fill("1990-10-20");
  await continueTo(page);
  await continueTo(page);
  await expect(page.getByTestId("conventions-panel")).not.toContainText("Purva Phalguni", { timeout: 15_000 });
});

test("landing quick look calculates the visitor's Rashi and Nakshatra", async ({ page }) => {
  await page.goto("/");
  const section = page.locator("#quick-look");
  await section.getByLabel("Date of birth").fill("1990-10-15");
  await section.getByRole("textbox", { name: /^Birth time/ }).pressSequentially("0230");
  await section.getByRole("radio", { name: "PM", exact: true }).check();
  await section.getByLabel(/Time zone/).fill("Asia/Kolkata");
  await expect(section).toContainText("Simha", { timeout: 15_000 });
  await expect(section).toContainText("Purva Phalguni");
  await expect(section).toContainText("Kanya");
  await section.getByRole("button", { name: /continue to your full reading/i }).click();
  await expect(page).toHaveURL(/\/discover/);
  await expect(page.getByLabel("Date of birth")).toHaveValue("1990-10-15");
});
