
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const PORT = process.env.PORT || '4173';
const BASE = `http://127.0.0.1:${PORT}`;
const shotDir = new URL('../screenshots/', import.meta.url);
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--ignore-gpu-blocklist', '--disable-http-cache']
});

async function waitReady(page) {
  await page.waitForFunction(() => window.__dustline && window.__dustline.ready, null, { timeout: 60000 });
}

const fails = [];
function ok(cond, msg) {
  if (!cond) { fails.push(msg); console.error('FAIL', msg); }
  else console.log('OK  ', msg);
}

{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await waitReady(page);
  const title = await page.locator('h1').first().textContent();
  ok(title.includes('尘线突击'), 'title visible: ' + title);
  await page.click('#btnStart');
  await page.waitForFunction(() => window.__dustline.state().mode === 'play', null, { timeout: 15000 });
  const before = await page.evaluate(() => window.__dustline.state().pos);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const after = await page.evaluate(() => window.__dustline.state().pos);
  const moved = Math.hypot(after.x - before.x, after.z - before.z);
  ok(moved > 0.4, 'moved forward ' + moved.toFixed(2));
  await page.evaluate(() => {
    window.__game.combat.clearAll();
    window.__game.waves.queue.length = 0;
    const s = window.__dustline.state().pos;
    window.__target = window.__dustline.spawnEnemy('rusher', s.x, s.z - 4);
  });
  await page.waitForFunction(() => window.__target && window.__target.hp > 0, null, { timeout: 5000 });
  const hp0 = await page.evaluate(() => window.__target.hp);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.yaw = 0;
    g.player.pitch = -0.02;
    g.player.update(0.016);
  });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__game._tryFire());
    await page.waitForTimeout(90);
  }
  const afterShot = await page.evaluate(() => {
    const st = window.__dustline.state();
    return { hp: window.__target ? window.__target.hp : 0, living: st.living, shots: window.__game.stats.shots };
  });
  ok(afterShot.shots > 0, 'fired shots=' + afterShot.shots);
  ok(afterShot.hp < hp0 || afterShot.living === 0, `enemy damaged ${hp0} -> ${afterShot.hp}`);
  await page.evaluate(() => window.__dustline.forceUpgrade('gun_smg'));
  const owned = await page.evaluate(() => window.__dustline.state().owned);
  ok(owned.includes('smg'), 'unlocked smg: ' + owned.join(','));
  await page.screenshot({ path: new URL('test-play.png', shotDir).pathname });
  await page.close();
}

{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 60000 });
  await waitReady(page);
  await page.click('#btnStart');
  await page.waitForFunction(() => window.__dustline.state().mode === 'play');
  const touch = await page.locator('#touch');
  const hidden = await touch.evaluate((el) => el.classList.contains('hidden'));
  ok(!hidden, 'mobile touch controls visible');
  await page.screenshot({ path: new URL('test-mobile.png', shotDir).pathname });
  await page.close();
}

await browser.close();
if (fails.length) {
  console.error('Smoke failed:', fails);
  process.exit(1);
}
console.log('Smoke passed');
