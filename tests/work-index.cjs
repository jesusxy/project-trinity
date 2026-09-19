/* Work's optional object preview: native links, keyboard, touch, and no-JS fallback. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.TRINITY_URL || 'http://127.0.0.1:1415';
const out = process.env.TRINITY_QA || 'tests/results/work-index';

(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {})});
  try {
    const page = await browser.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => requests.push(request.url()));
    const entries = page.locator('.work-entry');
    const panels = page.locator('.work-preview-panel:visible');
    const noOverflow = async width => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);

    for (const width of [1440, 1150, 1024, 901, 768, 600, 390, 320]) {
      await page.setViewportSize({width, height: 1000});
      await page.mouse.move(0, 0);
      assert.equal((await page.goto(base + '/projects/')).status(), 200);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await entries.count(), 2);
      assert.equal(await panels.count(), 0, 'no permanent artifact on arrival');
      await noOverflow(width);
      const peers = await entries.locator('h2').evaluateAll(nodes => nodes.map(node => ({x: node.getBoundingClientRect().x, size: getComputedStyle(node).fontSize})));
      assert.deepEqual(peers[0], peers[1], 'peer titles share alignment and scale');
      await page.screenshot({path: path.join(out, `${width}-rest.png`), fullPage: true});
      // Capture geometry after the full-page screenshot's viewport/layout pass.
      const rowPositions = await entries.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
      const footerTop = (await page.locator('footer').boundingBox()).y;

      for (const [index, id] of ['PRJ-001', 'PRJ-002'].entries()) {
        if (width > 900) await entries.nth(index).hover();
        else await entries.nth(index).getByRole('button').click();
        assert.equal(await panels.count(), 1, 'one shared preview at a time');
        assert.equal(await panels.getAttribute('id'), `preview-${id}`);
        assert.equal(await entries.nth(index).getByRole('button').getAttribute('aria-expanded'), 'true');
        await noOverflow(width);
        if (width > 900) {
          assert.deepEqual(await entries.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top)), rowPositions, `preview must not move the listing at ${width}`);
          assert.equal((await page.locator('footer').boundingBox()).y, footerTop, 'preview swaps must not shift the footer');
          await panels.hover();
          assert.equal(await panels.count(), 1, 'preview stays open when examining it');
        }
        if ([1440, 1024, 390, 320].includes(width)) await page.screenshot({path: path.join(out, `${width}-${id}.png`), fullPage: true, animations: 'disabled'});
      }
      await page.getByRole('button', {name: 'Close preview'}).click();
      assert.equal(await panels.count(), 0);
      assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Preview Nox', 'closing restores focus to a visible control');
    }

    // Keyboard preview, dismissal, and unmodified native project navigation.
    await page.setViewportSize({width: 1440, height: 1000});
    await page.mouse.move(0, 0);
    await page.goto(base + '/projects/');
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
    const loupe = entries.nth(0).getByRole('link');
    await loupe.focus();
    assert.equal(await panels.getAttribute('id'), 'preview-PRJ-001');
    await page.keyboard.press('Escape');
    assert.equal(await panels.count(), 0);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    assert.equal(await panels.getAttribute('id'), 'preview-PRJ-001');
    await entries.nth(1).getByRole('link').focus();
    assert.equal(await panels.getAttribute('id'), 'preview-PRJ-002');
    await panels.locator('.artifact-source').focus();
    await page.keyboard.press('Escape');
    assert.equal(await panels.count(), 0);
    assert.equal(await page.locator(':focus').getAttribute('aria-label'), 'Preview Nox');
    await entries.nth(1).getByRole('link').click();
    assert.ok(page.url().endsWith('/projects/nox/'));
    await page.goto(base + '/projects/');
    await entries.nth(0).getByRole('link').click();
    assert.ok(page.url().endsWith('/projects/loupe/'));

    // Real touch mode: preview is explicit and links navigate on the first tap.
    const touch = await browser.newContext({hasTouch: true, isMobile: true, viewport: {width: 390, height: 844}, reducedMotion: 'reduce'});
    const phone = await touch.newPage();
    await phone.goto(base + '/projects/');
    assert.equal(await phone.locator('.work-preview').isVisible(), false);
    await phone.getByRole('button', {name: 'Preview Loupe', exact: true}).tap();
    assert.equal(await phone.locator('#preview-PRJ-001').isVisible(), true);
    assert.equal(await phone.locator('#preview-PRJ-001').evaluate(node => getComputedStyle(node).animationName), 'none');
    const previewBounds = await phone.locator('.work-preview').boundingBox();
    assert.ok(previewBounds.y >= 0 && previewBounds.y < 844, 'touch selection brings preview into view');
    await phone.getByRole('button', {name: 'Close preview'}).tap();
    assert.equal(await phone.locator('.work-preview').isVisible(), false);
    await phone.locator('.work-entry').nth(1).getByRole('link').tap();
    await phone.waitForURL('**/projects/nox/');
    assert.ok(phone.url().endsWith('/projects/nox/'));
    await touch.close();

    // Disabled or unavailable JavaScript leaves a complete navigable index.
    for (const failure of ['disabled', 'blocked']) {
      const context = await browser.newContext({javaScriptEnabled: failure !== 'disabled'});
      const fallback = await context.newPage();
      if (failure === 'blocked') await fallback.route('**/js/work.*.js', route => route.abort());
      for (const width of [1440, 390]) {
        await fallback.setViewportSize({width, height: 1000});
        await fallback.goto(base + '/projects/');
        assert.equal(await fallback.locator('.work-entry:visible').count(), 2);
        assert.equal(await fallback.locator('.work-preview-button:visible').count(), 0);
        assert.equal(await fallback.locator('.work-preview').isVisible(), false);
        assert.equal(await fallback.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        await fallback.locator('.work-entry').nth(0).getByRole('link').click();
        assert.ok(fallback.url().endsWith('/projects/loupe/'));
      }
      await context.close();
    }
    assert.equal(requests.some(url => url.includes('.wasm')), false);
    assert.deepEqual(errors, []);
    console.log('PASS: 8 widths; peer alignment; hover/focus/touch preview; stationary desktop layout; close/Escape/focus restoration; native links; reduced motion; disabled/blocked JS fallback.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
