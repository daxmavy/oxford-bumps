/* chart_forward prototype — predictions-led, annotated charts carry the story.
   Loads ../data/*.json. Defensive: a missing block leaves its section blank. */
const P = window.Plot;
const C = { up:"#1a7f57", down:"#c0392b", row:"#a99f8c", oxford:"#002147", gold:"#b8893b", muted:"#6b6357" };
const pct = x => (x == null ? "—" : Math.round(x * 100) + "%");
const W = el => Math.min(el.clientWidth || 640, 920);

async function load(f){ const r = await fetch("../data/" + f); if(!r.ok) throw new Error(f); return r.json(); }
function draw(id, fn){
  const el = document.getElementById(id); if(!el) return;
  try { el.innerHTML = ""; el.append(fn(W(el))); }
  catch(e){ console.error(id, e); }
}

(async function(){
  let h2h, preds, stats, extras;
  try { [h2h, preds, stats, extras] = await Promise.all([
    load("headtohead_2026.json"), load("predictions.json"), load("stats.json"), load("extras.json")
  ]); } catch(e){ console.error("data load failed", e); return; }

  /* ===================== HERO: head-to-head bump board ===================== */
  const dl = h2h.day_label || preds.day_label || "Friday";
  const dlShort = dl.split(" ")[0];
  document.getElementById("day-label").textContent = dlShort;

  let g = "men";
  const tabs = document.querySelectorAll(".tab");
  tabs.forEach(t => t.onclick = () => {
    tabs.forEach(x => x.classList.remove("active")); t.classList.add("active");
    g = t.dataset.g; renderBoard();
  });

  // join predictions (blades flags, completion prob) onto the head-to-head rows by college+boat
  const predIndex = {};
  for (const side of ["men","women"]) (preds[side]||[]).forEach(r => {
    predIndex[side + "|" + r.college + "|" + r.boat] = r;
  });

  function factorWeight(rows){
    // sum |logodds| per factor across all crews, to size the legend / sanity
    return rows;
  }

  function renderBoard(){
    const rows = (h2h[g] || []).filter(r => r.division === 1 || r.cur_pos === 1 || (r.cur_pos && r.cur_pos <= 12));
    // Division 1 is the showcase: top 12 (men) — keep it tight and legible.
    const div1 = (h2h[g] || []).slice().sort((a,b)=>a.cur_pos-b.cur_pos).filter(r => r.cur_pos <= 12);
    const board = document.getElementById("board");
    board.innerHTML = div1.map((r, i) => {
      const isHead = !r.chasing;
      const p = r.p_bump || 0;
      const pr = predIndex[g + "|" + r.college + "|" + r.boat] || {};
      const onBlades = pr.on_for_blades;
      const name = r.college + (r.boat > 1 ? " " + r.boat : "");
      const track = isHead
        ? `<div class="track head"><span class="headlbl">Head of the river</span></div>`
        : `<div class="track"><span class="fill" style="width:${Math.max(2,Math.round(p*100))}%"></span></div>`;
      const chase = isHead ? `<span class="chase">leads</span>`
        : `<span class="chase"><span class="arr">↑</span> ${r.chasing}</span>`;
      return `
      <div class="brow${onBlades ? " blades":""}" data-i="${i}" role="button" tabindex="0">
        <div class="pos">${r.cur_pos}</div>
        <div class="name"><b>${name}</b> ${chase}</div>
        ${track}
        <div class="pct">${isHead ? "—" : pct(p)}</div>
      </div>
      <div class="attr" data-attr="${i}">${attrHTML(r)}</div>`;
    }).join("");

    // expand / collapse
    board.querySelectorAll(".brow").forEach(row => {
      const toggle = () => {
        const wasOpen = row.classList.contains("open");
        board.querySelectorAll(".brow").forEach(x => x.classList.remove("open"));
        if (!wasOpen) row.classList.add("open");
      };
      row.onclick = toggle;
      row.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
    });

    renderBlades();
  }

  function attrHTML(r){
    if (!r.chasing) return `<p class="why">As the lead crew, ${r.college} has no boat to chase — only its own to defend.</p>`;
    const contribs = Array.isArray(r.contributions) ? r.contributions.slice() : [];
    if (!contribs.length) return `<p class="why">Near-even matchup; no single factor dominates.</p>`;
    contribs.sort((a,b)=>Math.abs(b.logodds)-Math.abs(a.logodds));
    const maxAbs = Math.max(1, ...contribs.map(c => Math.abs(c.logodds)));
    const lead = contribs[0];
    const dir = lead.logodds > 0 ? "favours the bump" : "weighs against it";
    const bars = contribs.map(c => {
      const w = Math.min(48, Math.abs(c.logodds)/maxAbs*48); // % of half-width
      const pos = c.logodds > 0;
      const valTxt = (c.logodds>0?"+":"") + c.logodds.toFixed(1);
      return `<div class="fbar">
        <div class="flab">${c.factor}</div>
        <div class="ftrack">
          <div class="axis"></div>
          <div class="seg ${pos?"pos":"neg"}" style="width:${w}%"></div>
          <div class="val" style="${pos?`left:calc(50% + ${w}% + 6px)`:`right:calc(50% + ${w}% + 6px)`}">${valTxt}</div>
        </div>
      </div>`;
    }).join("");
    return `
      <p class="why"><b>${r.college}${r.boat>1?" "+r.boat:""}</b> → ${r.chasing}: ${pct(r.p_bump)} to bump.
        Biggest lever: <b>${lead.factor}</b>, which ${dir}.</p>
      ${bars}
      <div class="scale"><div></div><div class="scaleinner"><span>← weighs against</span><span>log-odds</span><span>favours bump →</span></div></div>`;
  }

  function renderBlades(){
    const el = document.getElementById("blades");
    const rows = (preds[g] || []).filter(r => r.on_for_blades)
      .sort((a,b)=>(b.p_complete_blades||0)-(a.p_complete_blades||0)).slice(0, 8);
    if (!rows.length){ el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<div class="bt">◇ Still on for blades · bumped all ${preds.as_of_day} days</div>
      <div class="blades-grid">` +
      rows.map(r => `<div class="bchip"><b>${r.college}${r.boat>1?" "+r.boat:""}</b>
        <span class="p">${pct(r.p_complete_blades)}</span></div>`).join("") +
      `</div><p class="small" style="margin:.7em 0 0">Chance of completing all four (a bump every day).</p>`;
  }

  renderBoard();

  /* ===================== FINDING 1: per-day predictability ===================== */
  if (extras.per_day){
    const d = extras.per_day, DAY = {1:"Wed",2:"Thu",3:"Fri",4:"Sat"};
    draw("chart-perday", w => P.plot({
      width: w, height: 300, marginLeft: 52, marginBottom: 40, marginRight: 18,
      x: { label: null, domain: [1,2,3,4], tickFormat: v => DAY[v]||v },
      y: { label: "↑ predictability (AUC)", grid: true, domain: [0.5, 0.88], tickFormat: ".2f" },
      marks: [
        P.ruleY([0.5], { stroke: C.row, strokeDasharray: "3 3" }),
        P.text([{}], { x: 4, y: 0.5, text: ["coin toss"], dy: 12, fill: C.row, fontSize: 11, textAnchor: "end" }),
        P.areaY(d, { x: "day", y1: 0.5, y2: "auc_bump", fill: C.oxford, fillOpacity: .07, curve: "monotone-x" }),
        P.line(d, { x: "day", y: "auc_bump", stroke: C.oxford, strokeWidth: 2.6, curve: "monotone-x" }),
        P.dot(d, { x: "day", y: "auc_bump", fill: C.oxford, r: 5 }),
        P.text(d, { x: "day", y: "auc_bump", text: v => v.auc_bump.toFixed(2), dy: -14, fontSize: 13, fontWeight: 700, fill: C.oxford }),
        P.text([d[0]], { x: 1, y: d[0].auc_bump, text: ["nobody has\nshown their hand"], dy: 26, dx: 4, fontSize: 11, fill: C.muted, textAnchor: "start", lineHeight: 1.1 }),
        P.text([d[3]], { x: 4, y: d[3].auc_bump, text: ["the week has\nsorted itself out"], dy: -6, dx: -2, fontSize: 11, fill: C.muted, textAnchor: "end", lineHeight: 1.1 }),
      ],
    }));
  }

  /* ===================== FINDING 2a: luck floor vs reality ===================== */
  const ls = (stats.reconciled || {}).luck_skill || stats.luck_skill;
  if (ls){
    const data = [
      { k: "If every crew were equal", v: ls.blades_rate_pure_luck_floor, c: C.row },
      { k: "What actually happens", v: ls.blades_rate_observed, c: C.gold },
    ];
    draw("chart-luck", w => P.plot({
      width: w, height: 320, marginLeft: 50, marginBottom: 44, marginRight: 16,
      x: { label: null, domain: data.map(d => d.k), tickSize: 0 },
      y: { label: "↑ crews winning blades", grid: true,
           domain: [0, Math.max(0.1, ls.blades_rate_observed * 1.3)],
           tickFormat: d => Math.round(d * 100) + "%" },
      marks: [
        P.barY(data, { x: "k", y: "v", fill: "c", rx: 3 }),
        P.text(data, { x: "k", y: "v",
          text: d => d.v < 0.02 ? (d.v*100).toFixed(1) + "%" : Math.round(d.v*100)+"%",
          dy: -10, fontSize: 16, fontWeight: 800, fill: d => d.c }),
        P.ruleY([0]),
      ],
    }));
  }

  /* ===================== FINDING 2b: blades by division ===================== */
  if (stats.blades_by_division){
    const bd = stats.blades_by_division;
    const overall = (stats.stickiness||{}).blades_rate || 0.085;
    const ymax = Math.max(...bd.map(d=>d.blades_rate)) * 1.45;
    draw("chart-blades-div", w => P.plot({
      width: w, height: 320, marginLeft: 50, marginBottom: 44, marginRight: 16,
      x: { label: "starting division →", tickFormat: d => "" + d, tickSize: 0 },
      y: { label: "↑ share winning blades", grid: true, domain: [0, ymax],
           tickFormat: d => Math.round(d * 100) + "%" },
      marks: [
        P.barY(bd, { x: "division", y: "blades_rate",
          fill: d => d.division === 1 ? C.oxford : C.gold, rx: 3,
          fillOpacity: d => d.division === 1 ? 1 : .9 }),
        P.ruleY([overall], { stroke: C.down, strokeDasharray: "4 3" }),
        P.text([{}], { x: 7, y: overall, text: ["all crews"], dy: -7, fill: C.down, fontSize: 10.5, textAnchor: "end" }),
        P.text([bd[0]], { x: 1, y: bd[0].blades_rate, text: ["rarest\nat the top"], dy: -12, fontSize: 11, fill: C.oxford, fontWeight: 600, lineHeight: 1.05 }),
        P.ruleY([0]),
      ],
    }));
  }

  /* ===================== FINDING 3: factor effects forest ===================== */
  if (stats.effects){
    const short = {
      "n_blues (+1 Blue-Boat rower)": "Each Oxford Blue in the boat",
      "tor_net (same-year Torpids)": "Each place gained at Torpids",
      "prev_net_places (last year)": "Each place gained last year",
      "same_coach (continuity)": "Same coach as last year",
    };
    const eff = stats.effects.filter(e => !/rain|warmth|tmax|weather/i.test(e.term))
      .map(e => ({ ...e, label: short[e.term] || e.term, sig: (e.lo > 0 || e.hi < 0) }))
      .sort((a,b)=>a.coef-b.coef);
    draw("chart-effects", w => P.plot({
      width: w, height: 250, marginLeft: 196, marginBottom: 42, marginRight: 56,
      x: { label: "extra places gained over a regatta →", grid: true, zero: true },
      y: { label: null, domain: eff.map(d => d.label) },
      marks: [
        P.ruleX([0], { stroke: "#000", strokeDasharray: "3 3", strokeOpacity: .45 }),
        P.link(eff, { y: "label", x1: "lo", x2: "hi", stroke: d => d.sig ? C.oxford : C.muted, strokeWidth: 2 }),
        P.dot(eff, { y: "label", x: "coef", fill: d => d.sig ? C.oxford : C.muted, r: 5.5 }),
        P.text(eff, { y: "label", x: "hi", text: d => (d.coef>0?"+":"")+d.coef, dx: 12, fontSize: 12, fontWeight: 600, fill: "#444" }),
        P.text([eff.find(e=>!e.sig)].filter(Boolean), { y: "label", x: "lo", text: ["not distinguishable\nfrom zero"], dx: -8, dy: -2, fontSize: 10, fill: C.muted, textAnchor: "end", lineHeight: 1.05 }),
      ],
    }));
  }

  const fu = document.getElementById("footer-updated");
  if (fu) fu.textContent = `Predictions generated after day ${preds.as_of_day} of ${preds.event}.`;
})();
