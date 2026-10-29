/* BADPDF – Edit PDF: full-page editor.
   Layout: toolbar (Annotate / Edit modes + tools) · page thumbnails · continuous pages with zoom bar · properties panel · "Save changes".
   Replaces the simple Edit PDF tool from editor-tools.js. Runs 100 % in the browser (pdf-lib + PDF.js); nothing is uploaded.
   Uses globals from the main page: L (pdf-lib), pdfjsLib, $, esc, base, TOOLS, app, revoke, MAXMB, and window.BP (from editor-tools.js). */
(() => {
  const T = TOOLS.find((t) => t.id === "edit");
  if (!T || !window.BP) return;
  T.d = "Add text, images, shapes and drawings, highlight and annotate – and edit the existing text of your PDF.";

  const NS = "http://www.w3.org/2000/svg";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const r1 = (v) => Math.round(v * 10) / 10;
  const mk = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const FF = {
    Helvetica: 'Helvetica,Arial,"Liberation Sans",sans-serif',
    Times: '"Times New Roman",Times,"Liberation Serif",serif',
    Courier: '"Courier New",Courier,"Liberation Mono",monospace',
  };
  const PDF_FONTS = {
    Helvetica: ["Helvetica", "HelveticaBold", "HelveticaOblique", "HelveticaBoldOblique"],
    Times: ["TimesRoman", "TimesRomanBold", "TimesRomanItalic", "TimesRomanBoldItalic"],
    Courier: ["Courier", "CourierBold", "CourierOblique", "CourierBoldOblique"],
  };
  const BASE = 0.94; // baseline position inside a text line box, as a fraction of the font size (CSS line-height 1.2)
  const LH = 1.2;
  const KIND = { text: "Text", img: "Image", rect: "Rectangle", ell: "Ellipse", line: "Line", arrow: "Arrow", pen: "Drawing", hl: "Highlight" };
  const GR = { text: "text", rect: "shape", ell: "shape", line: "line", arrow: "line", pen: "pen", hl: "hl" };
  const TOOL_META = {
    select: ["hand", "Select and move"], text: ["type", "Add text or edit existing text"], img: ["image", "Add image"], pen: ["pencil", "Draw"],
    shape: ["shapes", "Shapes"], hl: ["highlighter", "Highlight"], ul: ["underline", "Underline"], st: ["strike", "Strikethrough"],
  };
  const MODES = { edit: ["select", "text", "img", "pen", "shape"], annotate: ["select", "hl", "ul", "st", "pen", "text"] };
  const ICON = {
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0"/><path d="M14 10V4a2 2 0 0 0-4 0v2"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    shapes: '<rect x="3" y="3" width="10" height="10" rx="1.5"/><circle cx="16" cy="16" r="5"/>',
    highlighter: '<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>',
    underline: '<path d="M6 4v6a6 6 0 0 0 12 0V4"/><line x1="4" x2="20" y1="20" y2="20"/>',
    strike: '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><line x1="4" x2="20" y1="12" y2="12"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    redo: '<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/>',
    up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    zout: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/>', zin: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    fith: '<path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/>', fitw: '<path d="M3 12h18"/><path d="m7 8-4 4 4 4"/><path d="m17 8 4 4-4 4"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    go: '<circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="m12 8 4 4-4 4"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    rect: '<rect x="3" y="5" width="18" height="14" rx="1"/>', ell: '<ellipse cx="12" cy="12" rx="9" ry="7"/>',
    line: '<path d="M5 19 19 5"/>', arrow: '<path d="M5 19 19 5"/><path d="M9 5h10v10"/>',
    pen2: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    annot: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    edit: '<line x1="21" x2="3" y1="6" y2="6"/><line x1="15" x2="3" y1="12" y2="12"/><line x1="17" x2="3" y1="18" y2="18"/>',
    chevl: '<path d="m15 18-6-6 6-6"/>', chevr: '<path d="m9 18 6-6-6-6"/>',
  };
  const ic = (n, s = 20) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  const CSS = `
body.editing main{max-width:none;margin:0;padding:0}
body.editing footer{display:none}
.ed{--ebg:#f1f2f7;--edge:#d9dbe4;--blue:#2f6fed;--ibg:#e8f4fd;--ibd:#7cc4f5;--ifg:#1e3a5f;display:flex;flex-direction:column;height:calc(100vh - var(--hh,60px));height:calc(100dvh - var(--hh,60px));background:var(--ebg);overflow:hidden;position:relative}
@media(prefers-color-scheme:dark){:root:not([data-theme=light]) .ed{--ebg:#101015;--edge:#2d2d36;--ibg:#12293d;--ibd:#2b5d85;--ifg:#cfe6f7}}
.ed button{cursor:pointer}.ed .ico{display:block;flex:none}
.ed-top{display:flex;align-items:center;background:var(--bg);border-bottom:1px solid var(--bd);padding:0 12px;min-height:56px;overflow-x:auto;flex:none;gap:0}
.seg{display:flex;border:2px solid var(--fg);border-radius:99px;overflow:hidden;margin:0 16px 0 40px;flex:none}
.seg button{border:0;background:var(--bg);color:var(--fg);padding:7px 16px;font-weight:700;display:flex;gap:7px;align-items:center}
.seg button[aria-pressed=true]{background:var(--fg);color:var(--bg)}
.tools{display:flex;flex:none;border-left:1px solid var(--bd)}
.tl{width:64px;height:56px;border:0;border-right:1px solid var(--bd);background:var(--bg);color:var(--fg);display:grid;place-items:center}
.tl:hover{background:var(--soft)}.tl[aria-pressed=true]{background:var(--soft);color:var(--red);box-shadow:inset 0 -3px 0 var(--red)}
.ed-sp{flex:1;min-width:8px}.hb{border:1px solid var(--bd);background:var(--card);color:var(--fg);border-radius:8px;width:40px;height:40px;display:grid;place-items:center;margin-left:8px;flex:none}
.hb:disabled{opacity:.35;cursor:not-allowed}
.ed-body{flex:1;min-height:0;display:grid;grid-template-columns:auto 14px minmax(0,1fr) 340px}
.ed-th{width:170px;overflow:auto;padding:18px 0;display:flex;flex-direction:column;align-items:center;gap:16px}
.noth .ed-th{width:0;padding:0;overflow:hidden}
.th{border:0;background:none;padding:0;text-align:center;color:var(--fg);font-size:14px}.th canvas{display:block;background:#fff;box-shadow:0 1px 3px #0003;margin:0 auto 6px;border:1px solid var(--edge)}
.th[aria-current=true] canvas{outline:2px solid var(--blue);outline-offset:0}.th[aria-current=true]{font-weight:700}
.ed-fold{background:var(--edge);border:0;color:var(--mut);display:grid;place-items:center;padding:0;width:14px}.ed-fold:hover{color:var(--fg)}
.ed-stage{position:relative;min-width:0;min-height:0}
.ed-scroll{position:absolute;inset:0;overflow:auto;padding:24px 24px 96px}
.ed-pages{display:flex;flex-direction:column;align-items:center;gap:16px;width:max-content;min-width:100%;position:relative}
.pw{position:relative;background:#fff;box-shadow:0 1px 6px #0003;flex:none}
.pw .pcv{position:absolute;left:0;top:0;width:100%;height:100%;display:block}
.ly{position:absolute;left:0;top:0;transform-origin:0 0;user-select:none;-webkit-user-select:none}
.ly .runs,.ly .run{position:absolute}.ly .run{pointer-events:none}
.ed.t-text .run{pointer-events:auto;cursor:text}.ed.t-text .run:hover{background:#2f6fed1f;outline:calc(1px*var(--iz,1)) solid #2f6fed}
.ly .tx{position:absolute;white-space:pre;line-height:1.2;min-width:8px;min-height:1.2em;margin:0;padding:0;cursor:move;touch-action:none;outline:none;color:#000}
.ly .tx:empty::before{content:attr(data-ph);opacity:.4}
.ly .tx.editing{cursor:text;user-select:text;-webkit-user-select:text;outline:calc(1px*var(--iz,1)) dashed var(--blue)}
.ly .cov{position:absolute;pointer-events:none}
.ly .im{position:absolute;cursor:move;touch-action:none}.ly .im img{width:100%;height:100%;display:block;pointer-events:none;user-select:none;-webkit-user-drag:none}
.ly svg.vec{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.ly svg.vec [data-id]{touch-action:none;cursor:move}
.ed.t-text .ly{cursor:text}.ed.t-pen .ly,.ed.t-shape .ly,.ed.t-hl .ly,.ed.t-ul .ly,.ed.t-st .ly{cursor:crosshair;touch-action:none}
.ed.t-pen .ly *,.ed.t-shape .ly *,.ed.t-hl .ly *,.ed.t-ul .ly *,.ed.t-st .ly *{cursor:crosshair}
.sel{position:absolute;pointer-events:none;outline:calc(1.5px*var(--iz,1)) solid var(--blue)}
.sel .hd{position:absolute;width:calc(11px*var(--iz,1));height:calc(11px*var(--iz,1));margin:calc(-5.5px*var(--iz,1)) 0 0 calc(-5.5px*var(--iz,1));background:#fff;border:calc(1.5px*var(--iz,1)) solid var(--blue);border-radius:50%;pointer-events:auto;touch-action:none}
.ed-nav{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);display:flex;align-items:center;gap:4px;background:#3d4350;color:#fff;border-radius:8px;padding:8px 10px;box-shadow:0 4px 14px #0005;z-index:4;max-width:calc(100% - 16px)}
.ed-nav button{background:none;border:0;color:#fff;padding:4px;display:grid;place-items:center;border-radius:6px}.ed-nav button:hover{background:#ffffff26}.ed-nav button:disabled{opacity:.4}
.ed .ed-nav input[type=text]{width:60px;text-align:center;background:#6b7283;color:#fff;border:0;border-radius:4px;padding:6px 4px;font-size:16px}.ed .ed-nav input:focus-visible{outline:2px solid #fff}
.ed-nav,.ed-nav span{white-space:nowrap}.ed-nav .sep{width:1px;height:24px;background:#ffffff4d;margin:0 6px}.ed-nav span{font-size:16px}
.ed-panel{border-left:1px solid var(--bd);background:var(--bg);display:flex;flex-direction:column;min-height:0}
.ed-panel h2{margin:0;padding:22px 16px 16px;text-align:center;font-size:26px;border-bottom:1px solid var(--bd)}
.pn-body{flex:1;overflow:auto;padding:16px}.pn-foot{padding:16px}
.pn-info{border:1px solid var(--ibd);background:var(--ibg);color:var(--ifg);border-radius:8px;padding:14px 16px;display:flex;gap:12px;font-size:17px;line-height:1.5;align-items:flex-start}
.pn-info .ico{margin-top:4px;color:#2b8fd9}
.pn-h{font-weight:700;font-size:16px;margin:0 0 10px;display:flex;justify-content:space-between;align-items:center}
.pn-tip{color:var(--mut);font-size:13px;margin:10px 0 0}
.fld{margin:0 0 14px}.fld>label,.fld label.l{display:block;font-weight:600;font-size:13px;margin-bottom:5px}.ed select,.ed input[type=number],.ed input[type=text]{padding:8px 10px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);width:100%}
.frow{display:flex;gap:10px;align-items:flex-end}.frow>div{flex:1}
.fmt{display:flex;gap:6px;flex:none!important}.fb{width:38px;height:38px;border:1px solid var(--bd);background:var(--card);color:var(--fg);border-radius:8px;font-size:16px}.fb[aria-pressed=true]{background:var(--red);color:#fff;border-color:var(--red)}
.sws{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.swb{width:28px;height:28px;border-radius:50%;border:1px solid #0004;padding:0}.swb[aria-pressed=true]{outline:2px solid var(--blue);outline-offset:2px}
.sws input[type=color]{width:34px;height:30px;padding:0;border:1px solid var(--bd);border-radius:6px;background:none}
.shp{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.shp button{height:44px;border:1px solid var(--bd);background:var(--card);color:var(--fg);border-radius:8px;display:grid;place-items:center}.shp button[aria-pressed=true]{border-color:var(--red);color:var(--red);background:var(--soft)}
.pn-act{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}.pn-act button{flex:1;border:1px solid var(--bd);background:var(--card);color:var(--fg);border-radius:8px;padding:9px 10px;display:flex;gap:6px;align-items:center;justify-content:center;font-weight:600;min-width:110px}
.pn-act button.danger{color:#b91c1c;border-color:#fca5a5}
.save{width:100%;height:68px;border:0;border-radius:10px;background:var(--red);color:#fff;font:700 24px/1 inherit;display:flex;gap:14px;align-items:center;justify-content:center;box-shadow:0 2px 8px #e5322d55}
.save:disabled{opacity:.42;cursor:not-allowed;box-shadow:none}.lnk{background:none;border:0;color:inherit;text-decoration:underline;padding:0;font-weight:700}
.ed .msg{margin:0 0 12px}
@media(max-width:900px){
 .ed-body{display:flex;flex-direction:column}.ed-th,.ed-fold{display:none}.ed-stage{flex:1;min-height:0}
 .ed-panel{flex:none;max-height:44vh;border-left:0;border-top:1px solid var(--bd)}.ed-panel h2{display:none}.save{height:52px;font-size:19px}.pn-info{font-size:14px;padding:10px 12px}
 .seg{margin-left:4px}.tl{width:52px}.ed-nav{bottom:8px}
}`;
  if (!document.getElementById("ed-css")) document.head.appendChild(Object.assign(mk("style"), { id: "ed-css", textContent: CSS }));

  let cleanupFn = null;
  const cleanup = () => { if (cleanupFn) { cleanupFn(); cleanupFn = null; } document.body.classList.remove("editing"); };
  addEventListener("hashchange", () => { if (location.hash !== "#edit") cleanup(); });

  T.ui = (t) => {
    cleanup(); revoke();
    BP.start(t, (pdf) => launch(t, pdf),
      "Upload a PDF, then add text, images, shapes and drawings, highlight and annotate, or click existing text to edit it. When you are done, press “Save changes” to download the new PDF.");
  };

  function launch(t, pdf) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const S = {
      mode: "edit", tool: "select", shape: "rect", z: 1, objs: [], sel: null, editing: null, nid: 0, cur: 0,
      hist: ["[]"], hi: 0, saved: "[]", imgs: new Map(), out: null, qt: 0,
      D: {
        text: { font: "Helvetica", size: 14, bold: false, italic: false, ul: false, align: "left", c: "#000000" },
        shape: { c: "#e5322d", f: "", fc: "#ffe066", lw: 2, op: 1 },
        line: { c: "#e5322d", lw: 2 }, pen: { c: "#e5322d", lw: 3 },
        hl: { c: "#ffeb3b" }, ul: { c: "#e5322d" }, st: { c: "#e5322d" },
      },
    };
    const pg = []; // per page: {w,h,vp,page,wrap,cv,layer,runsEl,els,sel,runs,styles,vis,rz,busy,again}

    document.body.classList.add("editing");
    app.innerHTML = "";
    const root = mk("div", "ed t-select"); app.appendChild(root);
    const hdr = document.querySelector("header");
    const setHH = () => root.style.setProperty("--hh", (hdr ? hdr.offsetHeight : 60) + "px");
    setHH();

    root.innerHTML = `
<div class="ed-top">
  <div class="seg" role="group" aria-label="Mode"><button data-mode="annotate" aria-pressed="false">${ic("annot", 18)}Annotate</button><button data-mode="edit" aria-pressed="true">${ic("edit", 18)}Edit</button></div>
  <div class="tools" id="tools" role="toolbar" aria-label="Tools"></div>
  <div class="ed-sp"></div>
  <button class="hb" id="undo" aria-label="Undo" title="Undo (Ctrl+Z)">${ic("undo")}</button><button class="hb" id="redo" aria-label="Redo" title="Redo (Ctrl+Y)">${ic("redo")}</button>
</div>
<div class="ed-body" id="body">
  <div class="ed-th" id="th" aria-label="Page thumbnails"></div>
  <button class="ed-fold" id="fold" aria-label="Show or hide page thumbnails" title="Show or hide thumbnails">${ic("chevl", 12)}</button>
  <div class="ed-stage">
    <div class="ed-scroll" id="sc"><div class="ed-pages" id="pgs"><p class="small">Loading pages…</p></div></div>
    <div class="ed-nav" role="group" aria-label="Page and zoom controls">
      <button id="pprev" aria-label="Previous page" title="Previous page">${ic("up")}</button><button id="pnext" aria-label="Next page" title="Next page">${ic("down")}</button>
      <input id="pgn" type="text" inputmode="numeric" value="1" aria-label="Current page"><span>/ <span id="pgt">${pdf.n}</span></span>
      <div class="sep"></div>
      <button id="zout" aria-label="Zoom out" title="Zoom out">${ic("zout", 24)}</button><button id="zin" aria-label="Zoom in" title="Zoom in">${ic("zin", 24)}</button>
      <input id="zv" type="text" value="100%" aria-label="Zoom level">
      <div class="sep"></div>
      <button id="fitw" aria-label="Fit page width" title="Fit width">${ic("fitw")}</button><button id="fith" aria-label="Fit whole page" title="Fit page">${ic("fith")}</button>
    </div>
  </div>
  <aside class="ed-panel" aria-label="Edit PDF options">
    <h2>Edit PDF</h2>
    <div class="pn-body"><div id="pn-status" role="status"></div><div id="pb"></div></div>
    <div class="pn-foot"><button class="save" id="save" disabled>Save changes ${ic("go", 30)}</button><button class="lnk small" id="again" style="margin-top:10px;width:100%;text-align:center;font-weight:600">Upload another PDF</button></div>
  </aside>
</div>
<input type="file" id="imgf" hidden accept="image/png,image/jpeg,image/webp,image/gif">`;
    const R = (s) => root.querySelector(s);
    const sc = R("#sc"), pgs = R("#pgs"), pb = R("#pb");

    /* ---------- generic helpers ---------- */
    const msg = (kind, html) => { R("#pn-status").innerHTML = html ? `<div class="msg ${kind}">${html}</div>` : ""; };
    const hasChanges = () => S.objs.some((o) => o.t !== "text" || o.s.trim() || o.cv);
    const dirty = () => hasChanges() && S.hist[S.hi] !== S.saved;
    const toPt = (ev, q) => { const r = q.wrap.getBoundingClientRect(); return [(ev.clientX - r.left) / S.z, (ev.clientY - r.top) / S.z]; };
    const sigOf = (o) => JSON.stringify([o.x, o.y, o.s, o.size, o.c, o.font, o.bold, o.italic, o.ul, o.align]);
    const readText = (e) => e.innerText.replace(/\u00a0/g, " ").replace(/\n$/, "");
    const objById = (id) => S.objs.find((o) => o.id === id);

    /* ---------- history ---------- */
    function refreshUI() {
      R("#undo").disabled = S.hi <= 0; R("#redo").disabled = S.hi >= S.hist.length - 1;
      R("#save").disabled = !hasChanges();
    }
    function commit() {
      clearTimeout(S.qt); S.qt = 0;
      const s = JSON.stringify(S.objs);
      if (s !== S.hist[S.hi]) {
        S.hist = S.hist.slice(0, S.hi + 1); S.hist.push(s); if (S.hist.length > 120) S.hist.shift(); S.hi = S.hist.length - 1;
        msg("", "");
      }
      refreshUI();
    }
    const queueCommit = () => { clearTimeout(S.qt); S.qt = setTimeout(commit, 400); refreshUI(); };
    function restore(s) {
      endEditSilently();
      S.objs = JSON.parse(s);
      if (S.sel && !objById(S.sel.id)) S.sel = null; else if (S.sel) S.sel = objById(S.sel.id);
      pg.forEach((_, i) => sync(i)); placeSel(); panel(); refreshUI();
    }
    const undo = () => { if (S.qt) commit(); if (S.hi > 0) { S.hi--; restore(S.hist[S.hi]); } };
    const redo = () => { if (S.qt) commit(); if (S.hi < S.hist.length - 1) { S.hi++; restore(S.hist[S.hi]); } };

    /* ---------- object DOM ---------- */
    function make(o) {
      const q = pg[o.p];
      if (o.t === "text") { const e = mk("div", "tx"); e.dataset.id = o.id; e.dataset.ph = "Type text…"; return e; }
      if (o.t === "img") { const e = mk("div", "im"); e.dataset.id = o.id; e.appendChild(mk("img")).alt = ""; return e; }
      if (o.t === "cov") { const e = mk("div", "cov"); e.dataset.id = o.id; return e; }
      const s = document.createElementNS(NS, "svg");
      s.setAttribute("class", "vec"); s.setAttribute("width", q.w); s.setAttribute("height", q.h); s.dataset.id = o.id;
      const tag = o.t === "rect" || o.t === "hl" ? "rect" : o.t === "ell" ? "ellipse" : "path";
      s._v = document.createElementNS(NS, tag); s._h = document.createElementNS(NS, tag);
      s._v.dataset.id = s._h.dataset.id = o.id; s._v.setAttribute("pointer-events", "none");
      s.append(s._v, s._h);
      return s;
    }
    function pathD(o) {
      if (o.t === "pen") return o.pts.map((p, i) => (i ? "L" : "M") + r1(p[0]) + " " + r1(p[1])).join("");
      let d = `M${o.x1} ${o.y1}L${o.x2} ${o.y2}`;
      if (o.t === "arrow") {
        const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), hl = Math.max(9, o.lw * 4.5);
        for (const s of [-1, 1]) d += `M${o.x2 - hl * Math.cos(a + s * 0.45)} ${o.y2 - hl * Math.sin(a + s * 0.45)}L${o.x2} ${o.y2}`;
      }
      return d;
    }
    function paint(o, e) {
      if (o.t === "text") {
        const st = e.style;
        st.left = o.x + "px"; st.top = o.y + "px"; st.fontSize = o.size + "px"; st.fontFamily = FF[o.font]; st.fontWeight = o.bold ? 700 : 400;
        st.fontStyle = o.italic ? "italic" : "normal"; st.textDecoration = o.ul ? "underline" : "none"; st.color = o.c; st.textAlign = o.align;
        if (S.editing !== o.id && e.textContent !== o.s) e.textContent = o.s;
      } else if (o.t === "img") {
        const st = e.style; st.left = o.x + "px"; st.top = o.y + "px"; st.width = o.w + "px"; st.height = o.h + "px";
        const im = e.firstChild, u = S.imgs.get(o.key)?.url; if (u && im.getAttribute("src") !== u) im.src = u;
      } else if (o.t === "cov") {
        const st = e.style; st.left = o.x + "px"; st.top = o.y + "px"; st.width = o.w + "px"; st.height = o.h + "px"; st.background = o.c;
      } else {
        const v = e._v, h = e._h, set = (el, a) => { for (const k in a) el.setAttribute(k, a[k]); };
        const geo = o.t === "rect" || o.t === "hl" ? { x: o.x, y: o.y, width: o.w, height: o.h }
          : o.t === "ell" ? { cx: o.x + o.w / 2, cy: o.y + o.h / 2, rx: Math.max(0.1, Math.abs(o.w / 2)), ry: Math.max(0.1, Math.abs(o.h / 2)) } : { d: pathD(o) };
        set(v, geo); set(h, geo);
        const filled = o.t === "hl" || ((o.t === "rect" || o.t === "ell") && o.f);
        if (o.t === "hl") set(v, { fill: o.c, "fill-opacity": 0.35, stroke: "none" });
        else if (o.t === "rect" || o.t === "ell") set(v, { fill: o.f || "none", stroke: o.c, "stroke-width": o.lw, opacity: o.op });
        else set(v, { fill: "none", stroke: o.c, "stroke-width": o.lw, "stroke-linecap": "round", "stroke-linejoin": "round" });
        set(h, { fill: filled ? "rgba(0,0,0,0.001)" : "none", stroke: "rgba(0,0,0,0.001)", "stroke-width": Math.max(o.lw || 0, 12), "pointer-events": filled ? "all" : "stroke" });
      }
    }
    function sync(i) {
      const q = pg[i]; if (!q) return;
      const want = S.objs.filter((o) => o.p === i), ids = new Set(want.map((o) => o.id));
      for (const [id, e] of q.els) if (!ids.has(id)) { e.remove(); q.els.delete(id); }
      for (const o of want) { let e = q.els.get(o.id); if (!e) { e = make(o); q.els.set(o.id, e); q.layer.insertBefore(e, q.sel || null); } paint(o, e); }
      const order = [...q.layer.children].filter((n) => n.dataset && n.dataset.id).map((n) => +n.dataset.id);
      if (order.join() !== want.map((o) => o.id).join()) for (const o of want) q.layer.insertBefore(q.els.get(o.id), q.sel || null);
    }

    /* ---------- bounding boxes + selection box ---------- */
    function bbox(o) {
      if (o.t === "text") { const e = pg[o.p].els.get(o.id); return e ? { x: o.x, y: o.y, w: Math.max(8, e.offsetWidth), h: Math.max(o.size * LH, e.offsetHeight) } : null; }
      if (o.t === "line" || o.t === "arrow") { const x = Math.min(o.x1, o.x2), y = Math.min(o.y1, o.y2); return { x, y, w: Math.abs(o.x2 - o.x1), h: Math.abs(o.y2 - o.y1) }; }
      if (o.t === "pen") { const xs = o.pts.map((p) => p[0]), ys = o.pts.map((p) => p[1]), x = Math.min(...xs), y = Math.min(...ys); return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }; }
      return { x: o.x, y: o.y, w: o.w, h: o.h };
    }
    function placeSel() {
      pg.forEach((q) => { if (q.sel) { q.sel.remove(); q.sel = null; } });
      const o = S.sel; if (!o) return;
      const q = pg[o.p], b = bbox(o); if (!b) return;
      const s = mk("div", "sel"); q.sel = s;
      const pad = o.t === "pen" || o.t === "line" || o.t === "arrow" ? (o.lw || 2) / 2 + 3 : 0;
      s.style.cssText = `left:${b.x - pad}px;top:${b.y - pad}px;width:${b.w + 2 * pad}px;height:${b.h + 2 * pad}px`;
      const add = (h, left, top, cur) => { const n = mk("div", "hd"); n.dataset.h = h; n.style.left = left; n.style.top = top; n.style.cursor = cur; s.appendChild(n); };
      if (S.editing === o.id) { /* no handles while typing */ }
      else if (o.t === "text") add("se", "100%", "100%", "nwse-resize");
      else if (o.t === "line" || o.t === "arrow") { add("p1", o.x1 - b.x + pad + "px", o.y1 - b.y + pad + "px", "move"); add("p2", o.x2 - b.x + pad + "px", o.y2 - b.y + pad + "px", "move"); }
      else if (o.t !== "pen") { add("nw", "0", "0", "nwse-resize"); add("ne", "100%", "0", "nesw-resize"); add("sw", "0", "100%", "nesw-resize"); add("se", "100%", "100%", "nwse-resize"); }
      q.layer.appendChild(s);
    }
    function select(o) {
      if (S.sel === o) { placeSel(); return; }
      S.sel = o || null; placeSel(); panel();
    }

    /* ---------- text editing ---------- */
    function startEdit(o) {
      if (S.editing === o.id) return;
      endEdit(); select(o);
      const e = pg[o.p].els.get(o.id); if (!e) return;
      S.editing = o.id; try { e.contentEditable = "plaintext-only"; } catch { /* older browsers */ }
      if (e.contentEditable !== "plaintext-only") e.contentEditable = "true";
      e.classList.add("editing"); e.focus();
      const rg = document.createRange(); rg.selectNodeContents(e); rg.collapse(false);
      const gs = getSelection(); gs.removeAllRanges(); gs.addRange(rg);
      placeSel();
    }
    function endEditSilently() { // used before wholesale state changes
      if (S.editing == null) return;
      const o = objById(S.editing), e = o && pg[o.p].els.get(o.id);
      S.editing = null; if (e) { e.contentEditable = "false"; e.classList.remove("editing"); }
    }
    function endEdit() {
      const id = S.editing; if (id == null) return;
      const o = objById(id), e = o && pg[o.p].els.get(id);
      S.editing = null;
      if (e) { e.contentEditable = "false"; e.classList.remove("editing"); }
      if (!o) return;
      const unchangedEdit = o.sig && sigOf(o) === o.sig;
      if ((!o.s.trim() && !o.cv) || unchangedEdit) { // empty new box, or existing text opened but left unchanged → drop it (original stays untouched)
        S.objs = S.objs.filter((x) => x !== o && !(unchangedEdit && x.id === o.cv));
        if (S.sel === o) S.sel = null; sync(o.p); placeSel(); panel(); refreshUI(); return;
      }
      placeSel(); commit();
    }
    function newText(i, x, y) {
      const d = S.D.text, o = { id: ++S.nid, t: "text", p: i, x: r1(x), y: r1(y - d.size * 0.6), s: "", font: d.font, size: d.size, bold: d.bold, italic: d.italic, ul: d.ul, align: d.align, c: d.c };
      S.objs.push(o); sync(i); startEdit(o);
    }

    /* existing text → runs (lines) that can be clicked and edited */
    async function loadRuns(i) {
      const q = pg[i]; if (q.runs || q.loading) return; q.loading = true;
      try {
        const tc = await q.page.getTextContent(); q.styles = tc.styles || {};
        const items = [];
        for (const it of tc.items) {
          if (!it.str || !it.transform) continue;
          const tx = pdfjsLib.Util.transform(q.vp.transform, it.transform), size = Math.hypot(tx[2], tx[3]);
          if (size < 2 || Math.abs(tx[1]) > 0.02 * size || Math.abs(tx[2]) > 0.02 * size || tx[0] < 0) continue; // upright, left-to-right text only
          items.push({ str: it.str.replace(/\u00a0/g, " "), x: tx[4], b: tx[5], size, w: it.width * (q.vp.scale || 1), fn: it.fontName });
        }
        const runs = []; let cur = null;
        for (const it of items) {
          const gap = cur ? it.x - (cur.x + cur.w) : 0;
          if (cur && Math.abs(it.b - cur.b) < 0.35 * cur.size && Math.abs(it.size - cur.size) < 0.25 * cur.size && gap < 0.9 * cur.size && gap > -0.5 * cur.size) {
            if (gap > 0.18 * cur.size && !/\s$/.test(cur.str) && !/^\s/.test(it.str)) cur.str += " ";
            cur.str += it.str; cur.w = it.x + it.w - cur.x;
          } else { if (cur) runs.push(cur); cur = { ...it }; }
        }
        if (cur) runs.push(cur);
        q.runs = runs.filter((r) => r.str.trim()).map((r) => ({ ...r, str: r.str.replace(/\s+$/, "").replace(/ﬁ/g, "fi").replace(/ﬂ/g, "fl") }));
        q.runs.forEach((r, k) => {
          const d = mk("div", "run"); d.dataset.r = k;
          d.style.cssText = `left:${r.x - 1}px;top:${r.b - 0.93 * r.size}px;width:${r.w + 2}px;height:${1.2 * r.size}px`; q.runsEl.appendChild(d);
        });
      } catch { q.runs = []; }
      q.loading = false;
    }
    function fontInfo(q, r) {
      let name = "", bold = false, italic = false;
      try { const f = q.page.commonObjs.get(r.fn); if (f) { name = f.name || f.fallbackName || ""; bold = !!f.bold; italic = !!f.italic; } } catch { /* font not resolved */ }
      const fam = name + " " + (q.styles?.[r.fn]?.fontFamily || "");
      bold = bold || /bold|black|heavy|semibold|demi/i.test(fam); italic = italic || /italic|oblique/i.test(fam);
      const font = /courier|mono|consolas/i.test(fam) ? "Courier" : /times|serif|georgia|garamond|cambria|palatino|minion|book/i.test(fam) && !/sans/i.test(fam) ? "Times" : "Helvetica";
      return { font, bold, italic };
    }
    function sample(q, r) { // background and text colour of an existing run, read from the rendered page
      const dflt = { fg: "#000000", bg: "#ffffff" };
      try {
        const c = q.cv; if (!c || !c.width || !q.rz) return dflt;
        const k = c.width / q.w, x = Math.max(0, Math.floor(r.x * k)), y = Math.max(0, Math.floor((r.b - 0.9 * r.size) * k));
        const w = Math.min(c.width - x, Math.ceil(r.w * k)), h = Math.min(c.height - y, Math.ceil(1.1 * r.size * k));
        if (w < 1 || h < 1) return dflt;
        const d = c.getContext("2d").getImageData(x, y, w, h).data, cnt = new Map();
        for (let p = 0; p < d.length; p += 4) { const key = (d[p] >> 4) << 8 | (d[p + 1] >> 4) << 4 | d[p + 2] >> 4; cnt.set(key, (cnt.get(key) || 0) + 1); }
        let best = 0, bk = 0; for (const [key, n] of cnt) if (n > best) { best = n; bk = key; }
        const bg = [(bk >> 8 & 15) * 17, (bk >> 4 & 15) * 17, (bk & 15) * 17];
        let far = -1, fg = [0, 0, 0];
        for (let p = 0; p < d.length; p += 4) { const dd = (d[p] - bg[0]) ** 2 + (d[p + 1] - bg[1]) ** 2 + (d[p + 2] - bg[2]) ** 2; if (dd > far) { far = dd; fg = [d[p], d[p + 1], d[p + 2]]; } }
        const hex = (a) => "#" + a.map((v) => v.toString(16).padStart(2, "0")).join("");
        // average the bg-key pixels for an exact-looking fill
        let sr = 0, sg = 0, sb = 0, n = 0;
        for (let p = 0; p < d.length; p += 4) { const key = (d[p] >> 4) << 8 | (d[p + 1] >> 4) << 4 | d[p + 2] >> 4; if (key === bk) { sr += d[p]; sg += d[p + 1]; sb += d[p + 2]; n++; } }
        return { fg: far < 900 ? (bg[0] > 128 ? "#000000" : "#ffffff") : hex(fg), bg: hex([Math.round(sr / n), Math.round(sg / n), Math.round(sb / n)]) };
      } catch { return dflt; }
    }
    function editRun(i, r) {
      const ex = r.tid && objById(r.tid); if (ex) { startEdit(ex); return; }
      const q = pg[i], fi = fontInfo(q, r), col = sample(q, r);
      const cv = { id: ++S.nid, t: "cov", p: i, x: r1(r.x - 1.5), y: r1(r.b - 0.93 * r.size), w: r1(r.w + 3), h: r1(1.2 * r.size), c: col.bg };
      const o = { id: ++S.nid, t: "text", p: i, x: r1(r.x), y: r1(r.b - BASE * r.size), s: r.str, font: fi.font, size: r1(r.size), bold: fi.bold, italic: fi.italic, ul: false, align: "left", c: col.fg, cv: cv.id };
      o.sig = sigOf(o); r.tid = o.id;
      S.objs.push(cv, o); sync(i); startEdit(o);
    }

    /* ---------- move / resize / draw ---------- */
    function applyMove(o, b, dx, dy) {
      if (b.x !== undefined) { o.x = r1(b.x + dx); o.y = r1(b.y + dy); }
      if (b.x1 !== undefined) { o.x1 = b.x1 + dx; o.y1 = b.y1 + dy; o.x2 = b.x2 + dx; o.y2 = b.y2 + dy; }
      if (b.pts) o.pts = b.pts.map(([x, y]) => [x + dx, y + dy]);
    }
    function drag(onMove, onUp) {
      const mv = (e) => onMove(e), up = (e) => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); document.removeEventListener("pointercancel", up); onUp(e); };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up); document.addEventListener("pointercancel", up);
    }
    function startMove(ev, q, o) {
      const [sx, sy] = toPt(ev, q), base = JSON.parse(JSON.stringify(o)), wasSel = S.sel === o; let moved = false;
      select(o);
      drag((e) => {
        const [x, y] = toPt(e, q), dx = x - sx, dy = y - sy;
        if (!moved && Math.hypot(dx, dy) * S.z < 3) return;
        moved = true; applyMove(o, base, dx, dy); paint(o, q.els.get(o.id)); placeSel();
      }, () => {
        if (moved) commit(); else if (o.t === "text" && (wasSel || S.tool === "text")) startEdit(o);
      });
    }
    function startResize(ev, q, o, h) {
      ev.preventDefault();
      const b = bbox(o), base = JSON.parse(JSON.stringify(o)); let moved = false;
      drag((e) => {
        const [x, y] = toPt(e, q); moved = true;
        if (o.t === "line" || o.t === "arrow") { if (h === "p1") { o.x1 = x; o.y1 = y; } else { o.x2 = x; o.y2 = y; } }
        else if (o.t === "text") { o.size = r1(clamp(base.size * Math.max((x - b.x) / b.w, (y - b.y) / b.h), 4, 300)); }
        else {
          const west = h.includes("w"), north = h.includes("n"); let x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
          if (west) x0 = x; else x1 = x; if (north) y0 = y; else y1 = y;
          if (o.t === "img") {
            const ar = b.w / b.h, ax = west ? b.x + b.w : b.x, ay = north ? b.y + b.h : b.y;
            let nw = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0) * ar, 8); const nh = nw / ar;
            x0 = west ? ax - nw : ax; x1 = x0 + nw; y0 = north ? ay - nh : ay; y1 = y0 + nh;
          }
          o.x = r1(Math.min(x0, x1)); o.y = r1(Math.min(y0, y1)); o.w = r1(Math.max(4, Math.abs(x1 - x0))); o.h = r1(Math.max(4, Math.abs(y1 - y0)));
        }
        paint(o, q.els.get(o.id)); placeSel(); if (S.sel === o) syncPanelValues();
      }, () => { if (moved) commit(); });
    }
    async function snapRuns(i, rc, kind) { // text-aware highlight / underline / strikethrough
      await loadRuns(i);
      const runs = pg[i].runs || [];
      const hit = runs.filter((r) => {
        const top = r.b - 0.9 * r.size, bot = r.b + 0.25 * r.size, ov = Math.min(bot, rc.y + rc.h) - Math.max(top, rc.y);
        return ov > 0.4 * (bot - top) && rc.x < r.x + r.w && rc.x + rc.w > r.x;
      });
      const col = S.D[kind].c, out = [];
      const rows = new Set(hit.map((r) => Math.round(r.b)));
      for (const r of hit) {
        let x0 = r.x, x1 = r.x + r.w; if (rows.size === 1) { x0 = Math.max(x0, rc.x); x1 = Math.min(x1, rc.x + rc.w); }
        if (x1 - x0 < 1) continue;
        const lw = r1(clamp(r.size * 0.08, 1, 2.5));
        if (kind === "hl") out.push({ t: "hl", x: r1(x0), y: r1(r.b - 0.88 * r.size), w: r1(x1 - x0), h: r1(1.15 * r.size), c: col });
        else { const y = kind === "ul" ? r.b + 0.14 * r.size : r.b - 0.3 * r.size; out.push({ t: "line", x1: r1(x0), y1: r1(y), x2: r1(x1), y2: r1(y), c: col, lw }); }
      }
      if (out.length) return out;
      if (kind === "hl") return [{ t: "hl", x: r1(rc.x), y: r1(rc.y), w: r1(rc.w), h: r1(rc.h), c: col }];
      const y = kind === "ul" ? rc.y + rc.h : rc.y + rc.h / 2;
      return [{ t: "line", x1: r1(rc.x), y1: r1(y), x2: r1(rc.x + rc.w), y2: r1(y), c: col, lw: 1.5 }];
    }
    function startDraw(ev, q, i) {
      const [sx, sy] = toPt(ev, q), T = S.tool, D = S.D; let o, moved = false, added = false;
      const add = () => { if (!added) { S.objs.push(o); added = true; sync(i); } };
      if (T === "pen") { o = { id: ++S.nid, t: "pen", p: i, pts: [[sx, sy]], c: D.pen.c, lw: D.pen.lw }; add(); }
      else if (T === "shape") {
        const ty = S.shape;
        o = ty === "rect" || ty === "ell" ? { id: ++S.nid, t: ty, p: i, x: sx, y: sy, w: 0, h: 0, c: D.shape.c, f: D.shape.f, lw: D.shape.lw, op: D.shape.op }
          : { id: ++S.nid, t: ty, p: i, x1: sx, y1: sy, x2: sx, y2: sy, c: D.line.c, lw: D.line.lw };
      } else o = { id: ++S.nid, t: "hl", p: i, x: sx, y: sy, w: 0, h: 0, c: D[T].c, tmp: true };
      drag((e) => {
        let [x, y] = toPt(e, q);
        if (!moved && Math.hypot(x - sx, y - sy) * S.z < 3 && o.t !== "pen") return;
        moved = true; add();
        if (o.t === "pen") { const l = o.pts[o.pts.length - 1]; if (Math.hypot(x - l[0], y - l[1]) * S.z >= 1.5) o.pts.push([x, y]); }
        else if (o.t === "line" || o.t === "arrow") {
          if (e.shiftKey) { const a = Math.round(Math.atan2(y - sy, x - sx) / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(x - sx, y - sy); x = sx + d * Math.cos(a); y = sy + d * Math.sin(a); }
          o.x2 = x; o.y2 = y;
        } else {
          let w = x - sx, h = y - sy; if (e.shiftKey && T === "shape") { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
          o.x = Math.min(sx, sx + w); o.y = Math.min(sy, sy + h); o.w = Math.abs(w); o.h = Math.abs(h);
        }
        paint(o, q.els.get(o.id));
      }, async () => {
        if (o.t === "pen") { if (o.pts.length < 2) o.pts.push([sx + 0.01, sy]); paint(o, q.els.get(o.id)); commit(); return; }
        if (T === "hl" || T === "ul" || T === "st") {
          if (added) { S.objs = S.objs.filter((x) => x !== o); }
          if (moved && o.w > 2) { const hh = Math.max(o.h, 8), parts = await snapRuns(i, { x: o.x, y: o.y - (hh - o.h) / 2, w: o.w, h: hh }, T); parts.forEach((p) => S.objs.push({ id: ++S.nid, p: i, ...p })); }
          sync(i); commit(); return;
        }
        if (!moved) { // a plain click drops a default-size shape
          if (o.t === "rect" || o.t === "ell") { o.x = sx - 50; o.y = sy - 35; o.w = 100; o.h = 70; } else { o.x2 = sx + 100; o.y2 = sy; }
          add();
        }
        if ((o.t === "rect" || o.t === "ell") && (o.w < 3 || o.h < 3)) { S.objs = S.objs.filter((x) => x !== o); sync(i); return; }
        paint(o, q.els.get(o.id)); commit(); setTool("select"); select(o);
      });
    }

    /* ---------- pointer entry point (one listener set per page layer) ---------- */
    function onDown(ev, i) {
      if (ev.pointerType === "mouse" && ev.button !== 0) return;
      const q = pg[i], tg = ev.target;
      if (S.editing != null && !tg.closest(".tx.editing")) endEdit();
      if (tg.closest(".tx.editing")) return;
      const ae = document.activeElement; if (ae && ae !== document.body && !ae.classList.contains("tx")) ae.blur();
      const hd = tg.closest(".hd"); if (hd) { if (S.sel) startResize(ev, q, S.sel, hd.dataset.h); return; }
      const de = tg.closest("[data-id]"), o = de ? objById(+de.dataset.id) : null, T = S.tool;
      if (T === "select") { if (o && o.t !== "cov") { ev.preventDefault(); startMove(ev, q, o); } else select(null); return; }
      if (T === "text") {
        ev.preventDefault();
        if (o && o.t === "text") { startMove(ev, q, o); return; }
        const rn = tg.closest(".run"); if (rn) { const r = q.runs?.[+rn.dataset.r]; if (r) editRun(i, r); return; }
        const [x, y] = toPt(ev, q); select(null); newText(i, x, y); return;
      }
      ev.preventDefault(); select(null); startDraw(ev, q, i);
    }

    /* ---------- tools / modes ---------- */
    function drawTools() {
      R("#tools").innerHTML = MODES[S.mode].map((k) => `<button class="tl" data-tool="${k}" aria-pressed="${S.tool === k}" aria-label="${TOOL_META[k][1]}" title="${TOOL_META[k][1]}">${ic(TOOL_META[k][0], 24)}</button>`).join("");
      root.querySelectorAll("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.mode === S.mode));
    }
    function setTool(t) {
      if (t === "img") { R("#imgf").click(); return; }
      endEdit(); S.tool = t;
      root.className = root.className.replace(/\bt-\w+/g, "").trim() + " t-" + t;
      if (t !== "select" && t !== "text") S.sel = null;
      drawTools(); placeSel(); panel();
    }
    function setMode(m) { S.mode = m; if (!MODES[m].includes(S.tool)) S.tool = "select"; setTool(S.tool); }
    R(".seg").onclick = (e) => { const b = e.target.closest("[data-mode]"); if (b) setMode(b.dataset.mode); };
    R("#tools").onclick = (e) => { const b = e.target.closest("[data-tool]"); if (b) setTool(b.dataset.tool); };
    R("#undo").onclick = undo; R("#redo").onclick = redo;

    /* ---------- images ---------- */
    const loadImage = (url) => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(Error("That image could not be read.")); im.src = url; });
    async function addImage(f) {
      try {
        if (!/^image\//.test(f.type) || f.size > 20 * 1048576) throw Error("Choose an image file under 20 MB.");
        let bytes = new Uint8Array(await f.arrayBuffer()), type = bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg" : bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : null, url;
        if (!type) { // webp / gif / other → PNG
          const src = URL.createObjectURL(f);
          try { const im = await loadImage(src), c = mk("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext("2d").drawImage(im, 0, 0); bytes = new Uint8Array(await (await new Promise((r) => c.toBlob(r, "image/png"))).arrayBuffer()); type = "png"; }
          finally { URL.revokeObjectURL(src); }
        }
        url = URL.createObjectURL(new Blob([bytes], { type: type === "jpg" ? "image/jpeg" : "image/png" }));
        const im = await loadImage(url), key = "k" + ++S.nid; S.imgs.set(key, { url, bytes, type });
        const i = S.cur, q = pg[i], w = r1(Math.min(220, q.w * 0.6, im.naturalWidth)), h = r1((w * im.naturalHeight) / im.naturalWidth);
        const cy = (sc.scrollTop + sc.clientHeight / 2 - (q.wrap.offsetTop + pgs.offsetTop)) / S.z;
        const o = { id: ++S.nid, t: "img", p: i, key, x: r1((q.w - w) / 2), y: r1(clamp(cy - h / 2, 0, Math.max(0, q.h - h))), w, h };
        endEdit(); S.objs.push(o); sync(i); setTool("select"); select(o); commit(); msg("", "");
      } catch (e) { msg("err", esc(e.message)); }
    }
    R("#imgf").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) addImage(f); };

    /* ---------- properties panel ---------- */
    const SW = ["#000000", "#e5322d", "#2f6fed", "#16a34a", "#f59e0b", "#ffffff"], SWH = ["#ffeb3b", "#a3e635", "#f9a8d4", "#fdba74", "#7dd3fc"];
    const toolGroup = () => (S.tool === "text" ? "text" : S.tool === "shape" ? (S.shape === "rect" || S.shape === "ell" ? "shape" : "line") : ["pen", "hl", "ul", "st"].includes(S.tool) ? S.tool : null);
    const curGroup = () => (S.sel ? GR[S.sel.t] : toolGroup());
    const vals = () => { const g = curGroup(); return S.sel && g ? S.sel : g ? S.D[g] : null; };
    const colorCtl = (k, label, val, sw) => `<div class="fld"><label class="l">${label}</label><div class="sws">${sw.map((c) => `<button class="swb" data-k="${k}" data-v="${c}" style="background:${c}" aria-label="${c}" aria-pressed="${c === String(val).toLowerCase()}"></button>`).join("")}<input type="color" data-k="${k}" value="${val}" aria-label="${label} – custom colour"></div></div>`;
    const numCtl = (k, label, val, min, max, step = 1) => `<div class="fld"><label class="l" for="pn_${k}">${label}</label><input id="pn_${k}" type="number" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${r1(val)}"></div>`;
    function controls(g, v) {
      if (g === "text") {
        const unsupported = S.sel && S.sel.t === "text" && !canEncode(S.sel);
        return `<div class="fld"><label class="l" for="pn_font">Font</label><select id="pn_font" data-k="font">${Object.keys(FF).map((f) => `<option ${f === v.font ? "selected" : ""}>${f}</option>`).join("")}</select></div>
        <div class="frow"><div class="fld"><label class="l" for="pn_size">Size</label><input id="pn_size" type="number" data-k="size" min="4" max="300" step="1" value="${r1(v.size)}"></div>
        <div class="fld fmt"><button class="fb" data-k="bold" data-tg="1" aria-pressed="${!!v.bold}" aria-label="Bold"><b>B</b></button><button class="fb" data-k="italic" data-tg="1" aria-pressed="${!!v.italic}" aria-label="Italic"><i>I</i></button><button class="fb" data-k="ul" data-tg="1" aria-pressed="${!!v.ul}" aria-label="Underline"><u>U</u></button></div></div>
        <div class="fld"><label class="l">Alignment</label><div class="fmt">${["left", "center", "right"].map((a) => `<button class="fb" data-k="align" data-v="${a}" aria-pressed="${v.align === a}" aria-label="Align ${a}">${a === "left" ? "⟸" : a === "center" ? "≡" : "⟹"}</button>`).join("")}</div></div>
        ${colorCtl("c", "Text colour", v.c, SW)}${unsupported ? `<div class="msg note unsup">This text has characters outside the standard PDF fonts (for example Hindi or emoji). It will be saved as an image, so it will not be selectable.</div>` : ""}`;
      }
      if (g === "shape") return `${colorCtl("c", "Line colour", v.c, SW)}${numCtl("lw", "Line width", v.lw, 0.5, 40, 0.5)}
        <div class="fld"><label class="l"><input type="checkbox" data-k="fillon" ${v.f ? "checked" : ""}> Fill shape</label>${v.f ? colorCtl("fc", "Fill colour", v.f, SWH.concat(["#ffffff"])) : ""}</div>
        <div class="fld"><label class="l" for="pn_op">Opacity ${Math.round(v.op * 100)}%</label><input id="pn_op" type="range" data-k="op" min="0.1" max="1" step="0.05" value="${v.op}" style="width:100%"></div>`;
      if (g === "line" || g === "pen") return `${colorCtl("c", g === "pen" ? "Pen colour" : "Line colour", v.c, SW)}${numCtl("lw", g === "pen" ? "Pen width" : "Line width", v.lw, 0.5, 40, 0.5)}`;
      if (g === "hl" || g === "ul" || g === "st") return colorCtl("c", g === "hl" ? "Highlight colour" : "Line colour", v.c, g === "hl" ? SWH : SW);
      return "";
    }
    function panel() {
      const o = S.sel, g = curGroup(), v = vals(); let h = "";
      if (o) {
        h += `<p class="pn-h"><span>${KIND[o.t]}</span></p>`;
        if (o.t === "img") h += numCtl("w", "Width (pt)", o.w, 10, 3000);
        else if (g && v) h += controls(g, v);
        if (o.t === "text" && o.cv) h += `<div class="msg note">This covers text from your original PDF and draws the new text on top, using a standard font, so the look may differ slightly. The old text is hidden, not deleted: it can still be found by copy or search in the saved file.</div>`;
        h += `<div class="pn-act"><button data-act="dup">${ic("copy", 16)}Duplicate</button>${o.t === "text" && o.cv ? `<button data-act="restore">${ic("undo", 16)}Restore original</button>` : ""}<button class="danger" data-act="del">${ic("trash", 16)}Delete</button></div>`;
      } else if (S.tool === "select") {
        h = `<div class="pn-info">${ic("info", 22)}<div>Use the toolbar to modify or add text, upload images, and annotate with ease.</div></div>
        <p class="pn-tip">Tip: choose the <b>Text</b> tool, then click any existing text to edit it, or click an empty spot to add new text. Click an object to move or resize it.</p>`;
      } else {
        const hint = { text: "Click on an empty spot to add text, or click on existing text to edit it.", pen: "Press and drag on the page to draw.", shape: "Press and drag to draw. A plain click drops a default-size shape.", hl: "Drag over text to highlight it.", ul: "Drag over text to underline it.", st: "Drag over text to strike it through." }[S.tool];
        h += `<p class="pn-h"><span>${TOOL_META[S.tool][1]}</span></p>`;
        if (S.tool === "shape") h += `<div class="fld"><label class="l">Shape</label><div class="shp">${["rect", "ell", "line", "arrow"].map((k) => `<button data-act="shape:${k}" aria-pressed="${S.shape === k}" aria-label="${KIND[k]}" title="${KIND[k]}">${ic(k, 22)}</button>`).join("")}</div></div>`;
        if (g && v) h += controls(g, v);
        h += `<p class="pn-tip">${hint}</p>`;
      }
      pb.innerHTML = h;
    }
    function syncPanelValues() { // keep numeric fields live while resizing without rebuilding the panel
      const o = S.sel; if (!o) return;
      const set = (k, val) => { const el = pb.querySelector(`input[data-k="${k}"][type=number]`); if (el && document.activeElement !== el) el.value = r1(val); };
      if (o.t === "text") set("size", o.size); if (o.t === "img") set("w", o.w);
    }
    function canEncode(o) { // can the standard PDF font draw this text?
      return /^[\x0a\x20-\x7e\xa0-\xff\u2022\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2020\u2021\u2026\u2030\u2039\u203a\u20ac\u2122\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc]*$/.test(o.s);
    }
    function setProp(k, v) {
      const o = S.sel, g = curGroup(); if (!g && !(o && o.t === "img")) return;
      if (k === "size") v = clamp(v, 4, 300); if (k === "lw") v = clamp(v, 0.5, 40); if (k === "op") v = clamp(v, 0.1, 1);
      const D = g && S.D[g];
      if (k === "fillon") { const on = !!v; if (D) D.f = on ? D.fc : ""; if (o) o.f = on ? S.D.shape.fc : ""; }
      else if (k === "fc") { if (D) { D.fc = v; if (D.f) D.f = v; } if (o && o.f) o.f = v; }
      else {
        if (D && k in D) D[k] = v;
        if (o) { if (k === "w" && o.t === "img") { const ar = o.h / o.w; o.w = r1(clamp(v, 10, 3000)); o.h = r1(o.w * ar); } else o[k] = v; }
      }
      if (o) { const e = pg[o.p].els.get(o.id); if (e) paint(o, e); placeSel(); queueCommit(); }
    }
    function act(a) {
      const o = S.sel;
      if (a.startsWith("shape:")) { S.shape = a.slice(6); panel(); return; }
      if (a === "redl") { if (S.out) download(S.out.blob, S.out.name); return; }
      if (!o) return;
      if (a === "del") { endEditSilently(); S.objs = S.objs.filter((x) => x !== o); S.sel = null; sync(o.p); placeSel(); panel(); commit(); }
      else if (a === "restore") { endEditSilently(); S.objs = S.objs.filter((x) => x !== o && x.id !== o.cv); S.sel = null; sync(o.p); placeSel(); panel(); commit(); }
      else if (a === "dup") {
        const c = JSON.parse(JSON.stringify(o)); c.id = ++S.nid; delete c.cv; delete c.sig;
        if (c.x !== undefined) { c.x += 14; c.y += 14; } if (c.x1 !== undefined) { c.x1 += 14; c.x2 += 14; c.y1 += 14; c.y2 += 14; } if (c.pts) c.pts = c.pts.map(([x, y]) => [x + 14, y + 14]);
        S.objs.push(c); sync(c.p); select(c); commit();
      }
    }
    pb.addEventListener("input", (e) => {
      const t = e.target, k = t.dataset.k; if (!k) return;
      let v = t.type === "checkbox" ? t.checked : t.type === "number" || t.type === "range" ? parseFloat(t.value) : t.value;
      if (typeof v === "number" && !isFinite(v)) return;
      setProp(k, v); if (t.type === "checkbox") panel(); else if (t.type === "range") { const l = pb.querySelector('label[for="pn_op"]'); if (l) l.textContent = "Opacity " + Math.round(v * 100) + "%"; }
    });
    pb.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.act) { act(b.dataset.act); return; }
      const k = b.dataset.k; if (!k) return;
      if (b.dataset.tg !== undefined) setProp(k, b.getAttribute("aria-pressed") !== "true"); else if (b.dataset.v !== undefined) setProp(k, b.dataset.v);
      panel();
    });

    /* ---------- pages, zoom, navigation ---------- */
    const pagesTop = (q) => q.wrap.offsetTop + pgs.offsetTop;
    function curPage() {
      const mid = sc.scrollTop + sc.clientHeight * 0.4; let best = 0;
      for (let i = 0; i < pg.length; i++) { if (pagesTop(pg[i]) <= mid) best = i; else break; }
      return best;
    }
    function setCur(i) {
      S.cur = i; const inp = R("#pgn"); if (document.activeElement !== inp) inp.value = i + 1;
      R("#th").querySelectorAll(".th").forEach((b, k) => b.setAttribute("aria-current", k === i));
      const tb = R("#th").children[i]; if (tb) { const th = R("#th"), top = tb.offsetTop, bot = top + tb.offsetHeight; if (top < th.scrollTop || bot > th.scrollTop + th.clientHeight) th.scrollTop = top - 20; }
      R("#pprev").disabled = i <= 0; R("#pnext").disabled = i >= pg.length - 1;
    }
    const goPage = (i) => { if (i < 0 || i >= pg.length) return; sc.scrollTo({ top: pagesTop(pg[i]) - 16, behavior: "smooth" }); setCur(i); };
    let rafScroll = 0;
    sc.addEventListener("scroll", () => { if (rafScroll) return; rafScroll = requestAnimationFrame(() => { rafScroll = 0; if (pg.length) setCur(curPage()); }); });
    R("#pprev").onclick = () => goPage(S.cur - 1); R("#pnext").onclick = () => goPage(S.cur + 1);
    R("#pgn").onchange = (e) => goPage(clamp((parseInt(e.target.value, 10) || 1) - 1, 0, pg.length - 1));
    R("#pgn").onkeydown = (e) => { if (e.key === "Enter") e.target.blur(); };

    async function renderPg(i) {
      const q = pg[i]; if (q.busy) { q.again = true; return; }
      q.busy = true;
      try {
        do {
          q.again = false; const z = S.z;
          const sc2 = Math.min(z * dpr, 5000 / Math.max(q.w, q.h), Math.sqrt(16e6 / (q.w * q.h)));
          const vp = q.page.getViewport({ scale: sc2 }), c = mk("canvas", "pcv");
          c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
          await q.page.render({ canvasContext: c.getContext("2d"), viewport: vp, background: "#ffffff" }).promise;
          if (!q.vis) { q.rz = 0; continue; }
          q.cv.replaceWith(c); q.cv = c; q.rz = z;
        } while (q.again);
      } catch { /* page left or render cancelled */ }
      q.busy = false;
    }
    const obs = new IntersectionObserver((ents) => {
      for (const en of ents) {
        const i = +en.target.dataset.p, q = pg[i]; q.vis = en.isIntersecting;
        if (q.vis) { renderPg(i); loadRuns(i); } else if (q.cv.width > 1) { q.cv.width = q.cv.height = 1; q.rz = 0; }
      }
    }, { root: sc, rootMargin: "700px 0px" });
    const thObs = new IntersectionObserver((ents) => {
      for (const en of ents) if (en.isIntersecting && !en.target._done) { en.target._done = true; thumb(+en.target.dataset.p, en.target); thObs.unobserve(en.target); }
    }, { root: R("#th"), rootMargin: "300px 0px" });
    async function thumb(i, btn) {
      try {
        const q = pg[i], k = 120 / q.w, vp = q.page.getViewport({ scale: k * dpr }), c = btn.querySelector("canvas");
        c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); c.style.width = Math.round(q.w * k) + "px"; c.style.height = Math.round(q.h * k) + "px";
        await q.page.render({ canvasContext: c.getContext("2d"), viewport: vp, background: "#ffffff" }).promise;
      } catch { /* ignore */ }
    }
    function layoutPages() {
      root.style.setProperty("--iz", 1 / S.z);
      pg.forEach((q) => { q.wrap.style.width = q.w * S.z + "px"; q.wrap.style.height = q.h * S.z + "px"; q.layer.style.transform = `scale(${S.z})`; });
      R("#zv").value = Math.round(S.z * 100) + "%";
    }
    let zt = 0;
    function setZoom(z, keep = true) {
      z = clamp(z, 0.1, 5); if (Math.abs(z - S.z) < 0.001) return;
      const fy = (sc.scrollTop + sc.clientHeight / 2) / Math.max(1, sc.scrollHeight), fx = (sc.scrollLeft + sc.clientWidth / 2) / Math.max(1, sc.scrollWidth);
      S.z = z; layoutPages();
      if (keep) { sc.scrollTop = fy * sc.scrollHeight - sc.clientHeight / 2; sc.scrollLeft = fx * sc.scrollWidth - sc.clientWidth / 2; }
      placeSel(); clearTimeout(zt); zt = setTimeout(() => pg.forEach((q, i) => { if (q.vis) renderPg(i); }), 160);
    }
    const fitWidth = () => (sc.clientWidth - 48) / Math.max(...pg.map((q) => q.w));
    const fitPage = () => { const q = pg[S.cur]; return Math.min((sc.clientWidth - 48) / q.w, (sc.clientHeight - 48) / q.h); };
    R("#zin").onclick = () => setZoom(S.z * 1.2); R("#zout").onclick = () => setZoom(S.z / 1.2);
    R("#fitw").onclick = () => setZoom(fitWidth()); R("#fith").onclick = () => { setZoom(fitPage()); goPage(S.cur); };
    R("#zv").onchange = (e) => { const n = parseFloat(String(e.target.value).replace("%", "")); if (n > 0) setZoom(n / 100); else R("#zv").value = Math.round(S.z * 100) + "%"; };
    R("#zv").onkeydown = (e) => { if (e.key === "Enter") e.target.blur(); };
    sc.addEventListener("wheel", (e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(S.z * (e.deltaY < 0 ? 1.1 : 1 / 1.1)); } }, { passive: false });
    R("#fold").onclick = () => { R("#body").classList.toggle("noth"); R("#fold").innerHTML = ic(R("#body").classList.contains("noth") ? "chevr" : "chevl", 12); };

    /* ---------- save (export) ---------- */
    function download(blob, name) {
      const u = URL.createObjectURL(blob), a = mk("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000);
    }
    const hexRgb = (h) => L.rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
    async function rasterText(o) { // fallback for characters the standard fonts cannot draw (e.g. Hindi): draw with the browser's fonts, embed as a PNG
      const k = 4, lines = o.s.split("\n"), c = mk("canvas"), x = c.getContext("2d");
      const font = `${o.italic ? "italic " : ""}${o.bold ? "700 " : ""}${o.size * k}px ${FF[o.font]}`; x.font = font;
      const ws = lines.map((l) => x.measureText(l).width), W = Math.max(...ws, 1);
      c.width = Math.ceil(W + 4 * k); c.height = Math.ceil(lines.length * o.size * LH * k + 2 * k); x.font = font; x.fillStyle = o.c; x.textBaseline = "alphabetic";
      lines.forEach((l, n) => {
        const off = o.align === "center" ? (W - ws[n]) / 2 : o.align === "right" ? W - ws[n] : 0, y = (BASE + n * LH) * o.size * k;
        x.fillText(l, 2 * k + off, y);
        if (o.ul) { x.fillRect(2 * k + off, y + 0.12 * o.size * k, ws[n], Math.max(k, o.size * 0.06 * k)); }
      });
      return { bytes: new Uint8Array(await (await new Promise((r) => c.toBlob(r, "image/png"))).arrayBuffer()), w: c.width / k, h: c.height / k, dx: -2 };
    }
    async function save() {
      endEdit(); if (S.qt) commit();
      if (!hasChanges()) return;
      const btn = R("#save"); btn.disabled = true; msg("note", "Saving your PDF…");
      try {
        const doc = await L.PDFDocument.load(pdf.buf), pages = doc.getPages(), fonts = new Map(), imgCache = new Map();
        const getFont = async (o) => { const nm = PDF_FONTS[o.font][o.bold && o.italic ? 3 : o.bold ? 1 : o.italic ? 2 : 0]; if (!fonts.has(nm)) fonts.set(nm, await doc.embedFont(L.StandardFonts[nm])); return fonts.get(nm); };
        const skip = new Set(); S.objs.forEach((o) => { if (o.t === "text" && o.sig && sigOf(o) === o.sig) { skip.add(o.id); skip.add(o.cv); } });
        const strokePath = (page, subs, col, lw) => {
          const ops = [L.pushGraphicsState(), L.setStrokingColor(col), L.setLineWidth(lw), L.setLineCap(L.LineCapStyle.Round), L.setLineJoin(L.LineJoinStyle.Round)];
          for (const s of subs) s.forEach(([x, y], n) => ops.push(n ? L.lineTo(x, y) : L.moveTo(x, y)));
          ops.push(L.stroke(), L.popGraphicsState()); page.pushOperators(...ops);
        };
        for (const o of S.objs) {
          if (skip.has(o.id)) continue;
          const q = pg[o.p], page = pages[o.p], vp = q.vp, P = (x, y) => vp.convertToPdfPoint(x, y), rot = L.degrees(vp.rotation || 0);
          if (o.t === "cov") { const [x, y] = P(o.x, o.y + o.h); page.drawRectangle({ x, y, width: o.w, height: o.h, color: hexRgb(o.c), borderWidth: 0, rotate: rot }); }
          else if (o.t === "text") {
            if (!o.s.trim()) continue;
            const font = await getFont(o); let ok = canEncode(o);
            if (ok) { try { o.s.split("\n").forEach((l) => font.encodeText(l)); } catch { ok = false; } }
            if (ok) {
              const lines = o.s.split("\n"), ws = lines.map((l) => font.widthOfTextAtSize(l, o.size)), W = Math.max(...ws), col = hexRgb(o.c);
              lines.forEach((l, n) => {
                const off = o.align === "center" ? (W - ws[n]) / 2 : o.align === "right" ? W - ws[n] : 0, bx = o.x + off, by = o.y + (BASE + n * LH) * o.size;
                if (l) { const [x, y] = P(bx, by); page.drawText(l, { x, y, size: o.size, font, color: col, rotate: rot }); }
                if (l && o.ul) { const a = P(bx, by + 0.12 * o.size), b = P(bx + ws[n], by + 0.12 * o.size); page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: Math.max(0.5, o.size * 0.06), color: col }); }
              });
            } else {
              const rt = await rasterText(o), im = await doc.embedPng(rt.bytes), [x, y] = P(o.x + rt.dx, o.y + rt.h); page.drawImage(im, { x, y, width: rt.w, height: rt.h, rotate: rot });
            }
          } else if (o.t === "img") {
            const rec = S.imgs.get(o.key); let im = imgCache.get(o.key);
            if (!im) { im = rec.type === "jpg" ? await doc.embedJpg(rec.bytes) : await doc.embedPng(rec.bytes); imgCache.set(o.key, im); }
            const [x, y] = P(o.x, o.y + o.h); page.drawImage(im, { x, y, width: o.w, height: o.h, rotate: rot });
          } else if (o.t === "hl") { const [x, y] = P(o.x, o.y + o.h); page.drawRectangle({ x, y, width: o.w, height: o.h, color: hexRgb(o.c), opacity: 0.35, borderWidth: 0, rotate: rot }); }
          else if (o.t === "rect") { const [x, y] = P(o.x, o.y + o.h); page.drawRectangle({ x, y, width: o.w, height: o.h, borderColor: hexRgb(o.c), borderWidth: o.lw, borderOpacity: o.op, ...(o.f ? { color: hexRgb(o.f), opacity: o.op } : {}), rotate: rot }); }
          else if (o.t === "ell") { const [x, y] = P(o.x + o.w / 2, o.y + o.h / 2); page.drawEllipse({ x, y, xScale: o.w / 2, yScale: o.h / 2, borderColor: hexRgb(o.c), borderWidth: o.lw, borderOpacity: o.op, ...(o.f ? { color: hexRgb(o.f), opacity: o.op } : {}), rotate: rot }); }
          else if (o.t === "pen") strokePath(page, [o.pts.map(([x, y]) => P(x, y))], hexRgb(o.c), o.lw);
          else if (o.t === "line" || o.t === "arrow") {
            const subs = [[P(o.x1, o.y1), P(o.x2, o.y2)]];
            if (o.t === "arrow") {
              const a = Math.atan2(o.y2 - o.y1, o.x2 - o.x1), hl = Math.max(9, o.lw * 4.5);
              subs.push([P(o.x2 - hl * Math.cos(a - 0.45), o.y2 - hl * Math.sin(a - 0.45)), P(o.x2, o.y2), P(o.x2 - hl * Math.cos(a + 0.45), o.y2 - hl * Math.sin(a + 0.45))]);
            }
            strokePath(page, subs, hexRgb(o.c), o.lw);
          }
        }
        const blob = new Blob([await doc.save()], { type: "application/pdf" }), name = base(pdf.name) + "-edited.pdf";
        S.out = { blob, name }; S.saved = S.hist[S.hi]; download(blob, name);
        msg("ok", `Saved! <b>${esc(name)}</b> (${fmtSize(blob.size)}) was downloaded. <button class="lnk" data-act="redl">Download again</button>`);
      } catch (e) { msg("err", "Could not save: " + esc(e.message || "unknown error")); }
      refreshUI();
    }
    R("#save").onclick = save;
    R("#pn-status").addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b) act(b.dataset.act); });
    R("#again").onclick = () => { if (dirty() && !confirm("You have unsaved changes. Upload another PDF and lose them?")) return; cleanup(); T.ui(T); };

    /* ---------- keyboard + lifecycle ---------- */
    const onKey = (e) => {
      const tg = e.target, typing = tg.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(tg.tagName);
      if (e.key === "Escape") { if (S.editing != null) endEdit(); else if (S.sel) select(null); else if (S.tool !== "select") setTool("select"); return; }
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); }
      else if (S.sel && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); act("del"); }
      else if (S.sel && e.key.startsWith("Arrow")) {
        e.preventDefault(); const d = e.shiftKey ? 10 : 1, o = S.sel, b = JSON.parse(JSON.stringify(o));
        applyMove(o, b, e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0, e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0);
        paint(o, pg[o.p].els.get(o.id)); placeSel(); queueCommit();
      }
    };
    const onBefore = (e) => { if (dirty()) { e.preventDefault(); e.returnValue = ""; } };
    const onResize = () => setHH();
    document.addEventListener("keydown", onKey); addEventListener("beforeunload", onBefore); addEventListener("resize", onResize);
    cleanupFn = () => {
      document.removeEventListener("keydown", onKey); removeEventListener("beforeunload", onBefore); removeEventListener("resize", onResize);
      obs.disconnect(); thObs.disconnect(); clearTimeout(S.qt); clearTimeout(zt);
      S.imgs.forEach((r) => URL.revokeObjectURL(r.url)); try { pdf.js.cleanup(); } catch { /* ignore */ }
    };

    /* ---------- build pages ---------- */
    (async () => {
      try {
        for (let i = 0; i < pdf.n; i++) {
          const page = await pdf.js.getPage(i + 1), vp = page.getViewport({ scale: 1 });
          const wrap = mk("div", "pw"); wrap.dataset.p = i; wrap.setAttribute("aria-label", "Page " + (i + 1));
          const cv = mk("canvas", "pcv"), layer = mk("div", "ly"), runsEl = mk("div", "runs");
          layer.style.width = vp.width + "px"; layer.style.height = vp.height + "px"; layer.appendChild(runsEl);
          wrap.append(cv, layer);
          const q = { w: vp.width, h: vp.height, vp, page, wrap, cv, layer, runsEl, els: new Map(), sel: null, runs: null, vis: false, rz: 0 };
          pg.push(q);
          layer.addEventListener("pointerdown", (e) => onDown(e, i));
          layer.addEventListener("mousedown", (e) => { if (!e.target.closest(".tx.editing")) e.preventDefault(); });
          layer.addEventListener("input", (e) => { const o = S.editing != null && objById(S.editing); if (o && e.target.classList.contains("tx")) { o.s = readText(e.target); placeSel(); queueCommit(); if (S.sel === o) { if (!!pb.querySelector(".unsup") !== !canEncode(o)) panel(); } } });
          layer.addEventListener("focusout", (e) => { if (e.target.classList && e.target.classList.contains("tx") && S.editing != null) setTimeout(() => { if (S.editing != null && document.activeElement !== pg[objById(S.editing)?.p]?.els.get(S.editing)) endEdit(); }, 0); });
          layer.addEventListener("dblclick", (e) => { const de = e.target.closest(".tx"); if (de && S.tool === "select") { const o = objById(+de.dataset.id); if (o) startEdit(o); } });
          if (i === 0) { pgs.innerHTML = ""; S.z = clamp(Math.min(1.25, (sc.clientWidth - 48) / vp.width), 0.3, 1.25); }
          pgs.appendChild(wrap);
          const th = mk("button", "th"); th.dataset.p = i; th.setAttribute("aria-label", "Go to page " + (i + 1));
          th.innerHTML = `<canvas width="120" height="${Math.round((120 * vp.height) / vp.width)}" style="width:120px;height:${Math.round((120 * vp.height) / vp.width)}px"></canvas>${i + 1}`;
          th.onclick = () => goPage(i); R("#th").appendChild(th); thObs.observe(th);
          if (i === 0) layoutPages(); else { q.wrap.style.width = q.w * S.z + "px"; q.wrap.style.height = q.h * S.z + "px"; q.layer.style.transform = `scale(${S.z})`; }
          obs.observe(wrap);
        }
        setCur(0); drawTools(); panel(); refreshUI(); msg("", "");
      } catch (e) { pgs.innerHTML = `<div class="msg err">Could not display this PDF: ${esc(e.message || "unknown error")}</div>`; }
    })();
    setTool("select");
  }
  route();
})();
