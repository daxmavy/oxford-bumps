/* Figures and inline statistics for the bumps-forecasting report (post-overhaul).
   Loads analysis.json (model comparison, calibration, over-bump tail, coherence, by-day AUC)
   and betting.json (decision frontier, per-season ranks) from the leak-free walk-forward, and
   renders with Observable Plot. All reliability panels are drawn as one uniform faceted figure
   (no mismatched side-by-side heights). */
const P = window.Plot;
const C = { up: "#1a7f57", down: "#c0392b", oxford: "#002147", oxford2: "#1b3a63",
            gold: "#b8893b", grey: "#9a9182", line: "#e3dccf", joint: "#7a5195", recal: "#bc5090" };

const f2 = x => (x == null || isNaN(x) ? "—" : (+x).toFixed(2));
const f3 = x => (x == null || isNaN(x) ? "—" : (+x).toFixed(3));
const pct = x => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
const pct1 = x => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(1) + "%");
const sgn3 = x => (x == null || isNaN(x) ? "—" : (x < 0 ? "−" : "+") + Math.abs(x).toFixed(3));
const ndash = (a, b) => `${a}–${b}`;
const ci2 = c => (c && c[0] != null ? `${f2(c[0])}–${f2(c[1])}` : "");
const ci3 = c => (c && c[0] != null ? `${f3(c[0])}–${f3(c[1])}` : "");
function nth(p) { const n = Math.round(p * 100), s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
const grp = x => (x == null ? "—" : Math.round(x).toLocaleString());

const Wof = el => Math.min((el && el.clientWidth) || 680, 980);
async function load(f) { const r = await fetch("data/" + f); if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }
function draw(id, fn) { const el = document.getElementById(id); if (!el) return; try { el.innerHTML = ""; el.append(fn(Wof(el))); } catch (e) { console.error("draw " + id, e); el.innerHTML = "<p class='small'>figure unavailable</p>"; } }
function setText(id, s) { const el = document.getElementById(id); if (el) el.textContent = s; }
function setHTML(id, s) { const el = document.getElementById(id); if (el) el.innerHTML = s; }

/* Plot 0.6.x collapses the main <svg> to ~15px when legend:true is built detached; render the
   legend as a separate HTML swatch and stack it instead. */
function legendBar(domain, range) { return P.legend({ color: { domain, range }, swatchSize: 12 }); }
function stack(legendNode, plotNode) {
  const d = document.createElement("div");
  if (legendNode) { legendNode.style.margin = "0 0 4px 2px"; d.append(legendNode); }
  d.append(plotNode);
  return d;
}

const EVENTS = [["move up", "any move up"], ["bump (+1)", "single bump (+1)"],
                ["over-bump up (>=+2)", "over-bump (≥+2)"], ["row over", "row-over"], ["bumped (-1)", "bumped (−1)"]];

/* ONE uniform faceted reliability figure with Wilson bands — replaces the old mismatched pair */
function reliabilityFacets(reliab, w) {
  const rows = [];
  EVENTS.forEach(([k, lab]) => {
    const e = reliab.gbm[k]; if (!e) return;
    e.pred.forEach((px, i) => rows.push({ ev: lab, pred: px, obs: e.obs[i], lo: e.lo[i], hi: e.hi[i], n: e.count[i] }));
  });
  return P.plot({
    width: w, height: Math.round(w * 0.30), marginLeft: 42, marginBottom: 36, marginTop: 18,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "11px" },
    fx: { domain: EVENTS.map(e => e[1]), label: null },
    x: { domain: [0, 1], ticks: [0, .5, 1], tickFormat: "%", label: "predicted →" },
    y: { domain: [0, 1], ticks: [0, .5, 1], tickFormat: "%", label: "↑ observed", grid: true },
    marks: [
      P.line([[0, 0], [1, 1]], { stroke: "#b9b2a4", strokeDasharray: "4 4" }),
      P.ruleX(rows, { fx: "ev", x: "pred", y1: "lo", y2: "hi", stroke: "#9aa0a6", strokeWidth: 1, strokeOpacity: 0.6 }),
      P.dot(rows, { fx: "ev", x: "pred", y: "obs", r: d => 2.4 + Math.sqrt(d.n) / 5, fill: C.oxford, fillOpacity: .8, stroke: "white", strokeWidth: .5 }),
    ],
  });
}

/* model comparison: Brier with bootstrap CI (points + error bars), lower is better */
function modelBrier(models, w) {
  const order = [["climatology", "climatology"], ["climatology_pos", "+ position"], ["own_history", "own history"],
                 ["joint", "coherent joint"], ["gbm", "relational GBM"], ["gbm_recal", "GBM, recalibrated"]];
  const data = order.filter(([k]) => models[k]).map(([k, lab]) => ({
    lab, brier: models[k].brier.mean, lo: models[k].brier.ci[0], hi: models[k].brier.ci[1] }));
  return P.plot({
    width: w, height: Math.round(w * 0.42), marginLeft: 132, marginBottom: 34, marginTop: 8,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
    x: { label: "multiclass Brier score (lower is better) →", grid: true, domain: [0.45, 0.72] },
    y: { domain: order.filter(([k]) => models[k]).map(o => o[1]), label: null },
    marks: [
      P.ruleX([models.climatology.brier.mean], { stroke: C.grey, strokeDasharray: "3 3" }),
      P.ruleY(data, { y: "lab", x1: "lo", x2: "hi", stroke: C.oxford2, strokeWidth: 1.5 }),
      P.dot(data, { y: "lab", x: "brier", r: 4.5, fill: d => /GBM/.test(d.lab) ? C.oxford : C.oxford2 }),
      P.text(data, { y: "lab", x: "brier", text: d => d.brier.toFixed(3), dy: -10, fontSize: 10, fill: C.oxford }),
    ],
  });
}

/* move-up AUC by day, GBM vs coherent joint vs own-history, with CI bands */
function aucByDay(byday, w) {
  const order = ["own history", "coherent joint", "relational GBM"];
  const map = { "own history": "own_history", "coherent joint": "joint", "relational GBM": "gbm" };
  const cr = [C.grey, C.joint, C.oxford];
  const data = Object.keys(byday).sort().flatMap(d => order.map(o => {
    const e = byday[d][map[o]]; return { day: "Day " + d, who: o, auc: e.mean, lo: e.ci[0], hi: e.ci[1] }; }));
  const fig = P.plot({
    width: w, height: Math.round(w * 0.5), marginLeft: 48, marginBottom: 34, marginTop: 10,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
    fx: { label: null }, color: { domain: order, range: cr },
    x: { domain: order, axis: null }, y: { domain: [0.5, 0.92], label: "↑ AUC (move up)", grid: true },
    marks: [
      P.ruleY([0.5], { stroke: "#c9c1b2", strokeDasharray: "2 3" }),
      P.ruleX(data, { fx: "day", x: "who", y1: "lo", y2: "hi", stroke: "#9aa0a6", strokeWidth: 1 }),
      P.dot(data, { fx: "day", x: "who", y: "auc", fill: "who", r: 4 }),
      P.text(data, { fx: "day", x: "who", y: "auc", text: d => d.auc.toFixed(2), dy: -9, fontSize: 9, fill: "#444" }),
    ],
  });
  return stack(legendBar(order, cr), fig);
}

/* over-bump tail: reliability of P(over-bump) for the raw GBM vs the recalibrated GBM */
function overBumpRecal(reliab, w) {
  const series = [["gbm", "raw GBM"], ["gbm_recal", "recalibrated"]];
  const rows = series.flatMap(([k, lab]) => {
    const e = reliab[k]["over-bump up (>=+2)"];
    return e.pred.map((px, i) => ({ who: lab, pred: px, obs: e.obs[i], lo: e.lo[i], hi: e.hi[i], n: e.count[i] }));
  });
  const cr = [C.oxford, C.recal];
  const fig = P.plot({
    width: w, height: Math.round(w * 0.62), marginLeft: 46, marginBottom: 40, marginTop: 10,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
    color: { domain: series.map(s => s[1]), range: cr },
    x: { domain: [0, 0.16], label: "predicted P(over-bump) →", tickFormat: "%", grid: true },
    y: { domain: [0, 0.16], label: "↑ observed", tickFormat: "%", grid: true },
    marks: [
      P.line([[0, 0], [0.16, 0.16]], { stroke: "#b9b2a4", strokeDasharray: "4 4" }),
      P.ruleX(rows, { x: "pred", y1: "lo", y2: "hi", stroke: "who", strokeOpacity: 0.45, strokeWidth: 1 }),
      P.dot(rows, { x: "pred", y: "obs", fill: "who", r: d => 3 + Math.sqrt(d.n) / 4, fillOpacity: .85, stroke: "white", strokeWidth: .5 }),
    ],
  });
  return stack(legendBar(series.map(s => s[1]), cr), fig);
}

/* market: per-season final wealth (model / median / champion / oracle) as a dot–range plot */
function marketSeasons(betting, w) {
  const order = ["median entrant", "model (EV-max)", "champion", "oracle"];
  const fill = { "median entrant": C.grey, "model (EV-max)": C.oxford, "champion": C.gold, "oracle": "#444" };
  const data = betting.seasons.flatMap(s => [
    { year: "" + s.year, who: "median entrant", v: s.median },
    { year: "" + s.year, who: "model (EV-max)", v: s.model },
    { year: "" + s.year, who: "champion", v: s.champion },
    { year: "" + s.year, who: "oracle", v: s.oracle },
  ]);
  const fig = P.plot({
    width: w, height: Math.round(w * 0.5), marginLeft: 52, marginBottom: 40, marginTop: 24,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
    fx: { label: null }, color: { domain: order, range: order.map(o => fill[o]) },
    x: { domain: order, axis: null }, y: { label: "↑ final wealth", grid: true, zero: true },
    marks: [
      P.ruleY([2000], { stroke: "#c9c1b2", strokeDasharray: "2 3" }),
      P.dot(data, { fx: "year", x: "who", y: "v", fill: "who", r: 4, symbol: d => d.who === "oracle" ? "diamond" : "circle" }),
      P.ruleY([0]),
    ],
  });
  return stack(legendBar(order, order.map(o => fill[o])), fig);
}

/* decision frontier: P(beat champion) by strategy, coloured by model */
function frontier(betting, w) {
  const strat = ["EV-max", "risk +0.5sd", "risk +1sd", "risk +2sd", "concentrate"];
  const mods = [["rel", "relational GBM"], ["relcal", "recalibrated"], ["joint", "coherent joint"]];
  const cr = [C.oxford, C.recal, C.joint];
  const data = betting.frontier.map(r => ({ strategy: r.strategy, model: mods.find(m => m[0] === r.model)[1],
    p: r.mean_p_beat_champion, pc: r.mean_pct_of_champion }));
  const fig = P.plot({
    width: w, height: Math.round(w * 0.46), marginLeft: 52, marginBottom: 64, marginTop: 10,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
    color: { domain: mods.map(m => m[1]), range: cr },
    x: { domain: strat, label: null, tickRotate: -20 },
    y: { label: "↑ P(beat champion)", grid: true, tickFormat: "%", domain: [0, Math.max(0.02, ...data.map(d => d.p)) * 1.15] },
    marks: [
      P.dot(data, { x: "strategy", y: "p", fill: "model", r: 5, symbol: "circle" }),
      P.ruleY([0]),
    ],
  });
  return stack(legendBar(mods.map(m => m[1]), cr), fig);
}

function init(A, B) {
  const M = A.models, OB = A.over_bump, CO = A.coherence, AB = A.ablation;
  const evbase = next => next; // noop
  // ---- abstract / results inline numbers ----
  setText("d-n", grp(A.n)); setText("d-nc", grp(A.n_contests));
  setText("ab-brier", f2(M.gbm.brier.mean)); setText("ab-clim", f2(M.climatology.brier.mean));
  setText("ab-rps-skill", pct(M.gbm.rps_skill)); setText("ab-auc", f2(M.gbm.move_up_auc.mean));
  setText("ab-joint-brier", f3(M.joint.brier.mean));
  setText("ab-ob-ratio", f2(OB.gbm.ratio)); setText("ab-ob-recal", f2(OB.gbm_recal.ratio));
  // results §1
  setText("r-n", grp(A.n)); setText("r-brier", f3(M.gbm.brier.mean)); setText("r-brier-ci", ci3(M.gbm.brier.ci));
  setText("r-clim", f3(M.climatology.brier.mean)); setText("r-climpos-auc", f2(M.climatology_pos.move_up_auc.mean));
  setText("r-rps-skill", pct(M.gbm.rps_skill)); setText("r-auc", f2(M.gbm.move_up_auc.mean)); setText("r-auc-ci", ci2(M.gbm.move_up_auc.ci));
  // §2 ablation
  setText("r-base-brier", f3(M.own_history.brier.mean)); setText("r-base-skill", pct(M.own_history.rps_skill));
  setText("r-ablation-rps", `${sgn3(AB.rps.diff)} (95% CI ${sgn3(AB.rps.ci[0])} to ${sgn3(AB.rps.ci[1])})`);
  // §3 coherence + joint
  setText("r-coh-gbm", f2(CO.gbm.sd)); setText("r-coh-joint", f2(CO.joint.sd));
  setText("r-coh-floor", f2(CO.oracle_floor.sd));
  setText("r-joint-brier", f3(M.joint.brier.mean)); setText("r-joint-auc", f2(M.joint.move_up_auc.mean));
  setText("r-joint-ob-auc", f2(OB.joint.auc.mean));
  const PRJ = A.paired_rel_joint;
  setText("r-pair-rps", `${sgn3(PRJ.rps.diff)} (95% CI ${sgn3(PRJ.rps.ci[0])} to ${sgn3(PRJ.rps.ci[1])})`);
  setText("r-pair-brier", `${sgn3(PRJ.brier.diff)} (95% CI ${sgn3(PRJ.brier.ci[0])} to ${sgn3(PRJ.brier.ci[1])})`);
  setText("r-pair-auc", `${sgn3(PRJ.auc.diff)} (95% CI ${sgn3(PRJ.auc.ci[0])} to ${sgn3(PRJ.auc.ci[1])})`);
  // §4 by-day
  setText("r-auc-d1", f2(A.by_day_auc[1].gbm.mean)); setText("r-auc-d4", f2(A.by_day_auc[4].gbm.mean));
  setText("auc-cap", grp(A.by_day_auc[1].n));
  // §5 over-bump tail
  setText("r-ob-rate", pct1(OB.base_rate)); setText("r-ob-n", grp(OB.n_events));
  setText("r-ob-auc", f2(OB.gbm.auc.mean)); setText("r-ob-auc-ci", ci2(OB.gbm.auc.ci));
  setText("r-ob-ratio", f2(OB.gbm.ratio)); setText("r-ob-slope", f2(OB.gbm.slope.mean)); setText("r-ob-slope-ci", ci2(OB.gbm.slope.ci));
  setText("r-ob-recal-ratio", f2(OB.gbm_recal.ratio)); setText("r-ob-recal-slope", f2(OB.gbm_recal.slope.mean)); setText("r-ob-recal-slope-ci", ci2(OB.gbm_recal.slope.ci));
  // §6 market
  const evrel = B.frontier.find(r => r.model === "rel" && r.strategy === "EV-max");
  const evcal = B.frontier.find(r => r.model === "relcal" && r.strategy === "EV-max");
  const maxMean = Math.max(...B.frontier.map(r => r.mean_p_beat_champion));   // best strategy's season-mean
  const maxCell = Math.max(...B.frontier.map(r => r.max_p_beat_champion));    // single best model x strategy x season
  setText("r-champ", pct(evrel.mean_pct_of_champion));
  setText("r-champ-range", ndash(pct(evrel.pct_range[0]), pct(evrel.pct_range[1])));
  const shortfalls = B.seasons.map(s => 1 - s.pct_of_champion);
  setText("r-shortfall", ndash(pct(Math.min(...shortfalls)), pct(Math.max(...shortfalls))));
  const pctiles = B.seasons.map(s => 1 - (s.rank - 1) / s.n_teams);
  setText("r-pctile", nth(pctiles.reduce((a, b) => a + b, 0) / pctiles.length));
  setText("r-nteams", grp(B.seasons.reduce((a, s) => a + s.n_teams, 0) / B.seasons.length));
  setText("r-realwins", B.seasons.filter(s => s.model > s.champion).length + "/" + B.seasons.length);
  setText("r-pbeat", pct1(evrel.mean_p_beat_champion)); setText("r-pbeat-recal", pct1(evcal.mean_p_beat_champion));
  setText("r-pbeat-max", pct1(maxMean)); setText("r-pbeat-maxcell", pct1(maxCell));
  setText("r-champ-infl", pct1(B.champion_inflation_vs_ranks2_5));
  setText("ab-champ", pct(evrel.mean_pct_of_champion)); setText("ab-pbeat", pct1(maxMean));
  // discussion / appendix
  setHTML("ceiling-note", "All figures and tables regenerate from the primary data by the analysis pipeline; the out-of-sample predictions, the scoring harness, the joint simulator, the recalibration and the market engine are in the source repository.");
  setText("footer-updated", "Figures regenerate from the primary data; last built " + new Date().getFullYear() + ".");

  // ---- figures ----
  draw("chart-reliability", w => reliabilityFacets(A.reliability, w));
  setHTML("rel-cap", `Across <strong>${grp(A.n)}</strong> out-of-sample crew-days, observed frequency tracks predicted probability for the common outcome classes; bars are 95% Wilson intervals and point area is proportional to the number of crew-days. The over-bump panel is the exception treated in Fig. 4.`);
  draw("chart-modelbrier", w => modelBrier(M, w));
  draw("chart-aucday", w => aucByDay(A.by_day_auc, w));
  draw("chart-overbump", w => overBumpRecal(A.reliability, w));
  draw("chart-market", w => marketSeasons(B, w));
  draw("chart-frontier", w => frontier(B, w));

  // ---- model comparison table ----
  const rowsT = [["climatology", "Climatology (day only)"], ["climatology_pos", "Climatology (+ position)"],
                 ["own_history", "Own history & seeding"], ["joint", "Coherent joint (simulator)"],
                 ["gbm", "Relational GBM"], ["gbm_recal", "Relational GBM, recalibrated"]];
  setHTML("model-table", `<table><thead><tr><th>model</th><th class="num">Brier</th><th class="num">RPS skill</th><th class="num">move-up AUC</th></tr></thead><tbody>${
    rowsT.map(([k, lab]) => { const m = M[k]; const strong = k === "gbm"; const op = strong ? "<strong>" : "", cl = strong ? "</strong>" : "";
      return `<tr><td>${op}${lab}${cl}</td><td class="num">${op}${f3(m.brier.mean)}${cl}<span class="small"> [${ci3(m.brier.ci)}]</span></td><td class="num">${k === "climatology" ? "—" : "+" + Math.round(m.rps_skill * 100) + "%"}</td><td class="num">${f2(m.move_up_auc.mean)}</td></tr>`;
    }).join("")}</tbody></table>`);

  // ---- over-bump tail table ----
  setHTML("ob-table", `<table><thead><tr><th>model</th><th class="num">pred/obs mass</th><th class="num">over-bump AUC</th><th class="num">calibration slope</th></tr></thead><tbody>${
    [["gbm", "Relational GBM"], ["gbm_recal", "GBM, recalibrated"], ["joint", "Coherent joint"]].map(([k, lab]) =>
      `<tr><td>${lab}</td><td class="num">${f2(OB[k].ratio)}</td><td class="num">${f2(OB[k].auc.mean)} <span class="small">[${ci2(OB[k].auc.ci)}]</span></td><td class="num">${f2(OB[k].slope.mean)} <span class="small">[${ci2(OB[k].slope.ci)}]</span></td></tr>`
    ).join("")}</tbody></table>`);

  // ---- decision frontier table ----
  setHTML("frontier-table", `<table><thead><tr><th>model · strategy</th><th class="num">% of champion</th><th class="num">range</th><th class="num">P(beat champion)</th></tr></thead><tbody>${
    B.frontier.map(r => `<tr><td>${({rel:"GBM",relcal:"recal",joint:"joint"})[r.model]} · ${r.strategy}</td><td class="num">${pct(r.mean_pct_of_champion)}</td><td class="num">${ndash(pct(r.pct_range[0]), pct(r.pct_range[1]))}</td><td class="num">${pct1(r.mean_p_beat_champion)}</td></tr>`).join("")
    }</tbody></table>`);
}

(async function () {
  try {
    const [A, B] = await Promise.all([load("analysis.json"), load("betting.json"),
      (document.fonts && document.fonts.ready) || Promise.resolve()]);
    const render = () => init(A, B);
    render();
    requestAnimationFrame(() => requestAnimationFrame(render));
    addEventListener("load", render);
    setTimeout(render, 400);
    addEventListener("resize", () => { clearTimeout(window._rt); window._rt = setTimeout(render, 200); });
  } catch (e) { console.error(e); setHTML("model-table", "<p class='small'>Could not load the analysis data.</p>"); }
})();
