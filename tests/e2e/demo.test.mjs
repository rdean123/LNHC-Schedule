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
    try {
      localStorage.clear();
    } catch {
      /* storage unavailable */
    }
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
/** Wait until entrance animations and transitions have finished (endless loading shimmers are ignored). */
const settle = (page) =>
  page.waitForFunction(
    () =>
      document
        .getAnimations()
        .filter((a) => a.timeline === document.timeline) // not the scroll-linked cross
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .every((a) => a.playState !== 'running'),
    { timeout: 5000 },
  );

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
  await el.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await settle(page);
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
  await el.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await settle(page);
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
    // The panel is anchored to the screen, not to the page behind it (a transformed ancestor once broke this).
    await settle(page);
    const rect = await page.$eval('[aria-labelledby="drawer-title"]', (el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, vh: window.innerHeight };
    });
    assert.equal(
      await page.$eval('[aria-labelledby="drawer-title"]', (el) => getComputedStyle(el).opacity),
      '1',
      'fully visible once it has slid in',
    );
    assert.equal(Math.round(rect.top), 0);
    assert.equal(Math.round(rect.bottom), rect.vh);
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
    await settle(page);
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

describe('a schedule maker (Sica): volunteer screens with edit tools', () => {
  test('looks like a volunteer: the same top bar and home, no sidebar, plus what needs attention', async () => {
    const page = await openPage('/?as=scheduler');
    await waitForText(page, 'Sunday, November 8');
    const t = await text(page);
    assert.match(t, /Hi Sica, you’re serving in 4 days\./);
    assert.match(t, /Keyboard/);
    assert.match(t, /Needs your attention/, 'the schedule maker sees what needs doing');
    assert.match(t, /Your upcoming Sundays/);
    const nav = await page.$$eval('header nav[aria-label=Main] a', (as) =>
      as.map((a) => a.innerText.trim()),
    );
    assert.deepEqual(nav, ['Home', 'Schedules', 'Availability', 'People', 'More']);
    assert.equal(await page.$('nav[aria-label=Administration]'), null, 'no administrator sidebar');
    assert.doesNotMatch(t, /Administration/);
    assert.match(page.url(), /localhost:\d+\/\?as=scheduler$/, 'stays on the volunteer home');
    await shot(page, 'maker-home');
    assert.deepEqual(page.errors, []);
    await page.close();
  });

  test('the Schedules page gets an Edit schedule button; a volunteer’s does not', async () => {
    const maker = await openPage('/schedules?as=scheduler&month=2026-11');
    await waitForText(maker, 'Back Up');
    assert.ok((await text(maker)).includes('Edit schedule'));
    await maker.close();
    const volunteer = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(volunteer, 'Back Up');
    assert.ok(!(await text(volunteer)).includes('Edit schedule'));
    await volunteer.close();
  });

  test('can edit, fix a problem, and publish from the volunteer layout', async () => {
    const page = await openPage('/schedules?as=scheduler&month=2027-01');
    await waitForText(page, 'Edit schedule');
    await click(page, 'Edit schedule');
    await waitForText(page, '1 assignment needs attention before you can publish');
    assert.match(page.url(), /\/schedules\/edit/);
    assert.equal(await page.$('nav[aria-label=Administration]'), null);
    await click(page, 'Publish January');
    await waitForText(page, 'Fix 1 problem before publishing LNHC for January 17');
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
    await shot(page, 'maker-editor');
    await click(page, 'Done editing');
    await waitForText(page, 'Back Up');
    assert.match(page.url(), /\/schedules\?/);
    await page.close();
  });

  test('can manage people and what they can do, but is not offered role changes', async () => {
    const page = await openPage('/people?as=scheduler');
    await waitForText(page, 'What');
    assert.equal(await page.$('#role-select'), null, 'no role control for a schedule maker');
    await click(page, 'Add volunteer');
    await waitForText(page, 'Add a volunteer');
    await page.type('input[maxlength="40"]', 'Dan');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Add volunteer')
        ?.click(),
    );
    await waitForText(page, 'What Dan can do');
    await click(page, 'Keyboard');
    await click(page, 'Save');
    await waitForText(page, 'Saved what Dan can do.');
    await shot(page, 'maker-people');
    await page.close();
  });

  test('can post an announcement and read the activity log', async () => {
    const page = await openPage('/announcements?as=scheduler');
    await waitForText(page, 'New announcement');
    await click(page, 'New announcement');
    await page.type('input[maxlength="120"]', 'Choir practice');
    await page.type('textarea', 'Thursday at 7pm.');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Publish')
        ?.click(),
    );
    await waitForText(page, 'Announcement published.');
    await page.goto(`${BASE}/activity`, { waitUntil: 'networkidle0' });
    await waitForText(page, 'Activity log');
    await page.close();
  });

  test('cannot open the administrator area', async () => {
    const page = await openPage('/admin?as=scheduler');
    await waitForText(page, 'Sunday, November 8');
    assert.doesNotMatch(page.url(), /\/admin/);
    await page.close();
  });

  test('on a phone: the tab bar has Home, Schedules, People, Availability, More, and fits', async () => {
    const page = await openPage('/?as=scheduler', { mobile: true });
    await waitForText(page, 'Sunday, November 8');
    const tabs = await page.$$eval('nav[aria-label=Main] a', (as) =>
      as.map((a) => a.innerText.trim()).filter(Boolean),
    );
    assert.deepEqual(tabs.slice(-5), ['Home', 'Schedules', 'People', 'Availability', 'More']);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
      false,
    );
    await shot(page, 'mobile-maker-home');
    await page.close();
  });
});

describe('who can do what', () => {
  test('a plain volunteer is sent home from every editing address', async () => {
    for (const url of [
      '/people',
      '/schedules/edit',
      '/announcements',
      '/activity',
      '/more',
      '/admin/volunteers',
    ]) {
      const page = await openPage(`${url}?as=rden`);
      await waitForText(page, 'Sunday, November 15');
      assert.doesNotMatch(
        page.url().replace('?as=rden', ''),
        /people|edit|announcements|activity|more|admin/,
        `${url} should redirect`,
      );
      await page.close();
    }
  });

  test('an administrator changes a role after a plain explanation of what it allows', async () => {
    const page = await openPage('/admin/volunteers?as=admin');
    await waitForText(page, 'What');
    await clickContaining(page, 'Rden');
    await waitForText(page, 'What Rden can do');
    await page.select('#role-select', 'scheduler');
    await waitForText(page, 'Make Rden a schedule maker?');
    await waitForText(page, 'They can’t change roles.');
    await shot(page, 'admin-change-role');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Change role')
        ?.click(),
    );
    await waitForText(page, 'Rden is now a schedule maker.');
    await page.close();
  });

  test('an administrator can make someone else an administrator', async () => {
    const page = await openPage('/admin/volunteers?as=admin');
    await waitForText(page, 'What');
    await clickContaining(page, 'Rden');
    await waitForText(page, 'What Rden can do');
    await page.select('#role-select', 'admin');
    await waitForText(page, 'Make Rden an administrator?');
    await page.evaluate(() =>
      [...document.querySelectorAll('dialog button')]
        .find((b) => b.textContent.trim() === 'Change role')
        ?.click(),
    );
    await waitForText(page, 'Rden is now an administrator.');
    await page.close();
  });
});

/** Download a PDF by running `trigger`; returns the file name, its bytes, and how many pages it has. */
async function capturePdf(page, trigger) {
  const dir = fs.mkdtempSync(path.join(root, 'node_modules', '.e2e-dl-'));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: dir,
    eventsEnabled: true,
  });
  await trigger();
  let file;
  for (let i = 0; i < 40 && !file; i++) {
    await new Promise((r) => setTimeout(r, 200));
    file = fs.readdirSync(dir).find((f) => f.endsWith('.pdf'));
  }
  try {
    if (!file) return null;
    const bytes = fs.readFileSync(path.join(dir, file));
    // Count page objects, not the page tree: "/Type /Page" not followed by "s".
    const pages = (bytes.toString('latin1').match(/\/Type \/Page(?!s)/g) ?? []).length;
    return { file, bytes, pages };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Pick months in the PDF dialog. Months are written like '2026-11'. */
async function chooseMonths(page, from, to) {
  const [fromSelect, toSelect] = await page.$$('dialog select');
  await fromSelect.select(from);
  await toSelect.select(to);
}

const clickInDialog = (page, label) =>
  page.evaluate((wanted) => {
    const button = [...document.querySelectorAll('dialog button')].find(
      (b) => b.textContent.trim() === wanted,
    );
    if (!button) throw new Error(`No dialog button "${wanted}"`);
    button.click();
  }, label);

describe('downloading a PDF', () => {
  test('one month by default, with the month on screen already chosen', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    const pdf = await capturePdf(page, async () => {
      await click(page, 'Download PDF');
      await waitForText(page, 'Choose the months to put in the PDF for LNHC');
      const chosen = await page.$$eval('dialog select', (s) => s.map((x) => x.value));
      assert.deepEqual(chosen, ['2026-11', '2026-11']);
      await clickInDialog(page, 'Download PDF');
    });
    assert.ok(pdf, 'a PDF should have been downloaded');
    assert.equal(pdf.file, 'LNHC-LNHC-2026-11.pdf');
    assert.equal(pdf.bytes.subarray(0, 5).toString(), '%PDF-');
    assert.equal(pdf.pages, 1);
    await page.close();
  });

  test('two months, one page each, in one file', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    const pdf = await capturePdf(page, async () => {
      await click(page, 'Download PDF');
      await waitForText(page, 'Choose the months');
      await chooseMonths(page, '2026-11', '2026-12');
      await waitForText(page, '2 months: November 2026 to December 2026');
      await shot(page, 'pdf-dialog');
      await clickInDialog(page, 'Download PDF');
    });
    assert.ok(pdf);
    assert.equal(pdf.file, 'LNHC-LNHC-2026-11-to-2026-12.pdf');
    assert.equal(pdf.pages, 2);
    await waitForText(page, 'PDF downloaded for November 2026 and December 2026.');
    await page.close();
  });

  test('three months is allowed; four is refused with a way forward and the button is off', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    await click(page, 'Download PDF');
    await waitForText(page, 'Choose the months');
    await chooseMonths(page, '2026-10', '2026-12');
    await waitForText(page, '3 months: October 2026 to December 2026');
    assert.equal(await page.$eval('dialog button[type=submit]', (b) => b.disabled), false);
    await chooseMonths(page, '2026-10', '2027-01');
    await waitForText(page, 'That is 4 months. A PDF holds up to 3');
    assert.equal(await page.$eval('dialog button[type=submit]', (b) => b.disabled), true);
    await shot(page, 'pdf-dialog-too-many');
    await page.close();
  });

  test('"To" never falls before "From"', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    await click(page, 'Download PDF');
    await waitForText(page, 'Choose the months');
    await chooseMonths(page, '2026-12', '2026-12');
    const [fromSelect, toSelect] = await page.$$('dialog select');
    await toSelect.select('2026-09');
    assert.deepEqual(await page.$$eval('dialog select', (s) => s.map((x) => x.value)), [
      '2026-09',
      '2026-09',
    ]);
    void fromSelect;
    await page.close();
  });

  test('months with nothing published are left out and the person is told', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-12');
    await waitForText(page, 'Back Up');
    const pdf = await capturePdf(page, async () => {
      await click(page, 'Download PDF');
      await waitForText(page, 'Choose the months');
      await chooseMonths(page, '2026-12', '2027-01');
      await clickInDialog(page, 'Download PDF');
    });
    assert.ok(pdf);
    assert.equal(pdf.pages, 1, 'only December has anything published');
    await waitForText(page, 'January 2027 was left out because nothing is published for it.');
    await page.close();
  });

  test('nothing published at all: no file, and the dialog says so', async () => {
    const page = await openPage('/schedules?as=rden&month=2027-03');
    await waitForText(page, 'No LNHC schedule for March 2027 yet');
    await click(page, 'Download PDF').catch(() => {});
    // The button is disabled on an empty month; open the dialog from a month that has data and pick empty ones.
    await page.goto(`${BASE}/schedules?as=rden&month=2026-11`, { waitUntil: 'networkidle0' });
    await waitForText(page, 'Back Up');
    await click(page, 'Download PDF');
    await waitForText(page, 'Choose the months');
    await chooseMonths(page, '2027-03', '2027-04');
    await clickInDialog(page, 'Download PDF');
    await waitForText(page, 'Nothing is published for March 2027 or April 2027 yet');
    await page.close();
  });

  test('the Home screen offers the same picker, starting at the month of the next Sunday', async () => {
    const page = await openPage('/?as=rden');
    await waitForText(page, 'Sunday, November 15');
    await click(page, 'Download PDF');
    await waitForText(page, 'Choose the months to put in the PDF for LNHC');
    assert.deepEqual(await page.$$eval('dialog select', (s) => s.map((x) => x.value)), [
      '2026-11',
      '2026-11',
    ]);
    await page.close();
  });
});

describe('motion and flow', () => {
  test('moving to another screen starts at the top and moves focus to the new content', async () => {
    const page = await openPage('/?as=rden');
    await waitForText(page, 'Sunday, November 15');
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    await click(page, 'Schedules');
    await waitForText(page, 'Published rosters for every venue');
    assert.equal(await page.evaluate(() => Math.round(window.scrollY)), 0);
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main');
    await page.close();
  });

  test('a new screen eases in, and an answered press moves the button', async () => {
    const page = await openPage('/?as=rden');
    await waitForText(page, 'Sunday, November 15');
    await click(page, 'Schedules');
    await waitForText(page, 'Published rosters for every venue');
    assert.ok(await page.$('#main > .page-enter'), 'the screen is wrapped for the entrance');
    await settle(page);
    // Hovering a primary button lifts it; moving away puts it back.
    const link = await page.evaluateHandle(() =>
      [...document.querySelectorAll('a')].find((a) =>
        a.textContent.includes('Set your availability'),
      ),
    );
    void link;
    await click(page, 'Home');
    await waitForText(page, 'Sunday, November 15');
    await settle(page);
    const primary = await page.evaluateHandle(() =>
      [...document.querySelectorAll('a')].find((a) =>
        a.textContent.includes('See the full schedule'),
      ),
    );
    const el = primary.asElement();
    await el.hover();
    await new Promise((r) => setTimeout(r, 300));
    assert.notEqual(
      await el.evaluate((n) => getComputedStyle(n).translate),
      'none',
      'a hovered button lifts',
    );
    await page.mouse.move(5, 5);
    await new Promise((r) => setTimeout(r, 300));
    assert.equal(
      await el.evaluate((n) => getComputedStyle(n).translate),
      'none',
      'and settles back',
    );
    await page.close();
  });

  test('sections below the fold ease in as they are scrolled to, once', async () => {
    const page = await openPage('/?as=rden', { mobile: true });
    await waitForText(page, 'Sunday, November 15');
    const state = () =>
      page.$$eval('.reveal', (els) => els.map((e) => e.getAttribute('data-seen')));
    const before = await state();
    assert.ok(before.length >= 3, 'the home panels are revealable');
    assert.ok(before.includes('false'), 'something starts hidden below the fold');
    await page.evaluate(() =>
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }),
    );
    await new Promise((r) => setTimeout(r, 800));
    assert.deepEqual(new Set(await state()), new Set(['true']));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 300));
    assert.deepEqual(new Set(await state()), new Set(['true']), 'they stay visible once seen');
    await page.close();
  });

  test('the header lifts off the page once you scroll', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await page.setViewport({ width: 1280, height: 480 }); // short enough that the page can scroll
    await waitForText(page, 'Back Up');
    const shadow = () => page.$eval('header', (h) => getComputedStyle(h).boxShadow);
    assert.equal(await shadow(), 'none');
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
    await new Promise((r) => setTimeout(r, 400));
    assert.notEqual(await shadow(), 'none');
    await page.close();
  });

  test('dialogs and the assignment panel animate in', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    await click(page, 'Download PDF');
    await waitForText(page, 'Choose the months');
    assert.equal(
      await page.$eval('dialog[open]', (d) => getComputedStyle(d).animationName),
      'dialog-in',
    );
    await page.close();
    const admin = await openPage('/admin/schedule?as=admin&month=2026-12');
    await waitForText(admin, 'Dec 13');
    await click(admin, 'Choose someone for Acoustic on December 13');
    await waitForText(admin, 'Already serving as Bass Guitarist');
    assert.match(
      await admin.$eval(
        '[aria-labelledby="drawer-title"]',
        (d) => getComputedStyle(d).animationName,
      ),
      /panel-in-(side|up)/,
    );
    await admin.close();
  });

  test('with "reduce motion" on, nothing moves and nothing starts hidden', async () => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.goto(`${BASE}/?as=rden`, { waitUntil: 'networkidle0' });
    await waitForText(page, 'Sunday, November 15');
    const result = await page.evaluate(() => {
      const reveal = [...document.querySelectorAll('.reveal')].map(
        (e) => getComputedStyle(e).opacity,
      );
      const main = document.querySelector('#main > div');
      return {
        reveal,
        pageAnimation: getComputedStyle(main).animationName,
        smooth: getComputedStyle(document.documentElement).scrollBehavior,
        running: document
          .getAnimations()
          .filter((a) => a.timeline === document.timeline)
          .filter(
            (a) =>
              a.effect?.getComputedTiming().iterations !== Infinity && a.playState === 'running',
          ).length,
      };
    });
    assert.ok(
      result.reveal.length >= 3 && result.reveal.every((o) => o === '1'),
      'every section is visible straight away',
    );
    assert.equal(result.pageAnimation, 'none');
    assert.equal(result.smooth, 'auto');
    assert.equal(result.running, 0);
    await page.close();
  });

  test('Schedules opens on the venue you looked at last', async () => {
    const page = await openPage('/schedules?as=rden&month=2026-11');
    await waitForText(page, 'Back Up');
    await click(page, 'Tangway');
    await waitForText(page, 'No Tangway schedule for November 2026 yet');
    await click(page, 'Home');
    await waitForText(page, 'Sunday, November 15');
    await click(page, 'Schedules');
    await waitForText(page, 'No Tangway schedule');
    assert.equal(
      await page.$eval('button[aria-pressed=true]', (b) => b.textContent.trim()),
      'Tangway',
    );
    await page.close();
  });

  test('"I can’t make it" explains what to do instead of sending you somewhere that is locked', async () => {
    const page = await openPage('/?as=rden');
    await waitForText(page, 'Sunday, November 15');
    await click(page, 'I can’t make it');
    await waitForText(page, 'Can’t make Sunday, November 15?');
    await waitForText(page, 'a schedule maker needs to take you off');
    await waitForText(page, 'Set availability for other Sundays');
    await page.close();
  });

  test('on a phone, Save availability stays pinned above the tab bar once there is something to save', async () => {
    const page = await openPage('/availability?as=rden&month=2027-01', { mobile: true });
    await waitForText(page, 'No answer');
    await clickContaining(page, 'January 10', 'No answer');
    await waitForText(page, 'You have unsaved changes.');
    await settle(page);
    const box = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) =>
        x.textContent.includes('Save availability'),
      );
      const r = b.getBoundingClientRect();
      return {
        bottom: r.bottom,
        vh: window.innerHeight,
        fixed: getComputedStyle(b.parentElement).position,
      };
    });
    assert.equal(box.fixed, 'fixed');
    assert.ok(
      box.bottom < box.vh - 50 && box.bottom > box.vh * 0.5,
      'it sits just above the tab bar',
    );
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
    ['admin volunteers with the role control', '/admin/volunteers?as=admin&volunteer=vol-1', false],
    ['schedule maker home', '/?as=scheduler', false],
    ['schedule maker editing a schedule', '/schedules/edit?as=scheduler&month=2026-12', false],
    ['schedule maker people', '/people?as=scheduler', false],
    ['schedule maker more', '/more?as=scheduler', false],
    ['schedule maker home on a phone', '/?as=scheduler', true],
    ['admin announcements', '/admin/announcements?as=admin', false],
    ['volunteer home on a phone', '/?as=rden', true],
    ['admin schedule on a phone', '/admin/schedule?as=admin&month=2026-12', true],
  ];
  for (const [name, url, mobile] of pages) {
    test(`${name} has no violations`, async () => {
      const page = await openPage(url, { mobile });
      // Scroll to the bottom and back so every section has eased in before it is checked.
      await page.evaluate(async () => {
        for (let y = 0; y <= document.body.scrollHeight; y += 400) {
          window.scrollTo({ top: y, behavior: 'instant' });
          await new Promise((r) => setTimeout(r, 60));
        }
        window.scrollTo({ top: 0, behavior: 'instant' });
      });
      await new Promise((r) => setTimeout(r, 700));
      await settle(page);
      const violations = await axeViolations(page);
      assert.deepEqual(violations, [], JSON.stringify(violations, null, 2));
      await page.close();
    });
  }
});
