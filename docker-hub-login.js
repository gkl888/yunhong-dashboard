const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('Opening Docker Hub login page...');
  await page.goto('https://hub.docker.com/login');
  await page.waitForLoadState('networkidle');
  
  console.log('Filling login form...');
  await page.fill('input[name="username"]', 'gkl888');
  await page.fill('input[name="password"]', 'gkl8852546');
  
  console.log('Clicking login button...');
  await page.click('button[type="submit"]');
  
  // Wait for login to complete
  await page.waitForURL('**/dashboard**', { timeout: 30000 }).catch(() => {
    console.log('Waiting for login...');
  });
  
  await page.waitForTimeout(5000);
  console.log('Login completed, current URL:', page.url());
  
  // Take screenshot
  await page.screenshot({ path: 'docker-hub-login.png' });
  console.log('Screenshot saved to docker-hub-login.png');
  
  // Keep browser open for user to see
  console.log('Browser will stay open. Press Ctrl+C to close.');
  
  // Don't close browser - let user see the result
  // await browser.close();
})();
