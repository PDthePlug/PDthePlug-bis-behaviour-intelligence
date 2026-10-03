import { expect, type Page, type TestInfo } from "@playwright/test";

export type Role = "learner" | "admin";

export async function signIn(page: Page, role: Role) {
  const prefix = role === "learner" ? "BIS_STAGING_LEARNER" : "BIS_STAGING_ADMIN";
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(process.env[`${prefix}_EMAIL`]!);
  await page.getByLabel("Password").fill(process.env[`${prefix}_PASSWORD`]!);
  await page.getByRole("button", { name: /Enter BIS/i }).click();
  await expect(page).not.toHaveURL(/\/sign-in(?:\?|$)/);
}

export function observeFailures(page: Page, expectedStatuses: number[] = []) {
  const failures: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") failures.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => failures.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => failures.push(`network: ${request.method()} ${request.url()} (${request.failure()?.errorText})`));
  page.on("response", (response) => {
    if (response.status() >= 400 && !expectedStatuses.includes(response.status())) {
      failures.push(`http ${response.status()}: ${response.request().method()} ${response.url()}`);
    }
  });
  return () => expect(failures, failures.join("\n")).toEqual([]);
}

export async function fetchJson<T>(page: Page, url: string, init?: { method?: string; body?: unknown }) {
  return page.evaluate(async ({ url, init }) => {
    const response = await fetch(url, {
      method: init?.method,
      headers: init?.body === undefined ? undefined : { "content-type": "application/json" },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
    return { status: response.status, body: await response.json() };
  }, { url, init }) as Promise<{ status: number; body: T }>;
}

export async function assertResponsive(page: Page, testInfo: TestInfo, path: string) {
  for (const viewport of [{ width: 360, height: 800 }, { width: 430, height: 932 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      obstructed: [...document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href]')]
        .filter((element) => /save|continue|begin|open|publish|approve|learning/i.test(element.innerText))
        .filter((element) => {
          const box = element.getBoundingClientRect();
          if (!box.width || !box.height) return false;
          const x = Math.max(0, Math.min(innerWidth - 1, box.left + box.width / 2));
          const y = Math.max(0, Math.min(innerHeight - 1, box.top + box.height / 2));
          return box.bottom <= innerHeight && !element.contains(document.elementFromPoint(x, y));
        }).map((element) => element.innerText.trim()),
    }));
    await testInfo.attach(`${viewport.width}px-layout`, { body: JSON.stringify(result, null, 2), contentType: "application/json" });
    expect(result.overflow, `${path} overflows at ${viewport.width}px`).toBeLessThanOrEqual(1);
    expect(result.obstructed, `${path} has obstructed primary actions at ${viewport.width}px`).toEqual([]);
  }
}
