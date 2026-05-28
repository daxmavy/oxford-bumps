/* Predictions-dashboard prototype — Oxford Summer Eights 2026.
   Self-contained: loads ../data/*.json, draws with Observable Plot (window.Plot).
   Concept: the next-day head-to-head bump board IS the page opener; each crew is
   shown chasing the boat directly ahead, click to expand its factor attribution.
   Analytical "why" panels sit beneath as compact explainers.
   Defensive throughout: a missing slice leaves its block empty, never throws. */
const P = window.Plot;

const C = {
  up: "#1a7f57", down: "#c0392b", row: "#b8b0a0",
  oxford: "#002147", oxford2: "#1b3a63", gold: "#b8893b",
  grey: "#9a9182", line: "#e3dccf", paper2: "#f3eee5",
};
const pct = x => (x == null ? "—" : Math.round(x * 100) + "%");
const ord = n => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
const Wof = el => Math.min((el && el.clientWidth) || 680, 980);

async function load(f) { const r = await fetch("../data/" + f); if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }
function draw(id, fn) {
  const el = document.getElementById(id); if (!el) return;
  try { el.innerHTML = ""; el.append(fn(Wof(el))); }
  catch (e) { console.error("draw " + id, e); }
}

/* Group crews into clean division blocks. Division labels in the data oscillate by
   a place or two at the boundaries (sandwich boats), so we bucket by division number
   and render in ascending order, each crew sorted by its position within the block —
   one header per division, no spurious repeats. */
function byDivision(rows) {
  const buckets = new Map();
  for (const r of rows) {
    const d = r._div ?? r.division ?? r.div ?? null;
    if (!buckets.has(d)) buckets.set(d, []);
    buckets.get(d).push(r);
  }
  const order = [...buckets.keys()].sort((a, b) => (a ?? 99) - (b ?? 99));
  return order.map(d => ({
    div: d,
    rows: buckets.get(d).sort((a, b) => (a.cur_pos ?? 0) - (b.cur_pos ?? 0)),
  }));
}

/* === the head-to-head predictions board (the hero) === */
function makeBoard(h2h, preds, gender) {
  const h2hRows = h2h[gender] || [];
  const predRows = preds[gender] || [];
  // index predictions by college+boat so the board can show row-over / caught too
  const pkey = r => (r.college + "|" + (r.boat || 1));
  const pmap = new Map(predRows.map(r => [pkey(r), r]));
  const factorsMap = h2h.factors || {};

  const board = document.getElementById("board");
  if (!board) return;
  board.innerHTML = "";

  // backfill division for any crew missing it (e.g. the Head boat) from its prediction
  for (const r of h2hRows) {
    if (r.division == null) { const p = pmap.get(pkey(r)); r._div = (p && p.division) ?? null; }
  }

  const groups = byDivision(h2hRows);
  for (const g of groups) {
    const head = document.createElement("div");
    head.className = "divhead";
    head.innerHTML = `Division ${g.div ?? "?"}`;
    board.append(head);

    for (const r of g.rows) {
      const p = pmap.get(pkey(r)) || {};
      const up = r.p_bump ?? p.p_bump_up ?? 0;
      const caught = p.p_bumped;
      const hold = p.p_row_over;
      const onBlades = p.on_for_blades;

      const card = document.createElement("div");
      card.className = "crew";
      card.tabIndex = 0;
      card.dataset.expanded = "0";

      const chase = r.chasing
        ? `chasing <strong>${r.chasing}</strong>`
        : `<span class="head-mark">Head of the River — cannot bump up</span>`;
      const bladesChip = onBlades ? `<span class="chip" title="bumped every day so far">on for blades</span>` : "";

      card.innerHTML = `
        <div class="crew-row">
          <div class="pos">${r.cur_pos ?? p.current_pos ?? ""}</div>
          <div class="who"><span class="name">${r.college}${(r.boat > 1) ? " " + r.boat : ""}</span> ${bladesChip}
            <span class="chase">${chase}</span></div>
          <div class="prob">
            <div class="bar" title="${pct(up)} to bump up">
              <span style="width:${Math.round(up * 100)}%;background:${C.up}"></span>
            </div>
            <div class="pn">${pct(up)}</div>
          </div>
          <div class="caret" aria-hidden="true">›</div>
        </div>
        <div class="detail" hidden></div>`;

      const detail = card.querySelector(".detail");
      const fill = () => {
        if (detail.dataset.built === "1") return;
        detail.dataset.built = "1";
        detail.innerHTML = renderDetail(r, { up, hold, caught, onBlades, p }, factorsMap);
        // draw the little attribution waterfall once visible
        const cid = "wf-" + gender + "-" + (r.cur_pos ?? Math.random().toString(36).slice(2));
        const slot = detail.querySelector(".wf");
        if (slot && Array.isArray(r.contributions) && r.contributions.length) {
          slot.id = cid;
          draw(cid, w => waterfall(r.contributions, up, w));
        }
      };

      const toggle = () => {
        const open = card.dataset.expanded === "1";
        if (open) { card.dataset.expanded = "0"; detail.hidden = true; card.classList.remove("open"); }
        else { fill(); card.dataset.expanded = "1"; detail.hidden = false; card.classList.add("open"); }
      };
      card.querySelector(".crew-row").addEventListener("click", toggle);
      card.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } });

      board.append(card);
    }
  }
}

/* per-crew expanded detail: outcome split + factor attribution */
function renderDetail(r, o, factorsMap) {
  const split = (r.chasing == null)
    ? `<p class="dsplit">As Head of the river this boat can only hold or be caught — there is no boat ahead to chase.</p>`
    : `<div class="splitbars">
        ${splitBar("Bumps up", o.up, C.up)}
        ${splitBar("Rows over", o.hold, C.row)}
        ${splitBar("Gets caught", o.caught, C.down)}
       </div>`;

  const blades = o.onBlades
    ? `<p class="dblade">Has bumped on every day so far. Model chance of completing all four for blades: <strong>${pct(o.p.p_complete_blades)}</strong>.</p>`
    : "";

  const attribution = (Array.isArray(r.contributions) && r.contributions.length)
    ? `<div class="attr">
         <div class="attr-h">Why the model leans this way <span class="vs">vs ${r.chasing}</span></div>
         <div class="wf"></div>
         <p class="attr-note">Each bar is one factor's push on the log-odds of bumping the boat ahead. Right (green) raises the chance; left (red) lowers it.</p>
       </div>`
    : `<p class="attr-note">No single factor separates these two crews — on form they are near-identical, so this one is close to a coin toss.</p>`;

  return split + blades + attribution;
}
function splitBar(label, v, col) {
  if (v == null) return "";
  return `<div class="sb"><div class="sb-l">${label}</div>
    <div class="bar"><span style="width:${Math.round(v * 100)}%;background:${col}"></span></div>
    <div class="sb-n">${pct(v)}</div></div>`;
}

/* horizontal diverging bar (waterfall-ish) of factor log-odds contributions */
function waterfall(contribs, p, w) {
  const data = contribs.slice().sort((a, b) => Math.abs(b.logodds) - Math.abs(a.logodds));
  const m = Math.max(0.5, ...data.map(d => Math.abs(d.logodds))) * 1.15;
  const h = 26 * data.length + 34;
  return P.plot({
    width: w, height: h, marginLeft: 168, marginRight: 44, marginTop: 6, marginBottom: 26,
    x: { domain: [-m, m], label: "← less likely     log-odds push     more likely →", grid: true, ticks: 5 },
    y: { domain: data.map(d => d.factor), label: null },
    marks: [
      P.ruleX([0], { stroke: "#000", strokeOpacity: .45 }),
      P.barX(data, {
        y: "factor", x: "logodds",
        fill: d => d.logodds >= 0 ? C.up : C.down, rx: 2,
      }),
      P.text(data, {
        y: "factor", x: "logodds",
        text: d => (d.logodds > 0 ? "+" : "") + d.logodds.toFixed(2),
        dx: d => d.logodds >= 0 ? 6 : -6,
        textAnchor: d => d.logodds >= 0 ? "start" : "end",
        fontSize: 11, fill: "#444", fontWeight: 600,
      }),
    ],
  });
}

/* === WHY PANEL 1: factor odds-ratios per SD (head-to-head model) === */
function drawFactors(rf) {
  const h = rf.head_to_head || {};
  const map = h.factors_or_per_sd || {};
  const labels = {
    form_so_far_this_week: "Form so far this week",
    torpids_form: "Torpids form (same squad)",
    squad_continuity: "Squad continuity",
    last_year_form: "Last year's form",
    blues_in_boat: "Blues in the boat",
    target_own_pace_recession: "Target's own pace",
  };
  const data = Object.entries(map)
    .map(([k, v]) => ({ factor: labels[k] || k, or: v, lift: v >= 1 }))
    .sort((a, b) => a.or - b.or);
  draw("chart-factors", w => P.plot({
    width: w, height: 250, marginLeft: 176, marginRight: 52, marginBottom: 42,
    x: { label: "Odds of bumping, × per standard deviation →", grid: true, domain: [0.7, 3.6] },
    y: { label: null, domain: data.map(d => d.factor) },
    marks: [
      P.ruleX([1], { stroke: "#000", strokeDasharray: "3 3", strokeOpacity: .5 }),
      P.barX(data, { y: "factor", x1: 1, x2: "or", fill: d => d.lift ? C.oxford : C.down, rx: 2 }),
      P.text(data, {
        y: "factor", x: "or", text: d => "×" + d.or.toFixed(2),
        dx: d => d.lift ? 7 : -7, textAnchor: d => d.lift ? "start" : "end",
        fontSize: 12, fontWeight: 600, fill: "#444",
      }),
    ],
  }));
}

/* === WHY PANEL 2: predictability by day (revealed strength, NOT momentum) === */
function drawPerDay(extras, rf) {
  const per = extras.per_day;
  if (!per) return;
  const DAY = { 1: "Wed", 2: "Thu", 3: "Fri", 4: "Sat" };
  draw("chart-perday", w => P.plot({
    width: w, height: 260, marginLeft: 52, marginBottom: 44,
    x: { label: "Day of racing →", domain: [1, 2, 3, 4], tickFormat: v => DAY[v] || v },
    y: { label: "Out-of-sample AUC", grid: true, domain: [0.5, 0.9] },
    marks: [
      P.ruleY([0.5], { stroke: C.row, strokeDasharray: "3 3" }),
      P.text([{}], { x: 1, y: 0.5, text: ["coin toss"], dy: -8, dx: 4, fill: C.row, fontSize: 11, textAnchor: "start" }),
      P.line(per, { x: "day", y: "auc_bump", stroke: C.oxford, strokeWidth: 2.4, curve: "monotone-x" }),
      P.dot(per, { x: "day", y: "auc_bump", fill: C.oxford, r: 5 }),
      P.text(per, { x: "day", y: "auc_bump", text: d => d.auc_bump.toFixed(2), dy: -13, fontSize: 12, fontWeight: 600 }),
    ],
  }));
}

/* === WHY PANEL 3: blades can't be fluked (luck floor vs observed) === */
function drawLuck(rf) {
  const ls = rf.luck_skill;
  if (!ls) return;
  const data = [
    { k: "If every crew were equal", v: ls.blades_rate_pure_luck_floor, c: C.row },
    { k: "What actually happens", v: ls.blades_rate_observed, c: C.gold },
  ];
  draw("chart-luck", w => P.plot({
    width: w, height: 250, marginLeft: 60, marginBottom: 52, marginRight: 20,
    x: { label: null, domain: data.map(d => d.k) },
    y: { label: "Share winning blades", grid: true, percent: true, domain: [0, Math.max(0.1, ls.blades_rate_observed * 1.25)] },
    marks: [
      P.barY(data, { x: "k", y: "v", fill: "c", rx: 2 }),
      P.text(data, { x: "k", y: "v", text: d => d.v < 0.01 ? (d.v * 100).toFixed(1) + "%" : Math.round(d.v * 100) + "%", dy: -10, fontSize: 15, fontWeight: 700 }),
      P.ruleY([0]),
    ],
  }));
}

(async function () {
  let preds, h2h, extras, rf;
  try {
    [preds, h2h, extras] = await Promise.all([
      load("predictions.json"), load("headtohead_2026.json"), load("extras.json"),
    ]);
  } catch (e) { console.error("core data load failed", e); return; }
  // reconciled findings live outside site/data; pull from processed copy if present
  try { rf = await (await fetch("../data/reconciled_findings.json")).json(); }
  catch (e) {
    try { rf = await (await fetch("../../data/processed/reconciled_findings.json")).json(); }
    catch (e2) { console.warn("reconciled_findings not reachable; using embedded fallback", e2); rf = EMBEDDED_RF; }
  }

  // masthead meta
  const day = document.getElementById("day-label");
  if (day) day.textContent = preds.day_label || h2h.day_label || "next day";
  const meta = document.getElementById("model-meta");
  if (meta) {
    const auc = (rf.head_to_head || {}).oos_auc;
    meta.innerHTML = `Head-to-head model · out-of-sample AUC <strong>${auc ?? "—"}</strong> · ${(preds.men || []).length} men's & ${(preds.women || []).length} women's crews · generated after day ${preds.as_of_day}`;
  }

  // gender tabs drive the board
  let gender = "men";
  const tabs = document.querySelectorAll(".tab");
  const renderBoard = () => makeBoard(h2h, preds, gender);
  tabs.forEach(t => t.addEventListener("click", () => {
    tabs.forEach(x => x.classList.toggle("active", x === t));
    gender = t.dataset.g; renderBoard();
  }));
  renderBoard();

  // blades watch strip
  const renderBlades = () => {
    const el = document.getElementById("blades-strip"); if (!el) return;
    const rows = (preds[gender] || []).filter(r => r.on_for_blades)
      .sort((a, b) => (b.p_complete_blades || 0) - (a.p_complete_blades || 0));
    el.innerHTML = rows.length
      ? rows.slice(0, 10).map(r => `<span class="bw"><span class="bw-c">${r.college}${r.boat > 1 ? " " + r.boat : ""}</span> <span class="bw-p">${pct(r.p_complete_blades)}</span></span>`).join("")
      : `<span class="small">No crews still on for blades.</span>`;
  };
  // keep blades strip in sync with the tabs too
  tabs.forEach(t => t.addEventListener("click", renderBlades));
  renderBlades();

  // why panels
  if (rf) { drawFactors(rf); drawLuck(rf); }
  drawPerDay(extras, rf);

  // populate inline stat numbers from reconciled findings
  const setText = (id, v) => { const e = document.getElementById(id); if (e && v != null) e.textContent = v; };
  if (rf.momentum_correction) {
    setText("m-raw", "×" + rf.momentum_correction.or_raw);
    setText("m-ctrl", "×" + rf.momentum_correction.or_controlled_for_quality);
  }
  if (rf.luck_skill) {
    setText("l-excess", rf.luck_skill.excess_ratio + "×");
    setText("l-repeat", Math.round(rf.luck_skill.blades_share_didnt_blade_prior_year * 100) + "%");
  }
})();

/* tiny fallback so the board still renders if reconciled_findings.json is unreachable */
const EMBEDDED_RF = {
  head_to_head: { oos_auc: 0.805, factors_or_per_sd: { form_so_far_this_week: 3.31, torpids_form: 1.40, squad_continuity: 1.31, last_year_form: 1.19, blues_in_boat: 1.16, target_own_pace_recession: 0.92 } },
  momentum_correction: { or_raw: 6.8, or_controlled_for_quality: 1.7 },
  luck_skill: { blades_rate_observed: 0.085, blades_rate_pure_luck_floor: 0.008, excess_ratio: 11, blades_share_didnt_blade_prior_year: 0.86 },
};
