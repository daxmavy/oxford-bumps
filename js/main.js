/* Oxford Eights — front-end. Loads static JSON, draws charts with Observable Plot,
   builds the live predictions and the college lookup. Defensive: any missing data
   leaves its section blank rather than breaking the page. */
const P = window.Plot;
const C = { up: "#1a7f57", down: "#c0392b", row: "#b8b0a0", oxford: "#002147", gold: "#b8893b", grey: "#9a9182" };
const pct = x => (x == null ? "—" : Math.round(x * 100) + "%");
const W = el => Math.min(el.clientWidth || 680, 980);

async function load(f) { const r = await fetch("data/" + f); return r.json(); }

function draw(id, fn) {
  const el = document.getElementById(id); if (!el) return;
  try { el.innerHTML = ""; el.append(fn(W(el))); }
  catch (e) { console.error(id, e); }
}

(async function () {
  let stats, preds, colleges, extras = {};
  try { [stats, preds, colleges] = await Promise.all([load("stats.json"), load("predictions.json"), load("colleges.json")]); }
  catch (e) { console.error("data load failed", e); return; }
  try { extras = await load("extras.json"); } catch (e) { console.warn("extras.json missing", e); }

  /* --- headline numbers --- */
  const cov = stats.coverage || {};
  if (cov.years) document.getElementById("s-years").textContent = cov.years[0] + "–" + cov.years[1];
  if (cov.crossval_overlap) document.getElementById("s-races").textContent = cov.crossval_overlap.toLocaleString();

  /* --- 01 movement distribution --- */
  draw("chart-movement", w => P.plot({
    width: w, height: 320, marginLeft: 56, marginBottom: 46,
    x: { label: "Places moved over the four days (− down · 0 stay · + up) →", tickFormat: d => d > 0 ? "+" + d : d },
    y: { label: "Crews", grid: true, tickFormat: "s" },
    marks: [
      P.barY(stats.move_distribution, { x: "net", y: "count",
        fill: d => d.net > 0 ? C.up : d.net < 0 ? C.down : C.row, rx: 2 }),
      P.ruleY([0]),
      P.text([{ net: 0, count: 0 }], { x: 0, y: 0, text: ["stayed put"], dy: -8, fill: C.row, fontSize: 11 }),
    ],
  }));

  /* --- 03 blades by division (roughly flat = luck) --- */
  if (stats.blades_by_division) draw("chart-blades-div", w => P.plot({
    width: w, height: 300, marginLeft: 56, marginBottom: 46,
    x: { label: "Starting division →", tickFormat: d => "Div " + d },
    y: { label: "Share winning blades", grid: true, percent: true, domain: [0, Math.max(0.16, Math.max(...stats.blades_by_division.map(d => d.blades_rate)) * 1.2)] },
    marks: [
      P.barY(stats.blades_by_division, { x: "division", y: "blades_rate", fill: C.gold, rx: 2 }),
      P.ruleY([stats.stickiness.blades_rate], { stroke: C.oxford, strokeDasharray: "4 3" }),
      P.text([{ d: 1 }], { x: 1, y: stats.stickiness.blades_rate, text: ["overall rate"], dy: -8, fill: C.oxford, fontSize: 11, textAnchor: "start" }),
    ],
  }));

  /* --- 03 luck floor vs reality: blades can't be fluked --- */
  const ls = (stats.reconciled || {}).luck_skill;
  if (ls) {
    const data = [
      { k: "Pure luck (all crews equal)", v: ls.blades_rate_pure_luck_floor, c: C.row },
      { k: "What actually happens", v: ls.blades_rate_observed, c: C.gold },
    ];
    draw("chart-luck", w => P.plot({
      width: w, height: 320, marginLeft: 60, marginBottom: 50, marginRight: 20,
      x: { label: null, domain: data.map(d => d.k) },
      y: { label: "Share of crews winning blades", grid: true, percent: true,
           domain: [0, Math.max(0.1, ls.blades_rate_observed * 1.25)] },
      marks: [
        P.barY(data, { x: "k", y: "v", fill: "c", rx: 2 }),
        P.text(data, { x: "k", y: "v",
          text: d => d.v < 0.01 ? (d.v * 100).toFixed(1) + "%" : Math.round(d.v * 100) + "%",
          dy: -10, fontSize: 15, fontWeight: 700 }),
        P.ruleY([0]),
      ],
    }));
  }

  /* --- 04 factor effects with CIs --- */
  if (stats.effects) {
    const short = {
      "n_blues (+1 Blue-Boat rower)": "Each Blue in the boat",
      "tor_net (same-year Torpids)": "Each place gained at Torpids",
      "prev_net_places (last year)": "Each place gained last year",
      "same_coach (continuity)": "Same coach as last year",
      "race-week rainfall (mm)": "Race-week rain (per mm)",
      "race-week mean Tmax (C)": "Race-week warmth (per °C)",
    };
    const eff = stats.effects.filter(e => !/rain|warmth|tmax/i.test(e.term))
      .map(e => ({ ...e, label: short[e.term] || e.term, sig: (e.lo > 0 || e.hi < 0) }))
      .sort((a, b) => a.coef - b.coef);
    draw("chart-effects", w => P.plot({
      width: w, height: 300, marginLeft: 190, marginBottom: 44, marginRight: 64,
      x: { label: "Extra places gained over a regatta →", grid: true, zero: true },
      y: { label: null, domain: eff.map(d => d.label) },
      marks: [
        P.ruleX([0], { stroke: "#000", strokeDasharray: "3 3", strokeOpacity: .5 }),
        P.link(eff, { y: "label", x1: "lo", x2: "hi", stroke: d => d.sig ? C.oxford : C.grey, strokeWidth: 2 }),
        P.dot(eff, { y: "label", x: "coef", fill: d => d.sig ? C.oxford : C.grey, r: 5 }),
        P.text(eff, { y: "label", x: "hi", text: d => (d.coef > 0 ? "+" : "") + d.coef, dx: 12, fontSize: 12, fill: "#444" }),
      ],
    }));
  }

  /* --- 02b predictability by day --- */
  if (extras.per_day) {
    const d = extras.per_day, DAY = { 1: "Wed", 2: "Thu", 3: "Fri", 4: "Sat" };
    draw("chart-perday", w => P.plot({
      width: w, height: 300, marginLeft: 56, marginBottom: 46,
      x: { label: "Day of racing →", domain: [1, 2, 3, 4], tickFormat: v => DAY[v] || v },
      y: { label: "Predictability (AUC)", grid: true, domain: [0.5, 0.9] },
      marks: [
        P.ruleY([0.5], { stroke: C.row, strokeDasharray: "3 3" }),
        P.line(d, { x: "day", y: "auc_bump", stroke: C.oxford, strokeWidth: 2.4, curve: "monotone-x" }),
        P.dot(d, { x: "day", y: "auc_bump", fill: C.oxford, r: 5 }),
        P.text(d, { x: "day", y: "auc_bump", text: v => v.auc_bump.toFixed(2), dy: -13, fontSize: 12, fontWeight: 600 }),
        P.text([{}], { x: 1, y: 0.5, text: ["coin toss"], dy: -8, dx: 4, fill: C.row, fontSize: 11, textAnchor: "start" }),
      ],
    }));
  }

  /* --- 05 long game: St Hilda's climb + maturation --- */
  const sth = (extras.maturation_examples || {})["St Hilda's (M)"];
  if (sth) {
    const h = sth.filter(x => x.year >= 2008);
    draw("chart-sthildas", w => P.plot({
      width: w, height: 320, marginLeft: 46, marginBottom: 40,
      x: { label: null, tickFormat: "d" },
      y: { label: "Position on the river (1 = Head) ↑", reverse: true, grid: true },
      marks: [
        P.line(h, { x: "year", y: "finish", stroke: C.bump, strokeWidth: 2.4, curve: "monotone-x" }),
        P.dot(h, { x: "year", y: "finish", fill: C.bump, r: 3.5,
          channels: { year: "year", position: "finish" }, tip: { format: { x: false, y: false, year: d => d, position: true } } }),
      ],
    }));
  }
  if (extras.maturation_curve) {
    const m = extras.maturation_curve;
    draw("chart-maturation", w => P.plot({
      width: w, height: 290, marginLeft: 56, marginBottom: 46,
      x: { label: "Seasons a crew has been racing →", tickFormat: "d" },
      y: { label: "Avg places gained in a regatta", grid: true },
      marks: [
        P.ruleY([0], { stroke: "#aaa" }),
        P.areaY(m, { x: "season", y1: d => d.mean_net - d.se, y2: d => d.mean_net + d.se, fill: C.oxford, fillOpacity: .12 }),
        P.line(m, { x: "season", y: "mean_net", stroke: C.oxford, strokeWidth: 2.4, curve: "monotone-x" }),
        P.dot(m, { x: "season", y: "mean_net", fill: C.oxford, r: 3 }),
      ],
    }));
  }

  /* --- 05 live predictions --- */
  if (preds) {
    const sf = document.getElementById("pred-standfirst");
    if (sf) sf.innerHTML = `Two days are gone in the ${preds.event}. Here's what our model expects for <strong>${preds.day_label}</strong> — the chance each boat bumps up, holds, or gets caught. Come back after racing and mark our homework.`;
    let g = "men";
    const tabs = document.querySelectorAll(".tab");
    tabs.forEach(t => t.onclick = () => { tabs.forEach(x => x.classList.remove("active")); t.classList.add("active"); g = t.dataset.g; renderPred(); });
    function renderPred() {
      const rows = (preds[g] || []);
      const div1 = rows.filter(r => r.division === 1);
      const body = div1.map(r => {
        const up = r.p_bump_up, hold = r.p_row_over, dn = r.p_bumped;
        return `<tr><td class="r">${r.current_pos}</td><td>${r.college}${r.boat > 1 ? " " + r.boat : ""}</td>
          <td><div class="bar"><span style="width:${Math.round(up*100)}%;background:${C.up}"></span></div></td><td class="r">${pct(up)}</td>
          <td class="r">${pct(hold)}</td><td class="r">${pct(dn)}</td></tr>`;
      }).join("");
      document.getElementById("pred-table").innerHTML =
        `<table class="pred"><thead><tr><th>#</th><th>Crew (Div 1)</th><th>Bump up</th><th class="r">↑</th><th class="r">hold</th><th class="r">caught</th></tr></thead><tbody>${body}</tbody></table>`;
      const bl = rows.filter(r => r.on_for_blades).sort((a, b) => (b.p_complete_blades || 0) - (a.p_complete_blades || 0));
      document.getElementById("pred-blades").innerHTML = bl.length
        ? `<p><span class="tag">Still on for blades</span> — ${bl.length} ${g}'s crews have bumped every day so far. Their model chance of completing all four:</p>`
          + `<p>` + bl.slice(0, 12).map(r => `${r.college}${r.boat > 1 ? " " + r.boat : ""} <strong>${pct(r.p_complete_blades)}</strong>`).join(" · ") + `</p>`
        : "";
    }
    renderPred();
  }

  /* --- 06 college lookup --- */
  if (colleges) {
    const pick = document.getElementById("college-pick"), gp = document.getElementById("gender-pick");
    Object.keys(colleges).sort().forEach(c => { const o = document.createElement("option"); o.value = c; o.textContent = c; pick.append(o); });
    const prefer = ["Oriel", "Pembroke", "Wolfson"].find(c => colleges[c]); if (prefer) pick.value = prefer;
    function renderLookup() {
      const c = pick.value, g = gp.value, rec = (colleges[c] || {})[g];
      const box = document.getElementById("lookup-result");
      if (!rec) { box.innerHTML = `<p class="small">No ${g === "m" ? "men's" : "women's"} first-eight record for ${c}.</p>`; return; }
      const hist = rec.history.filter(h => h.year >= 1900);
      const pr = (preds[g === "m" ? "men" : "women"] || []).find(r => r.college === c && r.boat === 1);
      let status = "";
      if (pr) status = `<p>In 2026 they sit <strong>${pr.current_pos}${ordinal(pr.current_pos)}</strong> on the river${pr.on_for_blades ? `, still on for blades (<strong>${pct(pr.p_complete_blades)}</strong> to complete)` : ""}. Friday: <strong>${pct(pr.p_bump_up)}</strong> to bump up, ${pct(pr.p_bumped)} to be caught.</p>`;
      box.innerHTML = `<div class="recordline">
        <div class="stat"><div class="num">${rec.headships}</div><div class="lab">years Head of the River</div></div>
        <div class="stat"><div class="num">${rec.blades}</div><div class="lab">sets of blades</div></div>
        <div class="stat"><div class="num">${rec.spoons}</div><div class="lab">sets of spoons</div></div>
        <div class="stat"><div class="num">${rec.first_year}</div><div class="lab">first on record</div></div>
      </div>${status}
      <div class="legend"><span class="key"><span class="sw" style="background:${C.gold}"></span>blades year</span>
        <span class="key"><span class="sw" style="background:${C.down}"></span>spoons year</span>
        <span class="key">lower on the chart = higher up the river</span></div>
      <div id="lookup-chart" class="chart"></div>`;
      draw("lookup-chart", w => P.plot({
        width: w, height: 340, marginLeft: 44, marginBottom: 40,
        x: { label: null, tickFormat: "d" },
        y: { label: "Finishing position (1 = Head) ↑", reverse: true, grid: true },
        marks: [
          P.line(hist, { x: "year", y: "finish", stroke: C.oxford, strokeWidth: 1.6, curve: "monotone-x" }),
          P.dot(hist.filter(h => h.blades), { x: "year", y: "finish", fill: C.gold, r: 4 }),
          P.dot(hist.filter(h => h.spoons), { x: "year", y: "finish", fill: C.down, r: 4 }),
          P.dot(hist, { x: "year", y: "finish", r: 2, fill: C.oxford, fillOpacity: .35,
            channels: { year: "year", position: "finish" },
            tip: { format: { x: false, y: false, year: d => d, position: true } } }),
          P.ruleY([1], { stroke: C.gold, strokeOpacity: .4 }),
        ],
      }));
    }
    pick.onchange = gp.onchange = renderLookup;
    renderLookup();
  }

  const fu = document.getElementById("footer-updated");
  if (fu && preds) fu.textContent = `Predictions generated after day ${preds.as_of_day} of the 2026 races.`;
})();

function ordinal(n) { const s = ["th", "st", "nd", "rd"], v = n % 100; return (s[(v - 20) % 10] || s[v] || s[0]); }
