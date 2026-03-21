const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ftp = require('basic-ftp');
const fs = require('fs');
const path = require('path');

chromium.use(StealthPlugin());

const COMPANIES = [
  { name: 'NRG2fly',           slug: 'nrg2fly' },
  { name: 'Aerovolt',          slug: 'aerovolt' },
  { name: 'Beta Technologies', slug: 'beta-technologies' },
  { name: 'Joby Aviation',     slug: 'joby-aviation' },
  { name: 'Green Aero Hub',    slug: 'green-aero-hub' },
  { name: 'Albatros',          slug: 'albatros-aviation' },
];

const DATA_FILE = path.join(__dirname, 'linkedin-data.json');
const REMOTE_PATH = '/domains/nrg2fly.com/public_html/linkedin-data.json';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function parseFollowers(text) {
  if (!text) return null;
  text = text.toLowerCase().replace(/,/g, '').replace(/\./g, '');
  const match = text.match(/([\d]+)\s*(?:k|thousand)?/);
  if (!match) return null;
  let n = parseInt(match[1]);
  if (text.includes('k') || text.includes('thousand')) n *= 1000;
  return n;
}

async function scrapeCompany(page, slug) {
  try {
    await page.goto(`https://www.linkedin.com/company/${slug}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });
    await sleep(2000 + Math.random() * 2000);

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

    // Fallback: search all text for follower pattern
    if (!followers) {
      const bodyText = await page.evaluate(() => document.body.innerText);
      const match = bodyText.match(/([\d,\.]+)\s*(K\s*)?followers/i);
      if (match) followers = parseFollowers(match[0]);
    }

    console.log(`  ${slug}: ${followers ?? 'not found'} followers`);
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

  // Login
  console.log('Logging in to LinkedIn...');
  await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });
  await sleep(1500);
  await page.fill('#username', process.env.LINKEDIN_EMAIL);
  await sleep(500);
  await page.fill('#password', process.env.LINKEDIN_PASSWORD);
  await sleep(500);
  await page.click('[type="submit"]');
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);

  const url = page.url();
  if (url.includes('checkpoint') || url.includes('challenge')) {
    throw new Error('LinkedIn triggered a security checkpoint — manual login needed');
  }
  console.log('Logged in successfully');

  // Scrape each company
  const snapshot = {
    date: new Date().toISOString().slice(0, 10),
    companies: {}
  };

  for (const company of COMPANIES) {
    console.log(`Scraping ${company.name}...`);
    const followers = await scrapeCompany(page, company.slug);
    snapshot.companies[company.name] = { followers };
    await sleep(3000 + Math.random() * 3000);
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
