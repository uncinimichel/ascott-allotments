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
  initCropSheet();
  renderFacts(s);
  const names = Object.fromEntries(site.catalog.crops.map((c) => [c.id, c.name]));
  renderSuccession(site.succession, names);
  renderPots(site.pots, names);
  initBar();
})();

function renderLayout(site) {
  const plot = site.plot;
  const svg = $("#plan-svg");
  const key = $("#plan-key");
  const rows = [], blocks = [];
  const byId = Object.fromEntries(site.catalog.crops.map((c) => [c.id, c]));
  const plantings = [];
  const select = (i) => {
    blocks.forEach((g, j) => g.setAttribute("aria-pressed", String(i === j)));
    rows.forEach((r, j) => r.classList.toggle("active", i === j));
  };
  const open = (i) => { select(i); openCropSheet(plantings[i], byId); };

  drawPlot(svg, plot, (layer, areas) => {
    for (const area of plot.areas) {
      const mine = site.layout.filter((p) => p.bed === area.id);
      const lanes = layoutLanes(mine);
      for (const p of mine) {
        const { lane, lanes: n } = lanes.get(p.id);
        const r = plantingRect(areas[area.id], p, lane, n);
        const colour = cropColour(p.crop);
        const i = rows.length;
        // The strawberry row also carries the poached egg plant between the plants.
        const extra = (plot.companions || []).filter((c) => c.area === area.id).map((c) => c.catalog);
        plantings.push({ title: `${area.name}: ${p.crop}`, sub: [p.variety, COVER_LABEL[p.cover] && `under ${COVER_LABEL[p.cover].toLowerCase()}`].filter(Boolean).join(" · "),
          where: `${p.from}–${p.to} m from the west end`, note: p.note, ids: [...(p.catalog || []), ...extra] });
        const g = sv("g", { class: "crop", tabindex: 0, role: "button", "aria-pressed": "false", "aria-label": `${area.name}: ${p.crop}`, "data-crops": (p.catalog || []).join(" "),
          onclick: () => open(i),
          onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(i); } } },
          sv("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx: 0.02, fill: colour, "fill-opacity": 0.22 }));
        const cover = coverOverlay(r, p.cover);
        if (cover) g.append(cover);
        if (r.h >= 0.12) g.append(blockLabel(r, p.crop));
        layer.append(g);
        blocks.push(g);
        const sub = [p.variety, COVER_LABEL[p.cover] && `under ${COVER_LABEL[p.cover].toLowerCase()}`].filter(Boolean).join(" · ");
        const row = h("div", { class: "row" },
          h("span", { class: "swatch", style: `background:${colour}`, "aria-hidden": "true" }),
          h("div", {}, h("b", {}, `${area.name}: ${p.crop}`), sub && ` · ${sub}`, h("small", {}, p.note),
            h("button", { class: "link-btn", type: "button", onclick: () => open(i) }, cropLinkText(plantings[i].ids, byId))));
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
  // Pots get a key row too, so their flowers have a way in.
  for (const pot of plot.pots || []) {
    if (!pot.catalog) continue;
    const i = rows.length;
    plantings.push({ title: `Pots: ${byId[pot.catalog].name}`, sub: pot.label, ids: [pot.catalog] });
    const row = h("div", { class: "row" },
      h("span", { class: "swatch", style: "background:#e8a33a", "aria-hidden": "true" }),
      h("div", {}, h("b", {}, `Pots: ${byId[pot.catalog].name}`), ` · ${pot.label}`,
        h("button", { class: "link-btn", type: "button", onclick: () => open(i) }, cropLinkText([pot.catalog], byId))));
    rows.push(row);
    key.append(row);
  }
  $("#plan-note").textContent = plot.note;

  // plot.html?crop=garlic (from the catalogue) highlights that block.
  const want = new URLSearchParams(location.search).get("crop");
  const hit = want && plantings.findIndex((p) => p.ids.includes(want));
  if (hit >= 0) {
    select(hit);
    blocks[hit]?.classList.add("flash");
    requestAnimationFrame(() => svg.scrollIntoView({ block: "center" }));
  }
}

const cropLinkText = (ids, byId) => {
  const names = ids.map((id) => byId[id]?.name).filter(Boolean);
  return names.length > 2 ? `About these ${names.length} crops` : `About ${names.join(" and ").toLowerCase()}`;
};

/* ---------- Crop sheet: photo, months and a link into the catalogue ---------- */
function initCropSheet() {
  const sheet = $("#crop-sheet");
  sheet.querySelector("[data-close]").addEventListener("click", () => sheet.close());
  sheet.addEventListener("click", (e) => { if (e.target === sheet) sheet.close(); });
}

function openCropSheet(p, byId) {
  const sheet = $("#crop-sheet");
  $("#crop-sheet-title").textContent = p.title;
  $("#crop-sheet-sub").textContent = [p.sub, p.where].filter(Boolean).join(" · ");
  const crops = p.ids.map((id) => byId[id]).filter(Boolean);
  $("#crop-sheet-body").replaceChildren(
    p.note && h("p", { class: "view-note" }, p.note),
    ...crops.map((c) => h("article", { class: "crop-card" },
      h("img", { src: cropPhoto(c.id), alt: c.name, loading: "lazy" }),
      h("div", { class: "crop-card-text" },
        h("h4", {}, c.name, c.variety && h("span", {}, ` · ${c.variety}`)),
        h("p", {}, c.about)),
      monthBar(c, { labelled: true }),
      h("a", { class: "btn ghost small", href: `catalog.html#${c.id}` },
        c.varieties?.length > 1 ? `${c.name}: ${c.varieties.length} varieties compared` : `${c.name} in the catalogue`))));
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
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

// Small links under a table cell into the catalogue entries.
const catLinks = (ids, names) => ids?.length && h("span", { class: "cat-links" },
  h("span", { class: "see" }, "In the catalogue:"), ids.map((id) => h("a", { href: `catalog.html#${id}` }, names[id])));

function renderSuccession(list, names) {
  $("#succession").append(
    h("thead", {}, h("tr", {}, h("th", {}, "Now"), h("th", {}, "Then"), h("th", {}, "When"))),
    h("tbody", {}, list.map((r) => h("tr", {}, h("td", {}, r.now), h("td", {}, r.next, catLinks(r.catalog, names)), h("td", { class: "mono" }, r.when)))));
}

function renderPots(list, names) {
  $("#pot-table").append(
    h("thead", {}, h("tr", {}, h("th", {}, "Pot"), h("th", {}, "Where"), h("th", {}, "When"))),
    h("tbody", {}, list.map((r) => h("tr", {}, h("td", {}, r.name, catLinks(r.catalog, names)), h("td", {}, r.where), h("td", { class: "mono" }, r.when)))));
}
