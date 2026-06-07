/* Accuracy & betting report — Oxford Summer Eights bump model.
   Loads accuracy.json + betting.json (leak-free walk-forward) and draws with Observable
   Plot. Calibration reliability, Brier by day, the Fantasy-Bumps backtest vs humans and the
   oracle, the over-bump return split, and the two honest "where it lost money" tables. */
const P = window.Plot;
const C = { up: "#1a7f57", down: "#c0392b", oxford: "#002147", oxford2: "#1b3a63",
            gold: "#b8893b", grey: "#9a9182", line: "#e3dccf", hist: "#1b3a63", recent: "#b8893b" };
const pct = x => (x == null || isNaN(x) ? "—" : Math.round(x * 100) + "%");
const crab = x => (x == null ? "—" : Math.round(x).toLocaleString() + " 🦀");
const Wof = el => Math.min((el && el.clientWidth) || 680, 980);
async function load(f) { const r = await fetch("data/" + f); if (!r.ok) throw new Error(f + " " + r.status); return r.json(); }
function draw(id, fn) { const el = document.getElementById(id); if (!el) return; try { el.innerHTML = ""; el.append(fn(Wof(el))); } catch (e) { console.error("draw " + id, e); el.innerHTML = "<p class='small'>chart unavailable</p>"; } }
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
    title, style: { fontFamily: "Inter, sans-serif", fontSize: "12px", background: "transparent" },
    x: { domain: [0, 1], label: "model's predicted chance →", tickFormat: "%", grid: true },
    y: { domain: [0, 1], label: "↑ how often it happened", tickFormat: "%", grid: true },
    color: { domain: dom, range: rng },
    marks: [
      P.line([[0, 0], [1, 1]], { stroke: "#b9b2a4", strokeDasharray: "4 4" }),
      P.dot(data, { x: "pred", y: "obs", r: d => 3 + Math.sqrt(d.n) / 3, fill: "grp", fillOpacity: 0.78, stroke: "white", strokeWidth: 0.6 }),
    ],
  });
  return series.length > 1 ? stack(legendBar(dom, rng), fig) : fig;
}

function init(acc, bet) {
  const A = acc.periods, ev = A.all.events;
  // ---- KPI cards ----
  const champPct = Math.round(bet.mean_pct_of_champion * 100);
  const meanPctile = bet.years.reduce((s, y) => s + y.percentile_in_field, 0) / bet.years.length;
  const topX = Math.max(1, Math.round((1 - meanPctile) * 100));
  const kpis = [
    { big: (+A.all.brier).toFixed(2), lab: "Brier score", sub: `vs ${(+A.all.brier_climatology).toFixed(2)} for guessing the base rate · ${A.all.n.toLocaleString()} unseen crew-days` },
    { big: "±" + Math.round(ev["move up"].ece * 100) + "%", lab: "calibration error", sub: "average gap between a stated chance and what happened" },
    { big: "top " + topX + "%", lab: "as a Fantasy Bumps bettor", sub: `beats ~${Math.round(meanPctile * 100)}% of human players` },
    { big: champPct + "%", lab: "of the champion's score", sub: "strong, but can't beat the single best human" },
  ];
  setHTML("kpis", kpis.map(k => `<div class="kpi"><div class="kpi-big">${k.big}</div><div class="kpi-lab">${k.lab}</div><div class="kpi-sub">${k.sub}</div></div>`).join(""));
  // inline figures in the abstract / data / results prose
  setText("ab-brier", (+A.all.brier).toFixed(2)); setText("ab-clim", (+A.all.brier_climatology).toFixed(2));
  setText("ab-ece", "~" + pct(ev["move up"].ece)); setText("ab-champ", champPct + "%");
  setText("ab-decile", topX + "%"); setText("d-n", A.all.n.toLocaleString());
  setText("r-champ", champPct + "%");

  // ---- calibration: move-up, historical vs recent overlaid ----
  draw("chart-rel-up", w => reliabilityChart([
    { label: A.historical.label, rel: A.historical.events["move up"].reliability },
    { label: A.recent.label, rel: A.recent.events["move up"].reliability },
  ], w, "Chance of moving up the river"));
  setHTML("rel-up-cap", `The headline event — any move up. Across <strong>${A.all.n.toLocaleString()}</strong> crew-days the model never saw, its move-up probabilities are off by an average of <strong>${pct(ev["move up"].ece)}</strong>, and the slope is <strong>${ev["move up"].slope}</strong> (1.0 is perfect; below 1 would mean over-confident).`);

  // ---- calibration: small multiples for the other events (recent period) ----
  draw("chart-rel-grid", w => {
    const evs = [["bump (+1)", "single bump"], ["over-bump up (>=+2)", "over-bump (+2 or more)"], ["row over", "row over"]];
    const data = evs.flatMap(([k, lab]) => A.all.events[k].reliability.pred.map((px, i) => ({
      pred: px, obs: A.all.events[k].reliability.obs[i], n: A.all.events[k].reliability.count[i], ev: lab })));
    return P.plot({
      width: w, height: Math.round(w * 0.44), marginLeft: 40, marginBottom: 34,
      style: { fontFamily: "Inter, sans-serif", fontSize: "11px" },
      fx: { domain: evs.map(e => e[1]), label: null },
      x: { domain: [0, 1], ticks: [0, .5, 1], tickFormat: "%", label: "predicted" },
      y: { domain: [0, 1], ticks: [0, .5, 1], tickFormat: "%", label: "actual" },
      marks: [
        P.line([[0, 0], [1, 1]], { stroke: "#b9b2a4", strokeDasharray: "4 4" }),
        P.dot(data, { fx: "ev", x: "pred", y: "obs", r: d => 2.5 + Math.sqrt(d.n) / 4, fill: C.oxford, fillOpacity: .7, stroke: "white", strokeWidth: .5 }),
      ],
    });
  });

  // ---- accuracy table: historical vs recent ----
  const rows = [["historical", A.historical], ["recent", A.recent]];
  setHTML("acc-table", `<table><thead><tr><th>window</th><th>crew-days</th><th>Brier</th><th>vs climatology</th><th>RPS</th><th>RPS skill</th></tr></thead><tbody>${
    rows.map(([_, m]) => `<tr><td><strong>${m.label}</strong></td><td>${m.n.toLocaleString()}</td><td class="num">${(+m.brier).toFixed(3)}</td><td class="num">${(+m.brier_climatology).toFixed(3)}</td><td class="num">${(+m.rps).toFixed(3)}</td><td class="num">${"+" + Math.round(m.rps_skill * 100)}%</td></tr>`).join("")
    }</tbody></table>`);

  // ---- Brier by day (recent) ----
  draw("chart-byday", w => {
    const d = Object.entries(A.recent.by_day).map(([day, v]) => ({ day: "Day " + day, brier: v.brier }));
    return P.plot({
      width: w, height: Math.round(w * 0.4), marginLeft: 50, marginBottom: 34,
      style: { fontFamily: "Inter, sans-serif", fontSize: "12px" },
      x: { label: null }, y: { label: "↓ Brier (error)", grid: true, zero: true },
      marks: [
        P.barY(d, { x: "day", y: "brier", fill: C.oxford, fillOpacity: .9, rx: 2 }),
        P.text(d, { x: "day", y: "brier", text: d => d.brier.toFixed(3), dy: -7, fontSize: 11, fill: C.oxford }),
        P.ruleY([0]),
      ],
    });
  });

  // ---- betting: per year, median / model / top human + oracle dash ----
  setText("bet-mean", champPct + "%");
  draw("chart-betting", w => {
    const order = ["median human", "model", "top human"];
    const fill = { "median human": C.grey, "model": C.oxford, "top human": C.gold };
    const data = bet.years.flatMap(y => order.map(who => ({
      year: "" + y.year, who, crabs: who === "median human" ? y.median_human : who === "model" ? y.model : y.top_human })));
    const orac = bet.years.map(y => ({ year: "" + y.year, oracle: y.oracle }));
    const cr = order.map(o => fill[o]);
    const fig = P.plot({
      width: w, height: Math.round(w * 0.5), marginLeft: 50, marginBottom: 42, marginTop: 26,
      style: { fontFamily: "Inter, sans-serif", fontSize: "12px" },
      fx: { label: null }, color: { domain: order, range: cr },
      x: { domain: order, axis: null }, y: { label: "↑ final crabs", grid: true, zero: true },
      marks: [
        P.barY(data, { fx: "year", x: "who", y: "crabs", fill: "who", rx: 1.5 }),
        P.tickY(orac, { fx: "year", y: "oracle", stroke: "#333", strokeWidth: 2, strokeDasharray: "3 2" }),
        P.text(orac.slice(0, 1), { fx: "year", y: d => d.oracle, text: () => "oracle", dy: -7, dx: 0, fontSize: 10, fill: "#333" }),
        P.ruleY([2000], { stroke: "#c9c1b2", strokeDasharray: "2 3" }),
        P.ruleY([0]),
      ],
    });
    return stack(legendBar(order, cr), fig);
  });
  setHTML("betting-cap", `Final crabs each season for the typical player, the model, and the best human, with the perfect-foresight oracle dashed. Everyone starts at 2,000 (lower dotted line). The model clears the field median every year and reaches <strong>${champPct}%</strong> of the champion on average — about the <strong>top ${topX}%</strong> of the ${bet.years[bet.years.length - 1].n_human_teams.toLocaleString()}-odd entrants.`);

  // ---- decomposition: model vs oracle by move ----
  draw("chart-decomp", w => {
    const order = ["+1", "+2", "+3 or more"];
    const data = ["model", "oracle"].flatMap(who => order.map(mv => ({ who, mv, crabs: bet.decomposition[who][mv] || 0 })));
    const cr = [C.up, C.gold, C.down];
    const fig = P.plot({
      width: w, height: Math.round(w * 0.42), marginLeft: 64, marginBottom: 34, marginTop: 24,
      style: { fontFamily: "Inter, sans-serif", fontSize: "12px" },
      fx: { domain: ["model", "oracle"], label: null }, color: { domain: order, range: cr },
      x: { domain: order, axis: null }, y: { label: "↑ crabs earned (5 seasons)", grid: true, zero: true },
      marks: [
        P.barY(data, { fx: "who", x: "mv", y: "crabs", fill: "mv", rx: 1.5 }),
        P.ruleY([0]),
      ],
    });
    return stack(legendBar(order, cr), fig);
  });

  // ---- the two honest tables ----
  setHTML("tab-fp", `<table><thead><tr><th>crew</th><th>when</th><th>model</th><th>happened</th><th class="num">lost</th></tr></thead><tbody>${
    bet.lost_confident_misses.map(r => `<tr><td><strong>${r.crew}</strong></td><td>${r.year} · day ${r.day}</td><td>${Math.round(r.p_bump * 100)}% to bump<br><span class="small">${r.seats} shares</span></td><td>${r.outcome}</td><td class="num bad">−${r.crabs_lost}</td></tr>`).join("")
    }</tbody></table>`);
  setHTML("tab-fn", `<table><thead><tr><th>crew</th><th>when</th><th>model said</th><th>did</th><th class="num">/share</th></tr></thead><tbody>${
    bet.lost_underrated_hits.map(r => `<tr><td><strong>${r.crew}</strong></td><td>${r.year} · day ${r.day}</td><td>${Math.round(r.p_overbump * 100)}% over-bump</td><td><strong style="color:${C.up}">${r.move}</strong></td><td class="num bad">${r.crabs_per_seat}</td></tr>`).join("")
    }</tbody></table>`);
  setHTML("ceiling-note", "<strong>The ceiling.</strong> " + bet.ceiling_note);
  setText("footer-updated", "Model and figures regenerate from the raw data; last built " + new Date().getFullYear() + ".");
}

(async function () {
  try {
    const [acc, bet] = await Promise.all([load("accuracy.json"), load("betting.json"),
      (document.fonts && document.fonts.ready) || Promise.resolve()]);
    init(acc, bet);
    addEventListener("resize", () => { clearTimeout(window._rt); window._rt = setTimeout(() => init(acc, bet), 200); });
  } catch (e) { console.error(e); setHTML("kpis", "<p class='small'>Could not load the model data.</p>"); }
})();
