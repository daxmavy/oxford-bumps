/* The bump board — Oxford Summer Eights 2026.
   Loads static JSON, draws with Observable Plot (window.Plot). The next-day
   head-to-head board is the hero; each crew chases the boat directly ahead; tap to
   expand its factor attribution. Compact "why" panels + a college lookup beneath.
   Defensive: a missing slice leaves its block empty, never throws. */
const P = window.Plot;
const C = { up: "#1a7f57", down: "#c0392b", row: "#b8b0a0", oxford: "#002147",
            oxford2: "#1b3a63", gold: "#b8893b", grey: "#9a9182", line: "#e3dccf", paper2: "#f3eee5" };
const pct = x => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
const ord = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const Wof = el => Math.min((el && el.clientWidth) || 680, 980);
const GK = { m: "men", w: "women" };

async function load(f) { const r = await fetch("data/" + f); if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }
function draw(id, fn) {
  const el = document.getElementById(id); if (!el) return;
  try { el.innerHTML = ""; el.append(fn(Wof(el))); } catch (e) { console.error("draw " + id, e); }
}

let HL = "";
let _preds = null, _gender = "men";
function applyHighlight() {
  document.querySelectorAll(".crew").forEach(c => {
    c.classList.remove("hl", "dim");
    if (HL) c.classList.add(c.dataset.college === HL ? "hl" : "dim");
  });
  drawSkill();
}

/* === skill ladder: each crew's estimated pace ± the model's uncertainty === */
function drawSkill() {
  if (!_preds) return;
  const rows = (_preds[_gender] || []).filter(r => isFinite(r.skill_mu));
  if (!rows.length) return;
  const mean = rows.reduce((s, r) => s + r.skill_mu, 0) / rows.length;
  const data = rows.map(r => ({
    label: r.college + (r.boat > 1 ? " " + r.boat : ""), college: r.college, pos: r.current_pos,
    x: r.skill_mu - mean, lo: r.skill_mu - mean - r.skill_sd, hi: r.skill_mu - mean + r.skill_sd,
  })).sort((a, b) => b.x - a.x);
  const col = d => HL ? (d.college === HL ? C.gold : "#cfc8ba") : C.oxford;
  const op = d => (HL && d.college !== HL) ? 0.4 : 1;
  draw("chart-skill", w => P.plot({
    width: w, height: 34 + data.length * 10.5, marginLeft: 150, marginRight: 24, marginTop: 8, marginBottom: 30,
    style: { fontSize: "9px" },
    x: { label: "← slower            faster →", grid: true },
    y: { domain: data.map(d => d.label), label: null, tickSize: 0 },
    marks: [
      P.ruleX([0], { stroke: "#000", strokeOpacity: .35, strokeDasharray: "3 3" }),
      P.ruleY(data, { y: "label", x1: "lo", x2: "hi", stroke: col, strokeOpacity: d => op(d) * 0.6, strokeWidth: 2 }),
      P.dot(data, { y: "label", x: "x", fill: col, fillOpacity: op, r: 3,
        channels: { position: "pos" }, tip: { format: { x: d => d.toFixed(2), y: true, position: true } } }),
    ],
  }));
}

function byDivision(rows) {
  const b = new Map();
  for (const r of rows) { const d = r._div ?? r.division ?? null; if (!b.has(d)) b.set(d, []); b.get(d).push(r); }
  return [...b.keys()].sort((a, x) => (a ?? 99) - (x ?? 99))
    .map(d => ({ div: d, rows: b.get(d).sort((a, x) => (a.cur_pos ?? 0) - (x.cur_pos ?? 0)) }));
}

/* === the head-to-head board === */
function makeBoard(h2h, preds, gender) {
  const h2hRows = h2h[gender] || [], predRows = preds[gender] || [];
  const pkey = r => r.college + "|" + (r.boat || 1);
  const pmap = new Map(predRows.map(r => [pkey(r), r]));
  const board = document.getElementById("board"); if (!board) return;
  board.innerHTML = "";
  for (const r of h2hRows) if (r.division == null) { const p = pmap.get(pkey(r)); r._div = (p && p.division) ?? null; }
  for (const g of byDivision(h2hRows)) {
    const head = document.createElement("div"); head.className = "divhead"; head.textContent = "Division " + (g.div ?? "?");
    board.append(head);
    for (const r of g.rows) {
      const p = pmap.get(pkey(r)) || {};
      const up = r.p_bump ?? p.p_bump_up ?? 0, caught = r.p_caught ?? p.p_bumped ?? 0, hold = r.p_rowover ?? p.p_row_over, onBlades = p.on_for_blades;
      const card = document.createElement("div"); card.className = "crew"; card.tabIndex = 0;
      card.dataset.college = r.college;
      const chase = r.chasing ? `chasing <strong>${r.chasing}</strong>` : `<span class="head-mark">Head of the River — cannot bump up</span>`;
      const chip = onBlades ? `<span class="chip" title="bumped every day so far">on for blades</span>` : "";
      card.innerHTML = `
        <div class="crew-row">
          <div class="pos">${r.cur_pos ?? p.current_pos ?? ""}</div>
          <div class="who"><span class="name">${r.college}${(r.boat > 1) ? " " + r.boat : ""}</span> ${chip}<span class="chase">${chase}</span></div>
          <div class="pn dn-n" title="${pct(caught)} chance of being caught">${caught ? pct(caught) : ""}</div>
          <div class="dbar" title="caught ${pct(caught)} · bump ${pct(up)}">
            <span class="dn" style="width:${Math.round((caught || 0) * 50)}%"></span>
            <span class="up" style="width:${Math.round((up || 0) * 50)}%"></span>
            <span class="mid"></span>
          </div>
          <div class="pn up-n" title="${pct(up)} chance of bumping up">${up ? pct(up) : ""}</div>
          <div class="caret" aria-hidden="true">›</div>
        </div><div class="detail" hidden></div>`;
      const detail = card.querySelector(".detail");
      const fill = () => {
        if (detail.dataset.built === "1") return; detail.dataset.built = "1";
        detail.innerHTML = renderDetail(r, { up, hold, caught, onBlades, p });
        const slot = detail.querySelector(".wf");
        if (slot && Array.isArray(r.contributions) && r.contributions.length) {
          const cid = "wf-" + gender + "-" + (r.cur_pos ?? Math.random().toString(36).slice(2)); slot.id = cid;
          draw(cid, w => waterfall(r.contributions, w));
        }
      };
      const toggle = () => {
        const open = card.classList.contains("open");
        if (open) { detail.hidden = true; card.classList.remove("open"); } else { fill(); detail.hidden = false; card.classList.add("open"); }
      };
      card.querySelector(".crew-row").addEventListener("click", toggle);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });
      board.append(card);
    }
  }
}
function renderDetail(r, o) {
  const split = (r.chasing == null)
    ? `<p class="dsplit">As Head of the River this boat can only hold its place or be caught — there's nothing ahead to chase.</p>`
    : `<div class="splitbars">${splitBar("Bumps up", o.up, C.up)}${splitBar("Rows over", o.hold, C.row)}${splitBar("Gets caught", o.caught, C.down)}</div>`;
  const blades = o.onBlades ? `<p class="dblade">Bumped on every day so far. Chance of completing all four for blades: <strong>${pct(o.p.p_complete_blades)}</strong>.</p>` : "";
  const attr = (r.chasing == null)
    ? ""
    : (Array.isArray(r.contributions) && r.contributions.filter(d => isFinite(d.logodds)).length)
      ? `<div class="attr"><div class="attr-h">Why the model leans this way <span class="vs">vs ${r.chasing}</span></div><div class="wf"></div><p class="attr-note">Each bar is one factor's push on the odds of bumping the boat ahead. Right (green) raises the chance; left (red) lowers it.</p></div>`
      : `<p class="attr-note">Nothing much separates these two on form — close to a coin toss.</p>`;
  return split + blades + attr;
}
function splitBar(label, v, col) {
  if (v == null || isNaN(v)) return "";
  return `<div class="sb"><div class="sb-l">${label}</div><div class="bar"><span style="width:${Math.round(v * 100)}%;background:${col}"></span></div><div class="sb-n">${pct(v)}</div></div>`;
}
function waterfall(contribs, w) {
  const data = contribs.filter(d => isFinite(d.logodds)).sort((a, b) => Math.abs(b.logodds) - Math.abs(a.logodds));
  if (!data.length) return document.createTextNode("");
  const m = Math.max(0.5, ...data.map(d => Math.abs(d.logodds))) * 1.15, h = 26 * data.length + 34;
  return P.plot({
    width: w, height: h, marginLeft: 168, marginRight: 44, marginTop: 6, marginBottom: 26,
    x: { domain: [-m, m], label: "← less likely     more likely →", grid: true, ticks: 5 },
    y: { domain: data.map(d => d.factor), label: null },
    marks: [
      P.ruleX([0], { stroke: "#000", strokeOpacity: .45 }),
      P.barX(data, { y: "factor", x: "logodds", fill: d => d.logodds >= 0 ? C.up : C.down, rx: 2 }),
      P.text(data.filter(d => d.logodds >= 0), { y: "factor", x: "logodds", text: d => "+" + d.logodds.toFixed(2), dx: 6, textAnchor: "start", fontSize: 11, fill: "#444", fontWeight: 600 }),
      P.text(data.filter(d => d.logodds < 0), { y: "factor", x: "logodds", text: d => d.logodds.toFixed(2), dx: -6, textAnchor: "end", fontSize: 11, fill: "#444", fontWeight: 600 }),
    ],
  });
}

/* === why panels === */
function drawFactors(rf) {
  const map = (rf.head_to_head || {}).factors_or_per_sd || {};
  const labels = { form_so_far_this_week: "Form so far this week", torpids_form: "Torpids form (same squad)",
    squad_continuity: "Squad continuity", last_year_form: "Last year's form", blues_in_boat: "Blues in the boat", target_own_pace_recession: "Target's own pace" };
  const data = Object.entries(map).filter(([, v]) => isFinite(v)).map(([k, v]) => ({ factor: labels[k] || k, or: v, lift: v >= 1 })).sort((a, b) => a.or - b.or);
  if (!data.length) return;
  draw("chart-factors", w => P.plot({
    width: w, height: 250, marginLeft: 176, marginRight: 52, marginBottom: 42,
    x: { label: "Odds of bumping, × per standard deviation →", grid: true, domain: [0.7, 3.6] },
    y: { label: null, domain: data.map(d => d.factor) },
    marks: [
      P.ruleX([1], { stroke: "#000", strokeDasharray: "3 3", strokeOpacity: .5 }),
      P.barX(data, { y: "factor", x1: 1, x2: "or", fill: d => d.lift ? C.oxford : C.down, rx: 2 }),
      P.text(data.filter(d => d.lift), { y: "factor", x: "or", text: d => "×" + d.or.toFixed(2), dx: 7, textAnchor: "start", fontSize: 12, fontWeight: 600, fill: "#444" }),
      P.text(data.filter(d => !d.lift), { y: "factor", x: "or", text: d => "×" + d.or.toFixed(2), dx: -7, textAnchor: "end", fontSize: 12, fontWeight: 600, fill: "#444" }),
    ],
  }));
}
function drawPerDay(extras) {
  const per = (extras.per_day || []).filter(d => isFinite(d.auc_bump));
  if (!per.length) return;
  const DAY = { 1: "Wed", 2: "Thu", 3: "Fri", 4: "Sat" };
  draw("chart-perday", w => P.plot({
    width: w, height: 260, marginLeft: 52, marginBottom: 44,
    x: { label: "Day of racing →", domain: [1, 2, 3, 4], tickFormat: v => DAY[v] || v },
    y: { label: "How predictable (AUC)", grid: true, domain: [0.5, 0.9] },
    marks: [
      P.ruleY([0.5], { stroke: C.row, strokeDasharray: "3 3" }),
      P.text([{}], { x: 1, y: 0.5, text: ["coin toss"], dy: -8, dx: 4, fill: C.row, fontSize: 11, textAnchor: "start" }),
      P.line(per, { x: "day", y: "auc_bump", stroke: C.oxford, strokeWidth: 2.4, curve: "monotone-x" }),
      P.dot(per, { x: "day", y: "auc_bump", fill: C.oxford, r: 5 }),
      P.text(per, { x: "day", y: "auc_bump", text: d => d.auc_bump.toFixed(2), dy: -13, fontSize: 12, fontWeight: 600 }),
    ],
  }));
}
function drawLuck(rf) {
  const ls = rf.luck_skill; if (!ls) return;
  const data = [{ k: "Equal crews", v: ls.blades_rate_pure_luck_floor, c: C.row },
                { k: "Reality", v: ls.blades_rate_observed, c: C.gold }].filter(d => isFinite(d.v));
  draw("chart-luck", w => P.plot({
    width: w, height: 250, marginLeft: 48, marginBottom: 34, marginRight: 20,
    x: { label: null, domain: data.map(d => d.k) },
    y: { label: null, grid: true, tickFormat: d => Math.round(d * 100) + "%", domain: [0, Math.max(0.11, ls.blades_rate_observed * 1.3)] },
    marks: [
      P.barY(data, { x: "k", y: "v", fill: "c", rx: 2 }),
      P.text(data, { x: "k", y: "v", text: d => d.v < 0.01 ? (d.v * 100).toFixed(1) + "%" : Math.round(d.v * 100) + "%", dy: -10, fontSize: 15, fontWeight: 700 }),
      P.ruleY([0]),
    ],
  }));
}

/* === college lookup === */
function renderLookup(colleges, h2h, preds, college, g) {
  const box = document.getElementById("lookup-result"); if (!box) return;
  const rec = (colleges[college] || {})[g];
  if (!rec) { box.innerHTML = `<p class="small">No ${g === "m" ? "men's" : "women's"} first-eight record for ${college}.</p>`; return; }
  const hist = rec.history.filter(h => h.year >= 1900);
  const gk = GK[g];
  const h = (h2h[gk] || []).find(r => r.college === college && r.boat === 1);
  const pr = (preds[gk] || []).find(r => r.college === college && r.boat === 1);
  let status = "";
  if (h || pr) {
    const cp = (h && h.cur_pos) ?? (pr && pr.current_pos);
    const bump = h ? h.p_bump : (pr && pr.p_bump_up);
    status = `<p class="statusline">This week they sit <strong>${cp ? ord(cp) : "—"}</strong> on the river`
      + (pr && pr.on_for_blades ? `, still on for blades (<strong>${pct(pr.p_complete_blades)}</strong> to finish the set)` : "")
      + (h && h.chasing ? `. Next day: <strong>${pct(bump)}</strong> to bump ${h.chasing}.` : ".") + `</p>`;
  }
  box.innerHTML = `<div class="recordline">
      <div class="rec"><div class="n">${rec.headships}</div><div class="l">years Head of the River</div></div>
      <div class="rec"><div class="n">${rec.blades}</div><div class="l">sets of blades</div></div>
      <div class="rec"><div class="n">${rec.spoons}</div><div class="l">sets of spoons</div></div>
      <div class="rec"><div class="n">${rec.first_year}</div><div class="l">first on record</div></div>
    </div>${status}<div id="lookup-chart" class="chart"></div>`;
  draw("lookup-chart", w => P.plot({
    width: w, height: 320, marginLeft: 44, marginBottom: 38,
    x: { label: null, tickFormat: "d" },
    y: { label: "Position on the river (1 = Head) ↑", reverse: true, grid: true },
    marks: [
      P.line(hist, { x: "year", y: "finish", stroke: C.oxford, strokeWidth: 1.8, curve: "monotone-x" }),
      P.dot(hist.filter(h => h.blades), { x: "year", y: "finish", fill: C.gold, r: 4 }),
      P.dot(hist.filter(h => h.spoons), { x: "year", y: "finish", fill: C.down, r: 4 }),
      P.dot(hist, { x: "year", y: "finish", r: 2, fill: C.oxford, fillOpacity: .35,
        channels: { year: "year", position: "finish" }, tip: { format: { x: false, y: false, year: d => d, position: true } } }),
    ],
  }));
}

(async function () {
  let preds, h2h, extras, rf, colleges;
  try { [preds, h2h, extras, rf, colleges] = await Promise.all([
    load("predictions.json"), load("headtohead_2026.json"), load("extras.json"),
    load("reconciled_findings.json"), load("colleges.json")]); }
  catch (e) { console.error("data load failed", e); return; }

  const dl = preds.day_label || h2h.day_label || "the next day";
  const setTxt = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.textContent = v; };
  setTxt("day-label", dl); setTxt("day-label-2", dl.toLowerCase());
  const meta = document.getElementById("model-meta");
  const d4 = ((rf.skill_model || {}).oos_auc_by_day || {})["4"] ?? (rf.head_to_head || {}).oos_auc;
  if (meta) meta.innerHTML = `Bayesian skill model + race simulator · by the final day it calls the bumping crew right <strong>${d4 ? "better than five times in six" : "—"}</strong> · ${(preds.men || []).length} men's & ${(preds.women || []).length} women's crews · after day ${preds.as_of_day}`;

  let gender = "men";
  const tabs = document.querySelectorAll(".tab");
  const renderBlades = () => {
    const el = document.getElementById("blades-strip"); if (!el) return;
    const rows = (preds[gender] || []).filter(r => r.on_for_blades).sort((a, b) => (b.p_complete_blades || 0) - (a.p_complete_blades || 0));
    el.innerHTML = rows.length ? rows.map(r => `<span class="bw"><span class="bw-c">${r.college}${r.boat > 1 ? " " + r.boat : ""}</span> <span class="bw-p">${pct(r.p_complete_blades)}</span></span>`).join("") : `<span class="small">No crews still on for blades.</span>`;
  };
  const renderFieldSummary = () => {
    const el = document.getElementById("field-summary"); if (!el) return;
    const pmap = new Map((preds[gender] || []).map(r => [r.college + "|" + (r.boat || 1), r]));
    let fav = 0, vul = 0, close = 0, n = 0;
    for (const r of (h2h[gender] || [])) {
      const p = pmap.get(r.college + "|" + (r.boat || 1)) || {};
      const up = r.p_bump ?? p.p_bump_up ?? 0, dn = r.p_caught ?? p.p_bumped ?? 0;
      n++; if (up >= 0.6) fav++; else if (dn >= 0.6) vul++; else close++;
    }
    if (!n) { el.innerHTML = ""; return; }
    const gl = gender === "men" ? "men's" : "women's";
    el.innerHTML = `<div class="fs-text">Today's ${gl} field: <strong>${fav}</strong> better than 2-in-3 to bump, <strong>${vul}</strong> likely to be caught — and <strong>${close}</strong> too close to call.</div>
      <div class="fsbar" title="favourites / too close to call / likely caught">
        <span style="width:${fav/n*100}%;background:${C.up}"></span>
        <span style="width:${close/n*100}%;background:${C.row}"></span>
        <span style="width:${vul/n*100}%;background:${C.down}"></span></div>`;
  };
  _preds = preds;
  const render = () => { _gender = gender; makeBoard(h2h, preds, gender); renderFieldSummary(); renderBlades(); applyHighlight(); };
  tabs.forEach(t => t.addEventListener("click", () => { tabs.forEach(x => x.classList.toggle("active", x === t)); gender = t.dataset.g; render(); }));
  render();

  drawFactors(rf); drawPerDay(extras); drawLuck(rf);
  if (rf.luck_skill) { setTxt("l-excess", rf.luck_skill.excess_ratio + "×"); setTxt("l-repeat", Math.round(rf.luck_skill.blades_share_didnt_blade_prior_year * 100) + "%"); }

  const hl = document.getElementById("college-hl");
  if (hl) {
    const colls = [...new Set([...(preds.men || []), ...(preds.women || [])].map(r => r.college))].sort();
    colls.forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; hl.append(o); });
    hl.onchange = () => { HL = hl.value; applyHighlight(); };
  }
  setTxt("footer-updated", `Predictions generated after day ${preds.as_of_day} of the 2026 races.`);
})();
