// Browser tests for the page. Needs: npm run install:all && npm install && npx playwright install chromium
// Optional env: OFFLINE_NODE_MODULES=/path/to/node_modules (serves pdf-lib, JSZip and PDF.js locally instead of cdnjs)
//               E2E_API=1 to also run tests that need the Express server and qpdf.
const { test, expect } = require('@playwright/test');
const { PDFDocument } = require('pdf-lib');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const has = (cmd, args = ['--version']) => { try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch { return false; } };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

/** A PDF whose pages have the given widths (so page order can be verified from the output). */
async function makePdf(widths) {
  const d = await PDFDocument.create();
  widths.forEach((w, i) => d.addPage([w, 300]).drawText('Page ' + (i + 1), { x: 20, y: 150, size: 24 }));
  return Buffer.from(await d.save());
}
const pdfFile = (buffer, name = 'a.pdf') => ({ name, mimeType: 'application/pdf', buffer });
const widthsOf = async (buf) => (await PDFDocument.load(buf)).getPages().map((p) => Math.round(p.getWidth()));
const read = async (dl) => fs.readFileSync(await dl.path());

test.beforeEach(async ({ page }) => {
  const nm = process.env.OFFLINE_NODE_MODULES;
  if (!nm) return;
  await page.route('**/__pdfjs/**', (r) => r.fulfill({ path: path.join(nm, 'pdfjs-dist/build', r.request().url().split('/__pdfjs/')[1]), contentType: 'text/javascript' }));
  await page.route('https://cdnjs.cloudflare.com/**', (r) => {
    const u = r.request().url();
    if (u.includes('pdf-lib')) return r.fulfill({ path: path.join(nm, 'pdf-lib/dist/pdf-lib.min.js'), contentType: 'text/javascript' });
    if (u.includes('jszip')) return r.fulfill({ path: process.env.OFFLINE_JSZIP, contentType: 'text/javascript' });
    if (u.includes('pdf.worker')) return r.fulfill({ body: '', contentType: 'text/javascript' });
    if (u.includes('pdf.min.js')) return r.fulfill({ contentType: 'text/javascript', body: "Map.prototype.getOrInsertComputed||(Map.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k)});WeakMap.prototype.getOrInsertComputed||(WeakMap.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k)});import(location.origin+'/__pdfjs/pdf.mjs').then(m=>{m.GlobalWorkerOptions.workerSrc=location.origin+'/__pdfjs/pdf.worker.mjs';window.pdfjsLib=m})" });
    return r.abort();
  });
});
async function openTool(page, id) {
  await page.goto('/#' + id);
  await page.waitForFunction(() => window.PDFLib && window.pdfjsLib && typeof TOOLS !== 'undefined' && TOOLS.some((t) => t.id === 'sign'));
  await page.evaluate(() => route()); // make sure tools registered after first paint are shown
}
async function runAndDownload(page, buttonSelector) {
  await page.locator(buttonSelector).click();
  const link = page.locator('#res a[download]').first();
  await expect(link).toBeVisible();
  const [dl] = await Promise.all([page.waitForEvent('download'), link.click()]);
  return read(dl);
}

test('home page lists tools and search filters them', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Every PDF Tool You Need/ })).toBeVisible();
  await page.getByPlaceholder('Search PDF tools...').fill('merge');
  await expect(page.locator('a.tool', { hasText: 'Merge PDF' })).toBeVisible();
  await expect(page.locator('a.tool', { hasText: 'Rotate PDF' })).toHaveCount(0);
});

test('merge combines two PDFs (2 + 3 pages = 5)', async ({ page }) => {
  await openTool(page, 'merge');
  await page.locator('#fi').setInputFiles([pdfFile(await makePdf([100, 100]), 'a.pdf'), pdfFile(await makePdf([100, 100, 100]), 'b.pdf')]);
  await expect(page.locator('.file')).toHaveCount(2);
  await expect(page.locator('#go')).toBeEnabled();
  const out = await runAndDownload(page, '#go');
  expect((await PDFDocument.load(out)).getPageCount()).toBe(5);
});

test('merge is disabled with a single file', async ({ page }) => {
  await openTool(page, 'merge');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100])));
  await expect(page.locator('#go')).toBeDisabled();
});

test('rejects a text file renamed to .pdf and an empty file', async ({ page }) => {
  await openTool(page, 'merge');
  await page.locator('#fi').setInputFiles({ name: 'fake.pdf', mimeType: 'application/pdf', buffer: Buffer.from('hello') });
  await expect(page.locator('#status')).toContainText('not a valid PDF');
  await page.locator('#fi').setInputFiles({ name: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.locator('#status')).toContainText('empty');
});

test('rejects a password-protected PDF', async ({ page }) => {
  test.skip(!has('qpdf'), 'qpdf not installed');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bp-')), i = path.join(dir, 'i.pdf'), o = path.join(dir, 'o.pdf');
  fs.writeFileSync(i, await makePdf([100]));
  execFileSync('qpdf', ['--encrypt', 'pw', 'pw', '256', '--', i, o]);
  await openTool(page, 'rotate');
  await page.locator('#fi').setInputFiles(o);
  await expect(page.locator('#status')).toContainText('password-protected');
});

test('page-range errors are shown (split / delete)', async ({ page }) => {
  await openTool(page, 'split');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100, 100])));
  await page.locator('#o_r').fill('9');
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('outside 1–2');
  await openTool(page, 'delete');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100, 100])));
  await page.locator('#o_pages').fill('1-2');
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('empty');
});

test('split makes one file per page and offers a ZIP', async ({ page }) => {
  await openTool(page, 'split');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100, 100, 100])));
  await page.locator('#go').click();
  await expect(page.locator('#res .file')).toHaveCount(3);
  await expect(page.locator('#zip')).toBeVisible();
});

test('rotate sets the page rotation', async ({ page }) => {
  await openTool(page, 'rotate');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100])));
  const out = await runAndDownload(page, '#go');
  expect((await PDFDocument.load(out)).getPage(0).getRotation().angle).toBe(90);
});

test('images to PDF makes one page per image', async ({ page }) => {
  await openTool(page, 'img2pdf');
  await page.locator('#fi').setInputFiles([{ name: 'a.png', mimeType: 'image/png', buffer: PNG }, { name: 'b.png', mimeType: 'image/png', buffer: PNG }]);
  const out = await runAndDownload(page, '#go');
  expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
});

test('organize: thumbnails, reorder, rotate, delete, export', async ({ page }) => {
  await openTool(page, 'organize');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100, 200, 300])));
  await expect(page.locator('.pgc')).toHaveCount(3);
  await expect(page.locator('.pgc img')).toHaveCount(3); // thumbnails rendered
  await page.locator('.pgc').nth(0).getByRole('button', { name: /later/ }).click(); // page 1 → position 2
  await page.locator('.pgc').nth(2).getByRole('button', { name: /Remove/ }).click(); // remove last (page 3)
  await page.locator('.pgc').nth(1).getByRole('button', { name: /Rotate page 1 right/ }).click();
  const out = await runAndDownload(page, '#exp');
  const d = await PDFDocument.load(out);
  expect(d.getPages().map((p) => Math.round(p.getWidth()))).toEqual([200, 100]);
  expect(d.getPage(1).getRotation().angle).toBe(90);
});

test('organize: drag and drop reorders pages', async ({ page }) => {
  await openTool(page, 'organize');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100, 200, 300])));
  await expect(page.locator('.pgc img')).toHaveCount(3);
  await page.locator('.pgc').nth(2).dragTo(page.locator('.pgc').nth(0));
  expect(await widthsOf(await runAndDownload(page, '#exp'))).toEqual([300, 100, 200]);
});

test('organize: refuses to export when every page is removed', async ({ page }) => {
  await openTool(page, 'organize');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100])));
  await page.locator('.pgc').first().getByRole('button', { name: /Remove/ }).click();
  await page.locator('#exp').click();
  await expect(page.locator('#status')).toContainText('empty');
});

test('edit: new text and a rectangle are saved into the PDF', async ({ page }) => {
  const src = await makePdf([300]);
  await openTool(page, 'edit');
  await page.locator('#fi').setInputFiles(pdfFile(src));
  await expect(page.locator('.ed .pw').first()).toBeVisible();
  await expect(page.locator('#save')).toBeDisabled(); // nothing changed yet
  const b = await page.locator('.ed .pw').first().boundingBox();
  await page.locator('[data-tool=text]').click();
  await page.mouse.click(b.x + 40, b.y + 60);
  await page.keyboard.type('HelloBadpdf'); await page.keyboard.press('Escape');
  await page.locator('[data-tool=shape]').click();
  await page.mouse.move(b.x + 30, b.y + 150); await page.mouse.down(); await page.mouse.move(b.x + 150, b.y + 230, { steps: 5 }); await page.mouse.up();
  await expect(page.locator('#save')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]);
  const out = await read(dl);
  expect((await PDFDocument.load(out)).getPageCount()).toBe(1);
  expect(out.length).toBeGreaterThan(src.length);
  if (has('pdftotext', ['-v'])) {
    const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bp-')), 'o.pdf'); fs.writeFileSync(f, out);
    expect(execFileSync('pdftotext', [f, '-']).toString()).toContain('HelloBadpdf');
  }
});

test('edit: clicking existing text replaces it; opening it without changes changes nothing', async ({ page }) => {
  await openTool(page, 'edit');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([300])));
  await expect(page.locator('.ed .pw').first()).toBeVisible();
  await page.locator('[data-tool=text]').click();
  const run = page.locator('.ly .run').first();
  await expect(run).toBeAttached();
  await run.click(); await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeDisabled();
  await run.click(); await page.keyboard.press('Control+A'); await page.keyboard.type('Replaced'); await page.keyboard.press('Escape');
  await expect(page.locator('#save')).toBeEnabled();
  await page.keyboard.press('Control+z');
  await expect(page.locator('#save')).toBeDisabled(); // undo restores the original
});

test('edit: zoom controls and page number work on a multi-page PDF', async ({ page }) => {
  await openTool(page, 'edit');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([300, 300, 300])));
  await expect(page.locator('.th')).toHaveCount(3);
  const z0 = await page.inputValue('#zv'); await page.locator('#zin').click();
  expect(await page.inputValue('#zv')).not.toBe(z0);
  await page.fill('#pgn', '3'); await page.keyboard.press('Enter');
  await expect(page.locator('.th[aria-current=true]')).toContainText('3');
});

test('sign: drawn signature is placed on every page', async ({ page }) => {
  await openTool(page, 'sign');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([300, 300])));
  await expect(page.locator('#ov')).toBeVisible();
  await page.locator('#ov').click({ position: { x: 100, y: 100 } });
  await expect(page.locator('#status')).toContainText('signature first'); // no signature yet
  const pad = await page.locator('#pad').boundingBox();
  await page.mouse.move(pad.x + 20, pad.y + 60); await page.mouse.down();
  await page.mouse.move(pad.x + 120, pad.y + 30, { steps: 8 }); await page.mouse.move(pad.x + 220, pad.y + 80, { steps: 8 }); await page.mouse.up();
  await page.locator('#padok').click();
  await expect(page.locator('#sigprev img')).toBeVisible();
  await page.locator('#ap').selectOption('all');
  await page.locator('#ov').click({ position: { x: 150, y: 200 } });
  const out = await runAndDownload(page, '#exp');
  expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  expect(out.toString('latin1')).toMatch(/\/Subtype\s*\/Image/);
});

test('server tools are labelled and unreachable servers give a clear error', async ({ page }) => {
  await openTool(page, 'word-to-pdf');
  await expect(page.getByText('uploaded to the server')).toBeVisible();
  await page.route('**/api/word-to-pdf', (r) => r.abort());
  await page.locator('#fi').setInputFiles({ name: 'a.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Cannot reach the BADPDF server');
});

test('protect then unlock through the real server', async ({ page }) => {
  test.skip(!process.env.E2E_API, 'set E2E_API=1 with the Express server and qpdf running');
  const health = await (await page.request.get('/api/health')).json().catch(() => null);
  test.skip(!health?.tools?.qpdf, 'qpdf is not installed on the server (see /api/health)');
  await openTool(page, 'protect');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([100])));
  await page.locator('#o_password').fill('secret1');
  const enc = await runAndDownload(page, '#go');
  expect(enc.toString('latin1')).toContain('/Encrypt');
  await openTool(page, 'unlock');
  await page.locator('#fi').setInputFiles(pdfFile(enc, 'enc.pdf'));
  await page.locator('#o_password').fill('wrong');
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('incorrect');
  await page.locator('#o_password').fill('secret1');
  const dec = await runAndDownload(page, '#go');
  expect(dec.toString('latin1')).not.toContain('/Encrypt');
});

/* ---------- Compare PDFs and Image Watermark ---------- */
async function textPdf(pages) {
  const d = await PDFDocument.create();
  pages.forEach((t) => { const p = d.addPage([400, 300]); if (t) p.drawText(t, { x: 20, y: 150, size: 14 }); });
  return Buffer.from(await d.save());
}

test('compare: highlights added and removed words', async ({ page }) => {
  await openTool(page, 'compare');
  await page.locator('#f_a').setInputFiles(pdfFile(await textPdf(['The quick brown fox jumps over the lazy dog']), 'a.pdf'));
  await page.locator('#f_b').setInputFiles(pdfFile(await textPdf(['The quick red fox jumps over the lazy dog today']), 'b.pdf'));
  await expect(page.locator('#go')).toBeEnabled();
  await page.locator('#go').click();
  await expect(page.locator('#sum')).toContainText('2 word(s) added');
  await expect(page.locator('#sum')).toContainText('1 word(s) removed');
  await expect(page.locator('#pages del')).toHaveText('brown');
  await expect(page.locator('#pages ins')).toHaveText(['red', 'today']);
  await expect(page.locator('#res a[download]')).toBeVisible();
});

test('compare: identical files, different page counts, and no-text files', async ({ page }) => {
  await openTool(page, 'compare');
  const same = await textPdf(['Same text here']);
  await page.locator('#f_a').setInputFiles(pdfFile(same, 'a.pdf'));
  await page.locator('#f_b').setInputFiles(pdfFile(same, 'b.pdf'));
  await page.locator('#go').click();
  await expect(page.locator('#sum')).toContainText('No text differences');
  await page.locator('#f_b').setInputFiles(pdfFile(await textPdf(['Same text here', 'Extra page words']), 'c.pdf'));
  await page.locator('#go').click();
  await expect(page.locator('#sum')).toContainText('Page counts differ (1 vs 2)');
  await expect(page.locator('#pages')).toContainText('only in revised');
  await page.locator('#f_b').setInputFiles(pdfFile(await textPdf(['']), 'blank.pdf'));
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('no selectable text');
});

test('compare: rejects fake and empty files', async ({ page }) => {
  await openTool(page, 'compare');
  await page.locator('#f_a').setInputFiles({ name: 'x.pdf', mimeType: 'application/pdf', buffer: Buffer.from('nope') });
  await expect(page.locator('#status')).toContainText('not a valid PDF');
  await page.locator('#f_a').setInputFiles({ name: 'e.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) });
  await expect(page.locator('#status')).toContainText('empty');
});

test('image watermark: needs an image, then stamps every page', async ({ page }) => {
  await openTool(page, 'imgwatermark');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([300, 300])));
  await expect(page.locator('#wi')).toBeVisible();
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('Choose a watermark image');
  await page.locator('#wi').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await expect(page.locator('#status')).toContainText('Image loaded');
  await page.locator('#pos').selectOption('Tile');
  await page.locator('#rot').fill('30');
  const out = await runAndDownload(page, '#go');
  expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  expect(out.toString('latin1')).toMatch(/\/Subtype\s*\/Image/);
});

test('image watermark: bad page range is reported', async ({ page }) => {
  await openTool(page, 'imgwatermark');
  await page.locator('#fi').setInputFiles(pdfFile(await makePdf([300])));
  await page.locator('#wi').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
  await page.locator('#pg').fill('5');
  await page.locator('#go').click();
  await expect(page.locator('#status')).toContainText('outside 1–1');
});
