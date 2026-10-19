// Plot page: the planned layout drawn to scale, where the plot is, what comes next.
(async function main() {
  let site;
  try { site = await loadJSON("data/site.json"); }
  catch (err) {
    $("main").prepend(h("p", { class: "empty" }, "The plot data didn't load. Open this page through a web server (see README)."));
    throw err;
  }
  const s = site.site;
  $("#where-lede").textContent = `${s.myPlot.where}. No-dig, about 3 × 3 m.`;
  renderLayout(site);
  renderFacts(s);
  renderSuccession(site.succession);
  renderPots(site.pots);
  initBar();
})();

function renderLayout(site) {
  const plot = site.plot;
  const svg = $("#plan-svg");
  const key = $("#plan-key");
  const rows = [], blocks = [];
  const select = (i) => {
    blocks.forEach((g, j) => g.setAttribute("aria-pressed", String(i === j)));
    rows.forEach((r, j) => r.classList.toggle("active", i === j));
    if (i >= 0) rows[i].scrollIntoView({ block: "nearest" });
  };

  drawPlot(svg, plot, (layer, areas) => {
    for (const area of plot.areas) {
      const mine = site.layout.filter((p) => p.bed === area.id);
      const lanes = layoutLanes(mine);
      for (const p of mine) {
        const { lane, lanes: n } = lanes.get(p.id);
        const r = plantingRect(areas[area.id], p, lane, n);
        const colour = cropColour(p.crop);
        const i = rows.length;
        const g = sv("g", { class: "crop", tabindex: 0, role: "button", "aria-pressed": "false", "aria-label": `${area.name}: ${p.crop}`,
          onclick: () => select(i),
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); } } },
          sv("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx: 0.02, fill: colour, "fill-opacity": 0.22 }));
        const cover = coverOverlay(r, p.cover);
        if (cover) g.append(cover);
        if (r.h >= 0.12) g.append(blockLabel(r, p.crop));
        layer.append(g);
        blocks.push(g);
        const sub = [p.variety, COVER_LABEL[p.cover] && `under ${COVER_LABEL[p.cover].toLowerCase()}`].filter(Boolean).join(" · ");
        const row = h("div", { class: "row" },
          h("span", { class: "swatch", style: `background:${colour}`, "aria-hidden": "true" }),
          h("div", {}, h("b", {}, `${area.name}: ${p.crop}`), sub && ` · ${sub}`, h("small", {}, p.note)));
        rows.push(row);
        key.append(row);
      }
    }
    // Strawberry plants, 35–40 cm apart, with poached egg plant between them at the bean end.
    const S = areas.S;
    const cy = S.y + S.h / 2;
    for (let x = 0.19; x < S.w; x += 0.375) layer.append(sv("circle", { cx: S.x + x, cy, r: 0.04, fill: "#e2784c", "pointer-events": "none" }));
    for (const c of plot.companions || []) {
      for (let x = 0.19 + 0.1875; x < S.w; x += 0.375) if (x > c.from && x < c.to) layer.append(sv("circle", { cx: areas[c.area].x + x, cy, r: 0.03, fill: "#f2d64b", stroke: "#fff", "stroke-width": 0.008, "pointer-events": "none" }));
    }
  });
  $("#plan-note").textContent = plot.note;
}

function renderFacts(s) {
  const fact = (k, v) => [h("dt", {}, k), h("dd", {}, v)];
  $("#site-facts").append(
    ...fact("Plot", `${s.myPlot.name}, ${s.myPlot.where}`),
    ...fact("Water", s.myPlot.water),
    ...fact("Wood chip", s.myPlot.woodChip),
    ...fact("Soil", s.soil),
    ...fact("Run by", [`${s.runBy.name} · `, h("span", { class: "mono" }, s.runBy.email)]),
    ...fact("Trading hut", h("a", { href: "shopping.html#huts" }, "Opening times and membership")));
}

function renderSuccession(list) {
  $("#succession").append(
    h("thead", {}, h("tr", {}, h("th", {}, "Now"), h("th", {}, "Then"), h("th", {}, "When"))),
    h("tbody", {}, list.map((r) => h("tr", {}, h("td", {}, r.now), h("td", {}, r.next), h("td", { class: "mono" }, r.when)))));
}

function renderPots(list) {
  $("#pot-table").append(
    h("thead", {}, h("tr", {}, h("th", {}, "Pot"), h("th", {}, "Where"), h("th", {}, "When"))),
    h("tbody", {}, list.map((r) => h("tr", {}, h("td", {}, r.name), h("td", {}, r.where), h("td", { class: "mono" }, r.when)))));
}
