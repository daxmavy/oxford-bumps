/* Figures and inline statistics for the bumps-forecasting report.
   Loads accuracy.json (calibration + proper scores), betting.json (market backtest) and
   analysis.json (ablation, discrimination, order-statistic framing), all from the leak-free
   walk-forward, and renders with Observable Plot. */
const P = window.Plot;
const C = { up: "#1a7f57", down: "#c0392b", oxford: "#002147", oxford2: "#1b3a63",
            gold: "#b8893b", grey: "#9a9182", line: "#e3dccf", hist: "#1b3a63", recent: "#b8893b" };

// ---- number formatting ----
const f2 = x => (x == null || isNaN(x) ? "—" : (+x).toFixed(2));
const f3 = x => (x == null || isNaN(x) ? "—" : (+x).toFixed(3));
const pctI = x => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");        // 0.295 -> "30%"
const pct1 = x => (x == null || isNaN(x) ? "—" : (x * 100).toFixed(1) + "%");        // 0.021 -> "2.1%"
const sgn3 = x => (x == null || isNaN(x) ? "—" : (x < 0 ? "−" : "+") + Math.abs(x).toFixed(3)); // -0.0091 -> "−0.009"
const ndash = (a, b) => `${a}–${b}`;
function nth(p) { const n = Math.round(p * 100), s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
const crab = x => (x == null ? "—" : Math.round(x).toLocaleString());

const Wof = el => Math.min((el && el.clientWidth) || 680, 980);
async function load(f) { const r = await fetch("data/" + f); if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }
function draw(id, fn) { const el = document.getElementById(id); if (!el) return; try { el.innerHTML = ""; el.append(fn(Wof(el))); } catch (e) { console.error("draw " + id, e); el.innerHTML = "<p class='small'>figure unavailable</p>"; } }
function setText(id, s) { const el = document.getElementById(id); if (el) el.textContent = s; }
function setHTML(id, s) { const el = document.getElementById(id); if (el) el.innerHTML = s; }

/* Observable Plot 0.6.x collapses the main <svg> to 15px when `legend:true` is rendered
   detached (as draw() does) before layout settles. Plot.legend() instead returns an HTML
   swatch <div> that measures fine detached, so we render legends separately and stack them. */
function legendBar(domain, range) { return P.legend({ color: { domain, range }, swatchSize: 12 }); }
function stack(legendNode, plotNode) {
  const d = document.createElement("div");
  if (legendNode) { legendNode.style.margin = "0 0 4px 2px"; d.append(legendNode); }
  d.append(plotNode);
  return d;
}

/* reliability: predicted vs observed, with the y=x line; optional two-period overlay */
function reliabilityChart(series, w, title) {
  const data = series.flatMap(s => s.rel.pred.map((px, i) => ({
    pred: px, obs: s.rel.obs[i], n: s.rel.count[i], grp: s.label })));
  const dom = series.map(s => s.label), rng = series.length > 1 ? [C.hist, C.recent] : [C.oxford];
  const fig = P.plot({
    width: w, height: Math.round(w * 0.62), marginLeft: 46, marginBottom: 40, marginTop: title ? 26 : 10,
    title, style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px", background: "transparent" },
    x: { domain: [0, 1], label: "predicted probability →", tickFormat: "%", grid: true },
    y: { domain: [0, 1], label: "↑ observed frequency", tickFormat: "%", grid: true },
    color: { domain: dom, range: rng },
    marks: [
      P.line([[0, 0], [1, 1]], { stroke: "#b9b2a4", strokeDasharray: "4 4" }),
      P.dot(data, { x: "pred", y: "obs", r: d => 3 + Math.sqrt(d.n) / 3, fill: "grp", fillOpacity: 0.78, stroke: "white", strokeWidth: 0.6 }),
    ],
  });
  return series.length > 1 ? stack(legendBar(dom, rng), fig) : fig;
}

/* discrimination (move-up AUC) by racing day: own-history vs full model */
function aucByDay(ana, w) {
  const order = ["own history", "+ relational"], cr = [C.grey, C.oxford];
  const byday = ana.discrimination.move_up_auc_by_day;
  const data = Object.keys(byday).sort().flatMap(d => [
    { day: "Day " + d, who: "own history", auc: byday[d].base },
    { day: "Day " + d, who: "+ relational", auc: byday[d].relational },
  ]);
  const fig = P.plot({
    width: w, height: Math.round(w * 0.5), marginLeft: 50, marginBottom: 36, marginTop: 10,
    style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
    fx: { label: null }, color: { domain: order, range: cr },
    x: { domain: order, axis: null }, y: { domain: [0.5, 0.9], label: "↑ AUC (move up)", grid: true },
    marks: [
      P.barY(data, { fx: "day", x: "who", y: "auc", fill: "who", rx: 1.5 }),
      P.text(data, { fx: "day", x: "who", y: "auc", text: d => d.auc.toFixed(2), dy: -6, fontSize: 10, fill: C.oxford }),
      P.ruleY([0.5], { stroke: "#c9c1b2", strokeDasharray: "2 3" }),
    ],
  });
  return stack(legendBar(order, cr), fig);
}

function init(acc, bet, ana) {
  const A = acc.periods, ev = A.all.events, S = ana.windows.all.skill, DISC = ana.discrimination, BF = ana.betting_field;
  const champPct = BF.mean_pct_of_champion, topX = Math.max(1, Math.round((1 - BF.mean_percentile) * 100));
  const oracle = bet.decomposition.oracle, oOB = (oracle["+2"] + oracle["+3 or more"]) / (oracle["+1"] + oracle["+2"] + oracle["+3 or more"]);
  const moveUp = ev["move up"], relBaseRps = ana.windows.all.ablation.relational_vs_base.rps,
        relBaseBri = ana.windows.all.ablation.relational_vs_base.brier;

  // ---- abstract ----
  setText("d-n", crab(S.relational.n));
  setText("ab-ece", pctI(moveUp.ece)); setText("ab-slope", f2(moveUp.slope));
  setText("ab-brier", f2(S.relational.brier.mean)); setText("ab-clim", f2(S.climatology.brier.mean));
  setText("ab-rps-skill", pctI(S.relational.rps_skill));
  setText("ab-relbase", `${sgn3(relBaseRps.mean_diff)}, 95% CI ${sgn3(relBaseRps.ci[0])} to ${sgn3(relBaseRps.ci[1])}`);
  setText("ab-pctile", topX + "%"); setText("ab-champ", pctI(champPct));

  // ---- Results §1 calibration & skill ----
  setText("r-n", crab(S.relational.n));
  setText("r-ece", pctI(moveUp.ece)); setText("r-slope", f2(moveUp.slope));
  setText("r-brier", f3(S.relational.brier.mean));
  setText("r-brier-ci", ndash(f3(S.relational.brier.ci[0]), f3(S.relational.brier.ci[1])));
  setText("r-brier-skill", pctI(S.relational.brier_skill));
  setText("r-clim", f3(S.climatology.brier.mean));
  setText("r-rps-skill", pctI(S.relational.rps_skill));
  setText("t-n", crab(S.relational.n));

  // ---- Results §2 relational ablation ----
  setText("r-base-brier", f3(S.base.brier.mean));
  setText("r-base-skill", pctI(S.base.rps_skill));
  setText("r-relbase-rps", `${sgn3(relBaseRps.mean_diff)} (95% CI ${sgn3(relBaseRps.ci[0])} to ${sgn3(relBaseRps.ci[1])}; a ${pctI(relBaseRps.rel_reduction)} relative reduction)`);
  setText("r-relbase-brier", `${sgn3(relBaseBri.mean_diff)} (95% CI ${sgn3(relBaseBri.ci[0])} to ${sgn3(relBaseBri.ci[1])})`);

  // ---- Results §3 discrimination by day ----
  const bd = DISC.move_up_auc_by_day;
  setText("r-auc-d1", f2(bd["1"].relational)); setText("r-auc-d4", f2(bd["4"].relational));
  setText("auc-cap", crab(bd["1"].n));

  // ---- Results §4 market ----
  setText("r-pctile", nth(BF.mean_percentile));
  setText("r-pctile-range", ndash(nth(BF.percentile_range[0]), nth(BF.percentile_range[1])));
  setText("r-topx", topX + "%");
  setText("r-nteams", crab(BF.mean_n_human_teams));
  setText("r-champ", pctI(champPct));
  setText("r-champ-range", ndash(pctI(BF.pct_of_champion_range[0]), pctI(BF.pct_of_champion_range[1])));

  // ---- Results §5 decomposition ----
  setText("r-oracle-ob", pctI(oOB));
  setText("r-ob-rate", pct1(DISC.events["over-bump up (>=+2)"].base_rate));
  setText("r-ob-auc", f2(DISC.events["over-bump up (>=+2)"].auc));

  // ---- Discussion / appendix ----
  setText("d-portfolio", pctI(champPct));
  setHTML("ceiling-note", "All figures and tables regenerate from the primary data by the analysis pipeline; the out-of-sample predictions, the scoring harness and the reconstructed market engine are in the source repository.");
  setText("footer-updated", "Figures regenerate from the primary data; last built " + new Date().getFullYear() + ".");

  // ---- Figure 1: calibration ----
  draw("chart-rel-up", w => reliabilityChart([
    { label: A.historical.label, rel: A.historical.events["move up"].reliability },
    { label: A.recent.label, rel: A.recent.events["move up"].reliability },
  ], w, "Probability of an upward move"));
  setHTML("rel-up-cap", `Across <strong>${crab(A.all.n)}</strong> out-of-sample crew-days the predicted probability of an upward move deviates from observed frequency by <strong>${pctI(moveUp.ece)}</strong> on average, with a calibration slope of <strong>${f2(moveUp.slope)}</strong> (1.0 is ideal).`);

  draw("chart-rel-grid", w => {
    const evs = [["bump (+1)", "single bump"], ["over-bump up (>=+2)", "over-bump (≥+2)"], ["row over", "row-over"]];
    const data = evs.flatMap(([k, lab]) => A.all.events[k].reliability.pred.map((px, i) => ({
      pred: px, obs: A.all.events[k].reliability.obs[i], n: A.all.events[k].reliability.count[i], ev: lab })));
    return P.plot({
      width: w, height: Math.round(w * 0.44), marginLeft: 40, marginBottom: 34,
      style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "11px" },
      fx: { domain: evs.map(e => e[1]), label: null },
      x: { domain: [0, 1], ticks: [0, .5, 1], tickFormat: "%", label: "predicted" },
      y: { domain: [0, 1], ticks: [0, .5, 1], tickFormat: "%", label: "observed" },
      marks: [
        P.line([[0, 0], [1, 1]], { stroke: "#b9b2a4", strokeDasharray: "4 4" }),
        P.dot(data, { fx: "ev", x: "pred", y: "obs", r: d => 2.5 + Math.sqrt(d.n) / 4, fill: C.oxford, fillOpacity: .7, stroke: "white", strokeWidth: .5 }),
      ],
    });
  });

  // ---- Table 1: model × scores (climatology / own history / + relational) ----
  const aucBase = DISC.move_up_auc_overall.base, aucRel = DISC.move_up_auc_overall.relational;
  const brierCI = m => m.brier.ci && m.brier.ci[0] != null ? `<span class="small"> [${f3(m.brier.ci[0])}–${f3(m.brier.ci[1])}]</span>` : "";
  setHTML("acc-table", `<table><thead><tr><th>model</th><th class="num">Brier</th><th class="num">RPS skill</th><th class="num">move-up AUC</th></tr></thead><tbody>
    <tr><td>Climatology (baseline)</td><td class="num">${f3(S.climatology.brier.mean)}</td><td class="num">—</td><td class="num">—</td></tr>
    <tr><td>Own history &amp; seeding</td><td class="num">${f3(S.base.brier.mean)}${brierCI(S.base)}</td><td class="num">+${Math.round(S.base.rps_skill * 100)}%</td><td class="num">${f2(aucBase)}</td></tr>
    <tr><td><strong>+ Relational features</strong></td><td class="num"><strong>${f3(S.relational.brier.mean)}</strong>${brierCI(S.relational)}</td><td class="num"><strong>+${Math.round(S.relational.rps_skill * 100)}%</strong></td><td class="num"><strong>${f2(aucRel)}</strong></td></tr>
    </tbody></table>`);

  // ---- Figure 2: discrimination by day ----
  draw("chart-auc-day", w => aucByDay(ana, w));

  // ---- Figure 3: market outcome by season ----
  draw("chart-betting", w => {
    const order = ["median entrant", "model", "best human"];
    const fill = { "median entrant": C.grey, "model": C.oxford, "best human": C.gold };
    const data = bet.years.flatMap(y => order.map(who => ({
      year: "" + y.year, who, crabs: who === "median entrant" ? y.median_human : who === "model" ? y.model : y.top_human })));
    const orac = bet.years.map(y => ({ year: "" + y.year, oracle: y.oracle }));
    const cr = order.map(o => fill[o]);
    const fig = P.plot({
      width: w, height: Math.round(w * 0.5), marginLeft: 54, marginBottom: 42, marginTop: 26,
      style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
      fx: { label: null }, color: { domain: order, range: cr },
      x: { domain: order, axis: null }, y: { label: "↑ final wealth", grid: true, zero: true },
      marks: [
        P.barY(data, { fx: "year", x: "who", y: "crabs", fill: "who", rx: 1.5 }),
        P.tickY(orac, { fx: "year", y: "oracle", stroke: "#333", strokeWidth: 2, strokeDasharray: "3 2" }),
        P.text(orac.slice(0, 1), { fx: "year", y: d => d.oracle, text: () => "oracle", dy: -7, fontSize: 10, fill: "#333" }),
        P.ruleY([2000], { stroke: "#c9c1b2", strokeDasharray: "2 3" }),
        P.ruleY([0]),
      ],
    });
    return stack(legendBar(order, cr), fig);
  });
  setHTML("betting-cap", `The strategy clears the field median every season and reaches <strong>${pctI(champPct)}</strong> of the best human score on average (range ${ndash(pctI(BF.pct_of_champion_range[0]), pctI(BF.pct_of_champion_range[1]))} across the five seasons), placing it at the <strong>${nth(BF.mean_percentile)}</strong> percentile of the field; it does not exceed the best human in any season, nor approach the oracle.`);

  // ---- Figure 4: return decomposition by move ----
  draw("chart-decomp", w => {
    const order = ["+1", "+2", "+3 or more"], cr = [C.up, C.gold, C.down];
    const data = ["model", "oracle"].flatMap(who => order.map(mv => ({ who, mv, crabs: bet.decomposition[who][mv] || 0 })));
    const fig = P.plot({
      width: w, height: Math.round(w * 0.42), marginLeft: 64, marginBottom: 34, marginTop: 24,
      style: { fontFamily: "Inter, system-ui, sans-serif", fontSize: "12px" },
      fx: { domain: ["model", "oracle"], label: null }, color: { domain: order, range: cr },
      x: { domain: order, axis: null }, y: { label: "↑ return (5 seasons)", grid: true, zero: true },
      marks: [
        P.barY(data, { fx: "who", x: "mv", y: "crabs", fill: "mv", rx: 1.5 }),
        P.ruleY([0]),
      ],
    });
    return stack(legendBar(order, cr), fig);
  });

  // ---- Supplementary tables ----
  setHTML("tab-fp", `<table><thead><tr><th>crew</th><th>when</th><th>model</th><th>result</th><th class="num">lost</th></tr></thead><tbody>${
    bet.lost_confident_misses.map(r => `<tr><td><strong>${r.crew}</strong></td><td>${r.year} d${r.day}</td><td>${Math.round(r.p_bump * 100)}%<br><span class="small">${r.seats} shares</span></td><td>${r.outcome}</td><td class="num bad">−${r.crabs_lost}</td></tr>`).join("")
    }</tbody></table>`);
  setHTML("tab-fn", `<table><thead><tr><th>crew</th><th>when</th><th>model</th><th>moved</th><th class="num">/share</th></tr></thead><tbody>${
    bet.lost_underrated_hits.map(r => `<tr><td><strong>${r.crew}</strong></td><td>${r.year} d${r.day}</td><td>${Math.round(r.p_overbump * 100)}%</td><td><strong style="color:${C.up}">${r.move}</strong></td><td class="num bad">${r.crabs_per_seat}</td></tr>`).join("")
    }</tbody></table>`);
}

(async function () {
  try {
    const [acc, bet, ana] = await Promise.all([load("accuracy.json"), load("betting.json"), load("analysis.json"),
      (document.fonts && document.fonts.ready) || Promise.resolve()]);
    const render = () => init(acc, bet, ana);
    render();
    // Distill lays out its grid asynchronously after this deferred script runs, so the figure
    // containers can still be collapsed at first paint; re-render once the layout has settled.
    requestAnimationFrame(() => requestAnimationFrame(render));
    addEventListener("load", render);
    setTimeout(render, 400);
    addEventListener("resize", () => { clearTimeout(window._rt); window._rt = setTimeout(render, 200); });
  } catch (e) { console.error(e); setHTML("acc-table", "<p class='small'>Could not load the analysis data.</p>"); }
})();
