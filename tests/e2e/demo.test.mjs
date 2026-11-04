// End-to-end checks of the real screens in a real browser, running against the in-memory demo
// backend (npm run demo), with the clock frozen at Wednesday 4 November 2026, 10am in Manila.
//   npm run test:e2e
//
// This proves the screens, their flows and their accessibility. It does NOT prove anything
// about a real Supabase project: the demo backend only imitates it (see SCHEDULING_RULES.md).

import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = 5199;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.E2E_SHOTS ?? '';
const CHROME = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && fs.existsSync(p));

let server;
let browser;

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('The demo server did not start.');
}

/** A fresh page with the clock frozen. Each page is a fresh in-memory backend. */
async function openPage(url, { mobile = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(
    mobile
      ? { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }
      : { width: 1280, height: 900 },
  );
  await page.evaluateOnNewDocument(() => {
    const fixed = new Date('2026-11-04T02:00:00Z').getTime();
    const RealDate = Date;
    class FakeDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(fixed);
        else super(...args);
      }
      static now() {
        return fixed;
      }
    }
    globalThis.Date = FakeDate;
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(`${BASE}${url}`, { waitUntil: 'networkidle0' });
  page.errors = errors;
  return page;
}

const text = (page) => page.evaluate(() => document.body.innerText);
const shot = async (page, name) => {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true });
};
/** Click the visible button or link with this accessible name (aria-label, else its text). */
const click = async (page, label) => {
  const handle = await page.evaluateHandle((wanted) => {
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const name = (el) =>
      (el.getAttribute('aria-label') ?? el.innerText).replace(/\s+/g, ' ').trim();
    return (
      [...document.querySelectorAll('button, a, [role=button]')].find(
        (el) => visible(el) && name(el) === wanted,
      ) ?? null
    );
  }, label);
  const el = handle.asElement();
  if (!el) throw new Error(`No visible button or link named "${label}"`);
  await el.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await el.click();
};
/** Click the visible button whose text contains every one of these phrases. */
const clickContaining = async (page, ...needles) => {
  const handle = await page.evaluateHandle((wanted) => {
    const visible = (el) => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
    const norm = (el) => el.innerText.replace(/\s+/g, ' ').trim();
    return (
      [...document.querySelectorAll('button')].find(
        (el) => visible(el) && wanted.every((w) => norm(el).includes(w)),
      ) ?? null
    );
  }, needles);
  const el = handle.asElement();
  if (!el) throw new Error(`No visible button containing ${needles.join(' + ')}`);
  await el.evaluate((b) => b.scrollIntoView({ block: 'center' }));
  await el.click();
};
async function waitForText(page, needle, timeout = 8000) {
  await page.waitForFunction((n) => document.body.innerText.includes(n), { timeout }, needle);
}

async function axeViolations(page) {
  await page.addScriptTag({ path: path.join(root, 'node_modules/axe-core/axe.min.js') });
  const results = await page.evaluate(async () => {
    const r = await axe.run(document, {
      runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
    });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.slice(0, 3).map((n) => n.html.slice(0, 140)),
    }));
  });
  return results;
}

before(async () => {
  assert.ok(CHROME, 'Chrome or Edge was not found. Set CHROME_PATH.');
  server = spawn(
    process.execPath,
    [
      path.join(root, 'node_modules/vite/bin/vite.js'),
      '--mode',
      'demo',
      '--port',
      String(PORT),
      '--strictPort',
    ],
    {
      cwd: root,
      stdio: 'ignore',
    },
  );
  await waitForServer();
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox'],
  });
});

after(async () => {
  await browser?.close();
  server?.kill();
});

describe('signing in', () => {
  test('a wrong email is told how to fix it, and a right one signs in and lands on the right home', async () => {
    const page = await openPage('/login');
    await page.type('input[type=email]', 'rden@');
    await page.type('input[type=password]', 'x');
    await click(page, 'Sign in');
    await waitForText(page, 'missing something');
    await page.$eval('input[type=email]', (el) => (el.value = ''));
    await page.type('input[type=email]', 'nobody@lnhc.example');
    await click(page, 'Sign in');
    await waitForText(page, 'don’t match');
    await page.$eval('input[type=email]', (el) => (el.value = ''));
    await page.focus('input[type=email]');
    await page.type('input[type=email]', 'rden@lnhc.example');
    await click(page, 'Sign in');
    await waitForText(page, 'Sunday, November 15');
    await shot(page, 'login-then-home');
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  test('visiting a private page signed out sends you to sign in', async () => {
    const page = await openPage('/schedules');
    assert.match(page.url(), /\/login$/);
    await page.close();
  });

  test('a volunteer who opens an administrator page is sent home', async () => {
    const page = await openPage('/admin?as=rden');
    await waitForText(page, 'Sunday, November 15');
    assert.doesNotMatch(page.url(), /\/admin/);
    await page.close();
  });
});

describe('a volunteer (Rden)', () => {
  test('home answers: when, what position, who else, and how to download', async () => {
    const page = await openPage('/?as=rden');
    await waitForText(page, 'Sunday, November 15');
    const t = await text(page);
    assert.match(t, /Hi Rden, you’re serving in 11 days\./);
    assert.match(t, /Lead Guitarist/);
    for (const name of [
      'Cyril',
      'Mara, Moises',
      'Denver',
      'Ferl',
      'David',
      'Jireh, Miggy',
      'Kris',
      'Oba',
    ]) {
      assert.ok(t.includes(name), `teammate ${name} should be listed`);
    }
    assert.ok(t.includes('Download PDF') && t.includes('See the full schedule'));
    assert.match(t, /Nov 8[\s\S]*Not scheduled this Sunday/);
    assert.match(t, /November theme: More Precious Than Gold/);
    assert.doesNotMatch(t, /Needs your attention/, 'no administrator content for a volunteer');
    await shot(page, 'volunteer-home');
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  test('the schedule shows the real LNHC November roster with Rden’s Sundays marked', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    const rows = await page.$$eval('table tbody tr', (trs) =>
      trs.map((tr) =>
        [...tr.querySelectorAll('th,td')].map((c) => c.innerText.replace(/\s+/g, ' ').trim()),
      ),
    );
    assert.equal(rows.length, 5);
    assert.match(rows[0][0], /Nov 1/);
    assert.ok(
      rows[0].some((c) => c.includes('Ves') && c.includes('Miggy')),
      'two drummers in one position',
    );
    const nov8 = rows[1];
    assert.ok(nov8.includes('—'), 'an optional position can be empty (Acoustic on Nov 8)');
    assert.match(rows.filter((r) => r[0].includes('Nov 8'))[0][0], /Sunday/);
    assert.match(rows.filter((r) => r[0].includes('Nov 15'))[0][0], /You’re serving/);
    const t = await text(page);
    assert.match(t, /General cleaning will be conducted after the rehearsal/);
    await shot(page, 'volunteer-schedule');
    await page.close();
  });

  test('another venue with nothing published shows a helpful empty state', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    await click(page, 'Tangway');
    await waitForText(page, 'No Tangway schedule for November 2026 yet');
    await page.close();
  });

  test('can step between months and the address keeps the place', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    await click(page, 'Next month');
    await waitForText(page, 'December 2026');
    assert.match(page.url(), /month=2026-12/);
    await waitForText(page, 'Dec 27');
    await page.close();
  });

  test('downloads a PDF', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    const dir = fs.mkdtempSync(path.join(root, 'node_modules', '.e2e-dl-'));
    const cdp = await page.createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: dir,
      eventsEnabled: true,
    });
    await click(page, 'Download PDF');
    let file;
    for (let i = 0; i < 50 && !file; i++) {
      await new Promise((r) => setTimeout(r, 200));
      file = fs.readdirSync(dir).find((f) => f.endsWith('.pdf'));
    }
    assert.ok(file, 'a PDF should have been downloaded');
    assert.match(file, /^LNHC-LNHC-2026-11\.pdf$/);
    const bytes = fs.readFileSync(path.join(dir, file));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    assert.ok(bytes.length > 5000, 'the PDF should have content');
    fs.rmSync(dir, { recursive: true, force: true });
    await page.close();
  });

  test('availability: tap to switch, save, and Sundays already served are locked', async () => {
    const page = await openPage('/availability?as=rden&month=2027-01');
    await waitForText(page, 'January 2027');
    await waitForText(page, 'No answer');
    await clickContaining(page, 'January 17', 'No answer');
    await clickContaining(page, 'January 17', 'Can serve');
    await waitForText(page, 'Notes for your administrator');
    await page.type('input[placeholder="For example: back from a trip"]', 'Away that weekend');
    await click(page, 'Save availability');
    await waitForText(page, 'Saved. Your administrator can see this now.');
    await page.reload({ waitUntil: 'networkidle0' });
    // reload resets the in-memory demo backend, so check the locked-day behaviour in November instead
    await page.goto(`${BASE}/availability?month=2026-11`, { waitUntil: 'networkidle0' });
    await waitForText(page, 'November 2026');
    const locked = await page.$$eval('[role=img]', (els) =>
      els.map((e) => e.getAttribute('aria-label')),
    );
    assert.ok(locked.some((l) => l.includes('November 15') && l.includes('you are serving')));
    assert.ok(locked.some((l) => l.includes('November 1:')));
    await shot(page, 'volunteer-availability');
    await page.close();
  });

  test('profile: save a phone number', async () => {
    const page = await openPage('/profile?as=rden');
    await waitForText(page, 'Rden');
    await page.type('input[type=tel]', '0917 000 0000');
    await click(page, 'Save details');
    await waitForText(page, 'Details saved.');
    await page.close();
  });
});

describe('an administrator', () => {
  test('dashboard shows what needs attention this week', async () => {
    const page = await openPage('/admin?as=admin');
    await waitForText(page, 'Needs your attention');
    const t = await text(page);
    assert.match(t, /Tangway · Sunday, November 8[\s\S]*No roster yet\. Service is in 4 days\./);
    assert.match(t, /Garcia\/Rosario · Sunday, November 8/);
    assert.match(
      t,
      /LNHC · January 2027[\s\S]*Draft with 5 Sundays\. Not visible to volunteers yet\./,
    );
    assert.match(t, /1 assignment needs attention[\s\S]*Moises is marked Away on January 17/);
    assert.match(t, /Next three Sundays/);
    await shot(page, 'admin-dashboard');
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  test('publishing is refused while there is a problem, then works after the problem is fixed', async () => {
    const page = await openPage('/admin/schedule?as=admin&month=2027-01');
    await waitForText(page, '1 assignment needs attention before you can publish');
    await click(page, 'Publish January');
    await waitForText(
      page,
      'Fix 1 problem before publishing LNHC for January 17: Moises is marked Away on January 17',
    );
    await shot(page, 'admin-publish-refused');
    // Moises is on two January Sundays; the problem is on the 17th.
    await page.evaluate(() => {
      const row = [...document.querySelectorAll('table tbody tr')].find((tr) =>
        tr.querySelector('th')?.innerText.includes('Jan 17'),
      );
      row.querySelector('button[aria-label="Remove Moises from Back Up"]').click();
    });
    await waitForText(page, 'Moises removed from Back Up.');
    await page.waitForFunction(
      () => !document.body.innerText.includes('needs attention before you can publish'),
    );
    await click(page, 'Publish January');
    await waitForText(page, 'January 2027 published. Volunteers can see it now.');
    await waitForText(page, 'Published');
    await page.close();
  });

  test('the assignment panel offers qualified people, explains who is blocked, and adds someone', async () => {
    const page = await openPage('/admin/schedule?as=admin&month=2026-12');
    await waitForText(page, 'Dec 13');
    await click(page, 'Choose someone for Acoustic on December 13');
    await waitForText(page, 'Already serving as Bass Guitarist at LNHC on December 13');
    const t = await text(page);
    assert.match(
      t,
      /Ferl[\s\S]*Already serving as Bass Guitarist at LNHC on December 13\. Each person has one position per Sunday\./,
    );
    assert.match(t, /Denver/);
    assert.ok(!t.includes('Zed'));
    await shot(page, 'admin-assignment-panel');
    assert.equal(
      await page.$eval('button[aria-label="Ferl can’t be added"]', (b) => b.disabled),
      true,
      'a blocked person cannot be added',
    );
    await click(page, 'Add Denver to Acoustic');
    await waitForText(page, 'Denver added to Acoustic.');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('[aria-labelledby="drawer-title"]'));
    await page.waitForFunction(() => document.querySelector('table')?.innerText.includes('Denver'));
    await page.close();
  });

  test('a person who serves at another venue the same Sunday is blocked with the reason', async () => {
    const page = await openPage('/admin/schedule?as=admin&month=2026-11');
    await waitForText(page, 'Nov 8');
    await click(page, 'Choose someone for Acoustic on November 8');
    await waitForText(page, 'Already serving as Lead Guitarist at LNHC on November 8');
    const t = await text(page);
    assert.match(t, /Already serving as Lead Guitarist at LNHC on November 8/);
    await page.close();
  });

  test('copy from the previous month creates drafts from the earlier month', async () => {
    const page = await openPage('/admin/schedule?as=admin&month=2027-02');
    await waitForText(page, 'Copy from January');
    await click(page, 'Copy from January');
    await waitForText(page, 'assignments from January 2027 as drafts.');
    const t = await text(page);
    assert.doesNotMatch(t, /These weren’t copied/, 'nothing in this copy needed to be skipped');
    await waitForText(page, 'Feb 21');
    await page.close();
  });

  test('copying onto Sundays that already have assignments changes nothing and says why', async () => {
    const page = await openPage('/admin/schedule?as=admin&month=2027-01');
    await waitForText(page, 'Copy from December');
    await click(page, 'Copy from December');
    await waitForText(page, 'These weren’t copied, and why:');
    const t = await text(page);
    assert.match(t, /January 3: It already has assignments, so nothing was copied onto it./);
    await shot(page, 'admin-copy-skipped');
    await page.close();
  });

  test('volunteers: add a person, set what they can do, invite them', async () => {
    const page = await openPage('/admin/volunteers?as=admin');
    await waitForText(page, 'What');
    await click(page, 'Add volunteer');
    await waitForText(page, 'Add a volunteer');
    await page.type('input[maxlength="40"]', 'Dan');
    await page.type('input[type=email]', 'dan@lnhc.example');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Add volunteer')
        ?.click(),
    );
    await waitForText(page, 'Dan added. Now choose what they can do.');
    await waitForText(page, 'What Dan can do'); // the panel switches to Dan once the list reloads
    await click(page, 'Keyboard');
    await click(page, 'Save');
    await waitForText(page, 'Saved what Dan can do.');
    await click(page, 'Send invitation');
    await waitForText(page, 'Invitation sent to dan@lnhc.example.');
    await shot(page, 'admin-volunteers');
    await page.close();
  });

  test('a duplicate volunteer name is refused with a way forward', async () => {
    const page = await openPage('/admin/volunteers?as=admin');
    await waitForText(page, 'Add volunteer');
    await click(page, 'Add volunteer');
    await page.type('input[maxlength="40"]', 'Sica');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Add volunteer')
        ?.click(),
    );
    await waitForText(page, 'Add a last initial to tell them apart');
    await page.close();
  });

  test('announcements: write one, publish it, and the activity log records it', async () => {
    const page = await openPage('/admin/announcements?as=admin');
    await waitForText(page, 'New announcement');
    await click(page, 'New announcement');
    await page.type('input[maxlength="120"]', 'Rehearsal moved');
    await page.type('textarea', 'Rehearsal starts at 8am on Saturday.');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Publish')
        ?.click(),
    );
    await waitForText(page, 'Announcement published.');
    await waitForText(page, 'Rehearsal moved');
    await page.goto(`${BASE}/admin/activity`, { waitUntil: 'networkidle0' });
    await waitForText(page, 'Activity log');
    await page.close();
  });
});

describe('on a phone', () => {
  test('a volunteer gets the tab bar and a card per Sunday', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11', { mobile: true });
    await waitForText(page, 'Sunday, November 15');
    const tabs = await page.$$eval('nav[aria-label=Main] a', (as) =>
      as.map((a) => a.innerText.trim()).filter(Boolean),
    );
    assert.deepEqual(tabs.slice(-4), ['Home', 'Schedules', 'Availability', 'Profile']);
    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert.equal(horizontalScroll, false, 'no sideways scrolling');
    await shot(page, 'mobile-volunteer-schedule');
    await page.close();
  });

  test('home fits the screen', async () => {
    const page = await openPage('/?as=rden', { mobile: true });
    await waitForText(page, 'Sunday, November 15');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      false,
    );
    await shot(page, 'mobile-volunteer-home');
    await page.close();
  });

  test('an administrator edits from a bottom sheet', async () => {
    const page = await openPage('/admin/schedule?as=admin&month=2026-12', { mobile: true });
    await waitForText(page, 'Sunday, December 13');
    await click(page, 'Choose someone for Acoustic on December 13');
    await waitForText(page, 'Only people qualified for Acoustic are listed');
    const box = await page.$eval('[aria-labelledby="drawer-title"]', (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height, vh: window.innerHeight };
    });
    assert.ok(box.bottom <= box.vh, 'the sheet sits inside the screen');
    assert.ok(box.height <= box.vh * 0.65, 'the sheet leaves the roster visible above it');
    await shot(page, 'mobile-admin-sheet');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      false,
    );
    await page.close();
  });

  test('admin dashboard fits the screen', async () => {
    const page = await openPage('/admin?as=admin', { mobile: true });
    await waitForText(page, 'Needs your attention');
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      false,
    );
    await shot(page, 'mobile-admin-dashboard');
    await page.close();
  });
});

describe('accessibility (axe, WCAG 2.2 A and AA)', () => {
  const pages = [
    ['sign in', '/login', false],
    ['volunteer home', '/?as=rden', false],
    ['schedules', '/schedules?as=rden&month=2026-11', false],
    ['availability', '/availability?as=rden&month=2027-01', false],
    ['profile', '/profile?as=rden', false],
    ['admin dashboard', '/admin?as=admin', false],
    ['admin schedule', '/admin/schedule?as=admin&month=2026-12', false],
    ['admin volunteers', '/admin/volunteers?as=admin', false],
    ['admin announcements', '/admin/announcements?as=admin', false],
    ['volunteer home on a phone', '/?as=rden', true],
    ['admin schedule on a phone', '/admin/schedule?as=admin&month=2026-12', true],
  ];
  for (const [name, url, mobile] of pages) {
    test(`${name} has no violations`, async () => {
      const page = await openPage(url, { mobile });
      await new Promise((r) => setTimeout(r, 600));
      const violations = await axeViolations(page);
      assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
      await page.close();
    });
  }
});
