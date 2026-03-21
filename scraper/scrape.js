const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

chromium.use(StealthPlugin());

const COMPANIES = [
  { name: 'NRG2fly',           slug: 'nrg2fly' },
  { name: 'Aerovolt',          slug: 'aerovolt' },
  { name: 'Beta Technologies', slug: 'beta-air-llc' },
  { name: 'Joby Aviation',     slug: 'jobyaviation' },
  { name: 'Green Aero Hub',    slug: 'greenaviationhub' },
  { name: 'Albatross',          slug: 'albatross-holding' },
];

const DATA_FILE = path.join(__dirname, 'linkedin-data.json');
const REMOTE_PATH = '/domains/nrg2fly.com/public_html/linkedin-data.json';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseFollowers(text) {
  if (!text) return null;
  // Match patterns like: 2,203 / 14K / 14.2K / 125,430 / 1.2M
  const match = text.match(/([\d,]+(?:\.\d+)?)\s*(K|M|thousand)?/i);
  if (!match) return null;
  let n = parseFloat(match[1].replace(/,/g, ''));
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K' || suffix === 'THOUSAND') n = Math.round(n * 1000);
  if (suffix === 'M') n = Math.round(n * 1000000);
  return Math.round(n);
}

async function scrapeCompany(page, slug) {
  try {
    await page.goto(`https://www.linkedin.com/company/${slug}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await sleep(3000 + Math.random() * 2000);

    // If authwall, wait longer and retry once
    if (page.url().includes('authwall') || page.url().includes('login')) {
      console.log(`  ${slug}: hit authwall, retrying after pause...`);
      await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(6000);
      await page.goto(`https://www.linkedin.com/company/${slug}/about/`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      await sleep(3000);
    }

    // Try multiple selectors for follower count
    const selectors = [
      'p.follow-company-module__follower-count',
      '[data-test-id="followers-count"]',
      '.org-top-card-summary-info-list__info-item',
      'p:has-text("followers")',
      'span:has-text("followers")',
    ];

    let followers = null;
    for (const sel of selectors) {
      try {
        const el = await page.locator(sel).first();
        const txt = await el.textContent({ timeout: 3000 });
        if (txt && txt.toLowerCase().includes('follow')) {
          followers = parseFollowers(txt);
          if (followers) break;
        }
      } catch {}
    }

    // Fallback: search all text, pick MOST FREQUENT match (avoids picking noise)
    if (!followers) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const allMatches = [...bodyText.matchAll(/([\d][,\d\.]*\s*(?:K|M)?)\s*followers/gi)];
      if (allMatches.length > 0) {
        // Count frequency of each raw value
        const freq = {};
        for (const m of allMatches) {
          const raw = m[1].trim();
          freq[raw] = (freq[raw] || 0) + 1;
        }
        // Pick most frequent
        const best = Object.entries(freq).sort((a,b) => b[1]-a[1])[0][0];
        followers = parseFollowers(best + ' followers');
      }
    }

    const title = await page.title().catch(() => '');
    const currentUrl = page.url();
    console.log(`  ${slug}: ${followers ?? 'not found'} followers | title="${title.slice(0,60)}" | url=${currentUrl.slice(0,80)}`);
    return followers;
  } catch (err) {
    console.error(`  ${slug}: ERROR - ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('Starting LinkedIn scraper...');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 },
    locale: 'en-US',
  });

  const page = await context.newPage();

  // Load session cookies instead of logging in
  console.log('Loading LinkedIn session cookies...');
  const cookiesJson = process.env.LINKEDIN_COOKIES;
  if (!cookiesJson) throw new Error('LINKEDIN_COOKIES secret not set');
  const cookies = JSON.parse(cookiesJson);
  await context.addCookies(cookies);
  console.log(`Loaded ${cookies.length} cookies`);

  // Verify session is valid
  await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await sleep(3000);

  const url = page.url();
  console.log('After cookie load URL:', url);

  await page.screenshot({ path: 'login-debug.png', fullPage: false });

  if (url.includes('/login') || url.includes('/authwall') || url.includes('checkpoint')) {
    throw new Error('Cookies expired or invalid — re-run save-cookies.js locally to refresh');
  }
  console.log('Session valid — logged in via cookies');

  // Scrape each company
  const snapshot = {
    date: new Date().toISOString().slice(0, 10),
    companies: {}
  };

  for (let i = 0; i < COMPANIES.length; i++) {
    const company = COMPANIES[i];

    // Always return to feed between companies to reset bot detection
    if (i > 0) {
      console.log('Resetting via feed...');
      await page.goto('https://www.linkedin.com/feed', { waitUntil: 'domcontentloaded', timeout: 20000 });
      await sleep(8000 + Math.random() * 5000);
    }

    console.log(`Scraping ${company.name}...`);
    const followers = await scrapeCompany(page, company.slug);
    snapshot.companies[company.name] = { followers };
    await sleep(15000 + Math.random() * 8000);
  }

  await browser.close();

  // Load existing data
  let data = { snapshots: [] };
  if (fs.existsSync(DATA_FILE)) {
    try { data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
  }

  // Remove same-day entry if re-running
  data.snapshots = data.snapshots.filter(s => s.date !== snapshot.date);
  data.snapshots.push(snapshot);

  // Keep last 52 weeks
  data.snapshots = data.snapshots.slice(-52);
  data.lastUpdated = snapshot.date;

  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  console.log('Data saved locally');
  console.log(JSON.stringify(snapshot, null, 2));

  // Upload to FTP
  console.log('Uploading to FTP...');
  const client = new ftp.Client();
  try {
    await client.access({
      host: process.env.FTP_HOST,
      user: process.env.FTP_USER,
      password: process.env.FTP_PASS,
      port: 21,
      secure: false
    });
    await client.uploadFrom(DATA_FILE, REMOTE_PATH);
    console.log('Uploaded linkedin-data.json to server');
  } finally {
    client.close();
  }

  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
