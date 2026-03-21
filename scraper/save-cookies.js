/**
 * Run this ONCE locally to save your LinkedIn session cookies.
 * A browser window opens — log in if needed, then press Enter in the terminal.
 */
const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.linkedin.com/feed');
  await page.waitForTimeout(3000);

  const url = page.url();
  if (url.includes('/login') || url.includes('/authwall')) {
    console.log('\nNot logged in — please log in manually in the browser window.');
    console.log('Complete any verification if asked.');
  } else {
    console.log('\nAlready logged in!');
  }

  console.log('\nPress Enter when you are logged in and on the LinkedIn feed...');
  await new Promise(resolve => process.stdin.once('data', resolve));

  const cookies = await context.cookies();
  const liCookies = cookies.filter(c => c.domain.includes('linkedin.com'));
  console.log(`Saving ${liCookies.length} LinkedIn cookies...`);

  fs.writeFileSync('linkedin-cookies.json', JSON.stringify(liCookies, null, 2));
  console.log('Saved to linkedin-cookies.json');

  await browser.close();
  process.exit(0);
})();
