// Shared plot drawing for the plot page and the tracker.
// The SVG works in metres, north at the top: x runs west → east along the beds,
// y runs north → south. Planting positions (from/to) are metres from the west end.
const SVG_NS = "http://www.w3.org/2000/svg";
const sv = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v);
  }
  for (const c of kids) el.append(c);
  return el;
};

const CROP_COLOURS = {
  "garlic": "#efe4cf",
  "autumn onion sets": "#dcbc5e",
  "broad beans": "#93c27c",
  "strawberries": "#e2784c",
  "winter salads": "#79c7a8",
  "overwintering peas": "#c4d67f",
};
const SPARE_COLOURS = ["#8fc1d9", "#d99fb6", "#e3b375", "#a9a2e0", "#e08f8f", "#b9c98a"];
const COVER_LABEL = { mesh: "Insect mesh", fleece: "Fleece" };

function cropColour(name = "") {
  const key = name.trim().toLowerCase();
  if (CROP_COLOURS[key]) return CROP_COLOURS[key];
  let n = 0;
  for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_COLOURS[n % SPARE_COLOURS.length];
}

// Growing areas keyed by id ("A", "B", "S" for the strawberry row).
function plotAreas(plot) {
  return Object.fromEntries(plot.areas.map((a) => [a.id, { ...a, len: a.w }]));
}

// Plantings that share space are drawn side by side in lanes across the bed.
function layoutLanes(list) {
  const sorted = list.slice().sort((a, b) => a.from - b.from || a.to - b.to);
  const out = new Map();
  let cluster = [], clusterEnd = -Infinity;
  const flush = () => {
    const laneEnds = [];
    for (const p of cluster) {
      let lane = laneEnds.findIndex((end) => end <= p.from + 1e-9);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = p.to;
      out.set(p.id, { lane });
    }
    for (const p of cluster) out.get(p.id).lanes = laneEnds.length;
    cluster = [];
  };
  for (const p of sorted) {
    if (p.from >= clusterEnd - 1e-9 && cluster.length) flush();
    cluster.push(p);
    clusterEnd = cluster.length === 1 ? p.to : Math.max(clusterEnd, p.to);
  }
  if (cluster.length) flush();
  return out;
}

// Rectangle for a planting inside its area, with a small gap so neighbours read as separate.
function plantingRect(area, p, lane = 0, lanes = 1, gap = 0.016) {
  const band = area.h / lanes;
  return { x: area.x + p.from + gap, y: area.y + lane * band + gap, w: p.to - p.from - 2 * gap, h: band - 2 * gap };
}

// Mesh / fleece drawn over a planting.
function coverOverlay(r, cover) {
  if (!COVER_LABEL[cover]) return null;
  return sv("rect", { class: `cover ${cover}`, x: r.x, y: r.y, width: r.w, height: r.h, rx: 0.02, fill: `url(#${cover})`, "pointer-events": "none" });
}

// Draws the plot. `fill(layer, areas)` paints the growing areas; chalk lines,
// labels, pots and dimensions go on top and never catch taps.
function drawPlot(svg, plot, fill) {
  const W = plot.size.w, H = plot.size.h;
  svg.replaceChildren();
  svg.setAttribute("viewBox", "-0.3 -0.58 3.95 4.2");

  svg.append(sv("defs", {},
    sv("pattern", { id: "mesh", width: 0.06, height: 0.06, patternUnits: "userSpaceOnUse" },
      sv("path", { d: "M0 0H.06M0 0V.06", stroke: "#f4eee2", "stroke-width": 0.006, "stroke-opacity": 0.55, fill: "none" })),
    sv("pattern", { id: "fleece", width: 0.12, height: 0.12, patternUnits: "userSpaceOnUse" },
      sv("rect", { width: 0.12, height: 0.12, fill: "#f4eee2", "fill-opacity": 0.14 }),
      sv("circle", { cx: 0.03, cy: 0.03, r: 0.01, fill: "#f4eee2", "fill-opacity": 0.5 }),
      sv("circle", { cx: 0.09, cy: 0.09, r: 0.01, fill: "#f4eee2", "fill-opacity": 0.5 }))));

  // Paving-slab path along the south edge.
  const slabs = sv("g", { "aria-hidden": "true" });
  for (let x = 0; x < W - 0.01; x += 0.6) {
    slabs.append(sv("rect", { x: x + 0.02, y: H + 0.05, width: 0.56, height: 0.4, rx: 0.02, fill: "#2d241d", stroke: "#3d3128", "stroke-width": 0.008 }));
  }
  slabs.append(sv("text", { class: "lbl-dim", x: 0.9, y: H + 0.27, "text-anchor": "middle" }, "paving-slab path"));
  svg.append(slabs);

  const areas = plotAreas(plot);
  const layer = sv("g");
  svg.append(layer);
  fill(layer, areas);

  const top = sv("g", { "pointer-events": "none", "aria-hidden": "true" });
  for (const a of plot.areas) {
    if (a.id === "S") continue;
    top.append(sv("rect", { class: "chalk", x: a.x, y: a.y, width: a.w, height: a.h, rx: 0.02 }));
    top.append(sv("text", { class: "lbl-big", x: a.x + 0.05, y: a.y + 0.15 }, a.id));
  }
  const p = plot.path;
  top.append(sv("text", { class: "lbl-dim", x: p.x + p.w / 2, y: p.y + p.h / 2, "text-anchor": "middle", "dominant-baseline": "middle" }, p.label));
  top.append(sv("rect", { class: "chalk", x: 0, y: 0, width: W, height: H, "stroke-dasharray": ".04 .03" }));

  for (const pot of plot.pots || []) {
    for (let i = 0; i < pot.n; i++) {
      top.append(sv("circle", { cx: pot.x + i * 0.17, cy: pot.y, r: 0.065, fill: "#e3b375", "fill-opacity": 0.2, stroke: "#e3b375", "stroke-width": 0.01, "stroke-dasharray": ".025 .02" }));
    }
    top.append(sv("text", { class: "lbl-dim", x: pot.x + ((pot.n - 1) * 0.17) / 2, y: pot.y + 0.17, "text-anchor": "middle" }, pot.label));
  }

  // North arrow.
  top.append(sv("g", { transform: `translate(${W + 0.32} -0.42)` },
    sv("path", { d: "M0 -.1L.05 .06L0 .03L-.05 .06Z", fill: "#f4eee2" }),
    sv("text", { class: "lbl", x: 0, y: 0.17, "text-anchor": "middle" }, "N")));

  const dim = (x1, y1, x2, y2, text, vertical = false) => {
    const t = 0.04, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    top.append(
      sv("line", { class: "dim", x1, y1, x2, y2 }),
      sv("path", { class: "dim", d: vertical ? `M${x1 - t} ${y1}h${2 * t}M${x2 - t} ${y2}h${2 * t}` : `M${x1} ${y1 - t}v${2 * t}M${x2} ${y2 - t}v${2 * t}` }),
      sv("text", { class: "lbl-dim", "text-anchor": "middle", transform: vertical ? `translate(${mx + 0.09} ${my}) rotate(90)` : `translate(${mx} ${my - 0.03})` }, text));
  };
  dim(0, -0.15, W, -0.15, `${W} m`);
  const [b1, b2] = plot.areas.filter((a) => a.id !== "S").sort((a, b) => a.y - b.y);
  dim(W + 0.14, b1.y, W + 0.14, b1.y + b1.h, `${b1.h} m`, true);
  dim(W + 0.14, p.y, W + 0.14, p.y + p.h, `${Math.round(p.h * 100)} cm`, true);
  dim(W + 0.14, b2.y, W + 0.14, b2.y + b2.h, `${b2.h} m`, true);
  svg.append(top);
  return areas;
}

// A label centred in a block, cut short to fit.
function blockLabel(r, text, cls = "lbl") {
  const max = Math.max(3, Math.floor((r.w - 0.06) / 0.052));
  const t = text.length > max ? text.slice(0, max - 1) + "…" : text;
  return sv("text", { class: cls, x: r.x + r.w / 2, y: r.y + r.h / 2, "text-anchor": "middle", "dominant-baseline": "middle", "pointer-events": "none" }, t);
}

// Tap position in plot metres.
function svgPoint(svg, evt) {
  return new DOMPoint(evt.clientX, evt.clientY).matrixTransform(svg.getScreenCTM().inverse());
}
