// Shared plot drawing for the clearing page and the tracker.
// The SVG works in metres: x across the plot, y along the beds (top to bottom).
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
  "cardboard": "#b08a5a",
};
const SPARE_COLOURS = ["#8fc1d9", "#d99fb6", "#c4d67f", "#e3b375", "#a9a2e0", "#79c7a8", "#e08f8f"];

function cropColour(name = "") {
  const key = name.trim().toLowerCase();
  if (CROP_COLOURS[key]) return CROP_COLOURS[key];
  let n = 0;
  for (const ch of key) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return SPARE_COLOURS[n % SPARE_COLOURS.length];
}

// Growing areas keyed by bed id; "S" is the strawberry row.
function plotAreas(plot) {
  const st = plot.strawberries;
  const areas = { S: { id: "S", name: st.label, x: st.x, y: 0, w: st.w, h: plot.size.h } };
  for (const b of plot.beds) areas[b.id] = { id: b.id, name: b.name, x: b.x, y: b.y, w: b.w, h: b.h };
  return areas;
}

// Draws the plot. `fill(layer, areas)` paints the growing areas; chalk lines,
// labels and dimensions go on top and never catch taps.
function drawPlot(svg, plot, fill) {
  const W = plot.size.w, H = plot.size.h;
  svg.replaceChildren();
  svg.setAttribute("viewBox", "-0.62 -0.36 4.05 3.78");

  // Paving-slab path outside the plot, on the strawberry side.
  const slabs = sv("g", { "aria-hidden": "true" });
  for (let y = 0; y < H - 0.01; y += 0.6) {
    slabs.append(sv("rect", { x: -0.42, y: y + 0.02, width: 0.38, height: 0.56, rx: 0.02, fill: "#2d241d", stroke: "#3d3128", "stroke-width": 0.008 }));
  }
  slabs.append(sv("text", { class: "lbl-dim", transform: `translate(-0.5 ${H / 2}) rotate(-90)`, "text-anchor": "middle" }, "paving-slab path"));
  svg.append(slabs);

  const areas = plotAreas(plot);
  const layer = sv("g");
  svg.append(layer);
  fill(layer, areas);

  const top = sv("g", { "pointer-events": "none", "aria-hidden": "true" });
  for (const bed of plot.beds) {
    top.append(sv("rect", { class: "chalk", x: bed.x, y: bed.y, width: bed.w, height: bed.h, rx: 0.02 }));
    top.append(sv("text", { class: "lbl-big", x: bed.x + 0.06, y: bed.y + 0.16 }, bed.id));
  }
  const p = plot.path;
  top.append(sv("text", { class: "lbl-dim", transform: `translate(${p.x + p.w / 2 + 0.025} ${H / 2}) rotate(-90)`, "text-anchor": "middle" }, "path"));
  top.append(sv("rect", { class: "chalk", x: 0, y: 0, width: W, height: H, "stroke-dasharray": ".04 .03" }));

  const dim = (x1, y1, x2, y2, text, vertical = false) => {
    const t = 0.05, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    top.append(
      sv("line", { class: "dim", x1, y1, x2, y2 }),
      sv("path", { class: "dim", d: vertical ? `M${x1 - t} ${y1}h${2 * t}M${x2 - t} ${y2}h${2 * t}` : `M${x1} ${y1 - t}v${2 * t}M${x2} ${y2 - t}v${2 * t}` }),
      sv("text", { class: "lbl-dim", "text-anchor": "middle", transform: vertical ? `translate(${mx + 0.1} ${my}) rotate(90)` : `translate(${mx} ${my - 0.035})` }, text));
  };
  dim(0, -0.18, W, -0.18, `${W} m`);
  dim(W + 0.18, 0, W + 0.18, H, `${H} m`, true);
  const A = plot.beds[0];
  dim(A.x, H + 0.16, A.x + A.w, H + 0.16, `${A.w} m`);
  dim(p.x, H + 0.16, p.x + p.w, H + 0.16, `${Math.round(p.w * 100)} cm`);
  svg.append(top);
  return areas;
}

// A label centred in a block; turned sideways when the block is a narrow strip.
function blockLabel(x, y, w, h, text, cls = "lbl") {
  const cx = x + w / 2, cy = y + h / 2;
  return sv("text", {
    class: cls, "text-anchor": "middle", "dominant-baseline": "middle", "pointer-events": "none",
    transform: w < 0.3 ? `translate(${cx} ${cy}) rotate(-90)` : `translate(${cx} ${cy})`,
  }, text);
}

// Tap position in plot metres.
function svgPoint(svg, evt) {
  return new DOMPoint(evt.clientX, evt.clientY).matrixTransform(svg.getScreenCTM().inverse());
}
