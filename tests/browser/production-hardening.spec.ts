import { expect, test } from "@playwright/test";

test("library honours offline publication and recovers a failed availability check", async ({ page }, info) => {
  let fail = true;
  await page.route("**/api/runtime-catalogue", route => route.fulfill(fail ? {status:503,json:{error:"Unavailable"}} : {json:{items:[
    {code:"HAB",kind:"LEARNING_MODULE",live:true,runtimeMode:"STATIC",routePath:"/habit"},
    {code:"HAB",kind:"LAB",live:false,runtimeMode:null,routePath:"/labs/hab"},
    {code:"DEC",kind:"LEARNING_MODULE",live:false,runtimeMode:null,routePath:"/handbooks/dec"},
  ]}}));
  await page.goto("/library");
  await expect(page.locator('.bis-library-notice[role="alert"]')).toContainText("We couldn’t check which titles are available");
  await expect(page.locator("a.bis-module-card")).toHaveCount(0);
  fail = false;
  await page.getByRole("button",{name:"Try again"}).click();
  const habit = page.locator("a.bis-module-card").filter({has:page.getByRole("heading",{name:"Habit Lab™",exact:true})});
  await expect(habit).toBeVisible();
  await expect(habit).toContainText("Lab access pending");
  await expect(page.locator("a.bis-module-card").filter({hasText:"Decision Lab™"})).toHaveCount(0);
  await expect(page.locator("a.bis-module-card").filter({hasText:"Money Lab™"})).toHaveCount(0);
  await expect(page.locator(".bis-module-card-top")).toHaveCount(0);
  await info.attach("learning-library",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  await page.goto("/library?mode=lab");
  await expect(page.getByRole("heading",{name:"Lab library."})).toBeVisible();
  await expect(page.locator("a.bis-module-card").filter({hasText:"Habit Lab™"})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});
