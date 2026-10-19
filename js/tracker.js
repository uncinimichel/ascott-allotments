// Tracker: an interactive plot plan, beds, plantings and a weekly log.
// Saved in localStorage; the first visit seeds from the layout in data/site.json.
const KEY = "ascott.garden";
const STEP = 0.25; // positions snap to 25 cm along a bed
const STATUS_LABEL = { planned: "Planned", growing: "Growing", ready: "Ready to harvest" };
const COMMON_CROPS = ["Garlic", "Autumn onion sets", "Broad beans", "Shallots", "Spring onions", "Leeks", "Lettuce",
  "Spinach", "Chard", "Kale", "Cabbage", "Purple sprouting broccoli", "Beetroot", "Carrots", "Parsnips", "Radish",
  "Peas", "Runner beans", "French beans", "Courgettes", "Squash", "Tomatoes", "Potatoes", "Strawberries"];

let garden, site, plot, areas;
let current = null;       // planting shown in the sheet
let editingId = null;     // planting being edited; null while adding
let removeTimer = null;

(async function main() {
  try { site = await loadJSON("data/site.json"); plot = site.plot; }
  catch (err) {
    $("main").prepend(h("p", { class: "empty" }, "The plot layout didn't load. Open this page through a web server (see README)."));
    throw err;
  }
  areas = plotAreas(plot);
  garden = store.get(KEY, null) ?? seedGarden();
  migrate(garden);
  save();
  wire();
  render();
  initBar();
})();

function save() { store.set(KEY, garden); }

/* ---------- Data helpers ---------- */
const bedById = (id) => garden.beds.find((b) => b.id === id);
const bedLength = (id) => areas[id]?.len ?? 3;
const plantingsIn = (bed, except) => garden.plantings
  .filter((p) => p.bed === bed && p.id !== except && typeof p.from === "number")
  .sort((a, b) => a.from - b.from);
const overlapping = (bed, from, to, except) => plantingsIn(bed, except).filter((p) => from < p.to && to > p.from);
const snap = (v) => Math.round(v / STEP) * STEP;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const metres = (v) => `${+v.toFixed(2)}`;
const span = (p) => `${metres(p.from)}–${metres(p.to)} m`;

function freeGaps(bed, except) {
  const gaps = [];
  let at = 0;
  for (const p of plantingsIn(bed, except)) {
    if (p.from > at) gaps.push([at, p.from]);
    at = Math.max(at, p.to);
  }
  if (at < bedLength(bed)) gaps.push([at, bedLength(bed)]);
  return gaps;
}

// A sensible spot for a new planting: about 1 m, inside the free space you tapped.
function spotFor(bed, tapX, except) {
  const gaps = freeGaps(bed, except);
  if (gaps.length === 0) return [0, Math.min(1, bedLength(bed))];
  const gap = tapX == null ? (gaps.find(([a, b]) => b - a >= 1) || gaps[0])
    : (gaps.find(([a, b]) => tapX >= a && tapX <= b) || gaps[0]);
  const len = Math.max(STEP, Math.min(1, Math.floor((gap[1] - gap[0]) / STEP) * STEP));
  const centre = tapX == null ? gap[0] + len / 2 : tapX;
  const from = clamp(snap(centre - len / 2), gap[0], gap[1] - len);
  return [from, from + len];
}

// The bed with the most free space, so "Add planting" never starts on top of something.
function roomiestBed() {
  const free = (bed) => Math.max(0, ...freeGaps(bed.id).map(([a, b]) => b - a));
  const beds = garden.beds.filter((b) => b.id !== "S");
  return (beds.length ? beds : garden.beds).reduce((best, b) => (free(b) > free(best) ? b : best)).id;
}

function status(p) {
  const inGround = p.sown || p.planted || p.inGround;
  if (inGround && p.harvest && p.harvest <= todayISO().slice(0, 7)) return "ready";
  return inGround ? "growing" : "planned";
}

function seedGarden() {
  return {
    version: 3,
    beds: plot.areas.map((a) => ({ id: a.id, name: a.name, size: a.id === "S" ? "3 m along the slab path" : `${a.h} × ${a.w} m`, note: a.note, cover: false })),
    plantings: site.layout.map((p) => ({ sown: "", planted: "", ...p })),
    log: [],
  };
}

// Bring older saves up to date: v1 had no positions, v2 was the layout before
// the plan was settled (Bed B under cardboard, no varieties or covers).
const OLD_SEED_NOTES = ["Cloves 15 cm apart, tip just below the compost", "10 cm apart, tips showing; net against birds",
  "Double row, 20 cm apart", "Already growing", "Plant Oct–Nov", "Sow Oct–Nov"];

function migrate(g) {
  const prev = garden;
  garden = g; // helpers read the global
  for (const b of g.beds) if (b.cover === undefined) b.cover = false;
  for (const p of g.plantings) {
    if (typeof p.from === "number" && typeof p.to === "number") continue;
    const s = site.layout.find((x) => x.id === p.id);
    [p.from, p.to] = s && s.bed === p.bed && overlapping(p.bed, s.from, s.to, p.id).length === 0 ? [s.from, s.to] : spotFor(p.bed, null, p.id);
    if (p.id === "p4") p.inGround = true;
  }
  if ((g.version ?? 1) < 3) {
    const seed = seedGarden();
    for (const sb of seed.beds) {
      const b = bedById(sb.id);
      if (!b) { g.beds.push(sb); continue; }
      Object.assign(b, { name: sb.name, size: sb.size, cover: false });
      if (!b.note || /cardboard|polythene|Existing plants/i.test(b.note)) b.note = sb.note;
    }
    for (const sp of seed.plantings) {
      const p = g.plantings.find((x) => x.id === sp.id);
      if (p) {
        for (const k of ["variety", "cover", "harvest"]) if (!p[k]) p[k] = sp[k];
        if (!p.note || OLD_SEED_NOTES.includes(p.note)) p.note = sp.note;
      } else if (overlapping(sp.bed, sp.from, sp.to).length === 0) {
        g.plantings.push(sp);
      }
    }
  }
  g.version = 3;
  garden = prev ?? g;
}

/* ---------- Rendering ---------- */
function render() {
  renderPlan();
  renderBeds();
  renderLog();
  const names = new Set([...COMMON_CROPS, ...garden.plantings.map((p) => p.crop)]);
  $("#crop-names").replaceChildren(...[...names].sort().map((n) => h("option", { value: n })));
}

function renderPlan() {
  const svg = $("#plan-svg");
  drawPlot(svg, plot, (layer, a) => {
    for (const bed of garden.beds) {
      const ar = a[bed.id];
      if (!ar) continue;
      const mine = plantingsIn(bed.id);
      const lanes = layoutLanes(mine);
      layer.append(sv("rect", {
        class: bed.cover ? "ground covered" : "ground", x: ar.x, y: ar.y, width: ar.w, height: ar.h,
        tabindex: 0, role: "button", "aria-label": `${bed.name}: add a planting`,
        onclick: (e) => openAdd(bed.id, svgPoint(svg, e).x - ar.x),
        onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openAdd(bed.id, null); } },
      }));
      if (bed.cover && mine.length === 0) layer.append(blockLabel(ar, "Cardboard", "lbl lbl-soft"));
      for (const p of mine) layer.append(plantingBlock(p, bed, ar, lanes.get(p.id)));
    }
  });
}

function plantingBlock(p, bed, ar, { lane, lanes }) {
  const st = status(p);
  const col = cropColour(p.crop);
  const r = plantingRect(ar, p, lane, lanes);
  const g = sv("g", {
    class: `crop ${st}`, tabindex: 0, role: "button", "data-id": p.id, "aria-pressed": String(current === p.id),
    "aria-label": `${p.crop}, ${STATUS_LABEL[st].toLowerCase()}, ${bed.name} ${span(p)} from the west end`,
    onclick: () => openView(p.id),
    onkeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openView(p.id); } },
  }, sv("rect", { x: r.x, y: r.y, width: r.w, height: r.h, rx: 0.02, fill: col, stroke: col }));
  // Thin strips get a taller invisible target so a finger can hit them.
  if (r.h < 0.3) g.prepend(sv("rect", { class: "hit", x: r.x, y: r.y - 0.1, width: r.w, height: r.h + 0.2 }));
  const cover = coverOverlay(r, p.cover);
  if (cover) g.append(cover);
  if (r.h >= 0.12) g.append(blockLabel(r, st === "ready" ? `${p.crop} · ready` : p.crop));
  return g;
}

function renderBeds() {
  $("#bed-list").replaceChildren(...garden.beds.map((bed) => {
    const ps = plantingsIn(bed.id);
    return h("article", { class: "bed" },
      h("div", { class: "bed-head" },
        h("h3", {}, bed.name),
        h("span", { class: "meta" }, bed.size)),
      bed.note && h("p", { class: "bed-note" }, bed.note),
      h("label", { class: "cover-toggle" },
        h("input", { type: "checkbox", checked: !!bed.cover,
          onchange: (e) => { bed.cover = e.target.checked; save(); renderPlan(); } }),
        "Bare cardboard (not planted yet)"),
      ps.length === 0
        ? h("div", { class: "planting empty-bed" }, "Nothing planted.",
            h("button", { class: "btn ghost small", type: "button", onclick: () => openAdd(bed.id, null) }, "Add to this bed"))
        : ps.map((p) => {
            const st = status(p);
            return h("button", { class: "planting row-btn", type: "button", onclick: () => openView(p.id) },
              h("span", { class: "swatch", style: `background:${cropColour(p.crop)}`, "aria-hidden": "true" }),
              h("span", { class: "row-main" }, h("strong", {}, p.crop), p.variety && h("span", { class: "latin" }, ` ${p.variety}`),
                h("span", { class: "dates" }, span(p))),
              h("span", { class: `pill ${st}` }, STATUS_LABEL[st]));
          }));
  }));
}

function renderLog() {
  const log = garden.log.slice().sort((a, b) => b.date.localeCompare(a.date));
  $("#log-list").replaceChildren(...(log.length
    ? log.map((e) => h("li", {},
        h("div", { class: "when" }, h("span", {}, fmtDate(e.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })),
          h("button", { class: "btn ghost small", type: "button",
            onclick: () => { garden.log = garden.log.filter((x) => x.id !== e.id); save(); renderLog(); } }, "Delete")),
        h("p", {}, e.text)))
    : [h("li", { class: "empty" }, "No entries yet. Add one after each visit, even a line.")]));
}

/* ---------- The sheet: view, add, edit ---------- */
const sheet = () => $("#sheet");

function showSheet(mode) {
  $("#sheet-view").hidden = mode !== "view";
  $("#sheet-form").hidden = mode !== "form";
  if (!sheet().open) sheet().showModal();
  sheet().scrollTop = 0;
}

function openView(id) {
  const p = garden.plantings.find((x) => x.id === id);
  if (!p) return;
  current = id;
  disarmRemove();
  const bed = bedById(p.bed);
  const st = status(p);
  $("#sheet-title").textContent = p.crop;
  $("#sheet-sub").textContent = [p.variety, `${bed?.name ?? p.bed}, ${span(p)} from the west end`].filter(Boolean).join(" · ");
  drawStrip($("#view-strip"), p.bed, p.from, p.to, p.id, p.crop);
  const fact = (k, v) => h("div", {}, h("dt", {}, k), h("dd", {}, v || "–"));
  $("#view-facts").replaceChildren(
    fact("Status", h("span", { class: `pill ${st}` }, STATUS_LABEL[st])),
    fact("Sown", fmtDate(p.sown)),
    fact("Planted out", fmtDate(p.planted)),
    fact("Harvest from", fmtDate(p.harvest, { month: "long", year: "numeric" })),
    fact("Cover", COVER_LABEL[p.cover]));
  $("#view-note").textContent = p.note || "";
  $("#view-note").hidden = !p.note;
  showSheet("view");
  renderPlan();
}

function openAdd(bed, tapX) {
  editingId = null;
  current = null;
  const [from, to] = spotFor(bed, tapX);
  fillForm({ crop: "", variety: "", bed, from, to, sown: "", planted: "", harvest: "", note: "", cover: "" });
  $("#sheet-title").textContent = "New planting";
  $("#sheet-sub").textContent = `${bedById(bed)?.name ?? bed}, ${metres(from)}–${metres(to)} m`;
  $("#form-save").textContent = "Add planting";
  showSheet("form");
  $("#sheet-form").crop.focus();
}

function openEdit(id) {
  const p = garden.plantings.find((x) => x.id === id);
  editingId = id;
  fillForm(p);
  $("#sheet-title").textContent = `Edit ${p.crop}`;
  $("#form-save").textContent = "Save changes";
  showSheet("form");
}

function fillForm(p) {
  const f = $("#sheet-form");
  $("#f-bed").replaceChildren(...garden.beds.map((b) => h("option", { value: b.id }, b.name)));
  for (const k of ["crop", "variety", "bed", "sown", "planted", "harvest", "note", "cover"]) f[k].value = p[k] || "";
  setPositionOptions(p.bed, p.from, p.to);
  $("#crop-error").hidden = true;
  updateFormStrip();
}

function setPositionOptions(bed, from, to) {
  const L = bedLength(bed);
  const opts = (lo, hi) => {
    const out = [];
    for (let v = lo; v <= hi + 1e-9; v += STEP) out.push(h("option", { value: v }, `${metres(v)} m`));
    return out;
  };
  $("#f-from").replaceChildren(...opts(0, L - STEP));
  $("#f-to").replaceChildren(...opts(STEP, L));
  $("#f-from").value = clamp(from, 0, L - STEP);
  $("#f-to").value = clamp(to, from + STEP, L);
}

function formSpot() {
  return [parseFloat($("#f-from").value), parseFloat($("#f-to").value)];
}

function updateFormStrip() {
  const bed = $("#f-bed").value;
  const [from, to] = formSpot();
  const crop = $("#sheet-form").crop.value.trim() || "New";
  drawStrip($("#form-strip"), bed, from, to, editingId, crop);
  const clash = overlapping(bed, from, to, editingId);
  const warn = $("#form-overlap");
  warn.hidden = clash.length === 0;
  warn.textContent = clash.length ? `Shares space with ${clash.map((p) => p.crop).join(" and ")}. Fine for interplanting; otherwise move it.` : "";
  if (!editingId) $("#sheet-sub").textContent = `${bedById(bed)?.name ?? bed}, ${metres(from)}–${metres(to)} m`;
}

// The bed as a bar, west end on the left like the drawing; this planting highlighted.
function drawStrip(el, bed, from, to, except, label) {
  const L = bedLength(bed);
  const pct = (v) => `${(v / L) * 100}%`;
  const others = plantingsIn(bed, except).map((p) =>
    h("span", { class: "seg other", style: `left:${pct(p.from)};width:${pct(p.to - p.from)};--c:${cropColour(p.crop)}`, title: p.crop }));
  const ticks = [];
  for (let v = 0; v <= L + 1e-9; v += 1) ticks.push(h("span", { class: "tick", style: `left:${pct(v)}` }, v === 0 ? "west" : v === L ? `${v} m east` : `${v}`));
  el.replaceChildren(
    h("div", { class: "strip-bar" }, others,
      h("span", { class: "seg this", style: `left:${pct(from)};width:${pct(to - from)};--c:${cropColour(label)}` })),
    h("div", { class: "strip-ticks", "aria-hidden": "true" }, ticks));
}

function onSave(e) {
  e.preventDefault();
  const f = e.target;
  const crop = f.crop.value.trim();
  if (!crop) { $("#crop-error").hidden = false; f.crop.focus(); return; }
  const [from, to] = formSpot();
  const values = {
    crop, variety: f.variety.value.trim(), bed: f.bed.value, from, to,
    sown: f.sown.value, planted: f.planted.value, harvest: f.harvest.value, note: f.note.value.trim(), cover: f.cover.value,
  };
  let id = editingId;
  if (id) Object.assign(garden.plantings.find((p) => p.id === id), values);
  else { id = crypto.randomUUID(); garden.plantings.push({ id, ...values }); }
  save();
  editingId = null;
  render();
  openView(id); // show the result, with its block highlighted on the plan
}

function disarmRemove() {
  clearTimeout(removeTimer);
  removeTimer = null;
  $("#view-remove").textContent = "Remove";
  $("#view-remove").classList.remove("armed");
}

function onRemove() {
  const btn = $("#view-remove");
  if (!removeTimer) {
    btn.textContent = "Tap again to remove";
    btn.classList.add("armed");
    removeTimer = setTimeout(disarmRemove, 4000);
    return;
  }
  disarmRemove();
  garden.plantings = garden.plantings.filter((p) => p.id !== current);
  save();
  sheet().close();
  render();
}

function onLogFromSheet() {
  const p = garden.plantings.find((x) => x.id === current);
  sheet().close();
  const ta = $("#log-form").text;
  ta.value = `${p.crop} (${bedById(p.bed)?.name ?? p.bed}): `;
  $("#log").scrollIntoView();
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}

/* ---------- Wiring ---------- */
function wire() {
  const s = sheet();
  s.querySelector("[data-close]").addEventListener("click", () => s.close());
  // Tapping the dimmed backdrop closes the sheet.
  s.addEventListener("click", (e) => { if (e.target === s) s.close(); });
  s.addEventListener("close", () => { current = null; editingId = null; disarmRemove(); renderPlan(); });

  $("#view-edit").addEventListener("click", () => openEdit(current));
  $("#view-remove").addEventListener("click", onRemove);
  $("#view-log").addEventListener("click", onLogFromSheet);

  const f = $("#sheet-form");
  f.addEventListener("submit", onSave);
  $("#form-cancel").addEventListener("click", () => (editingId ? openView(editingId) : s.close()));
  f.crop.addEventListener("input", () => { $("#crop-error").hidden = true; updateFormStrip(); });
  $("#f-bed").addEventListener("change", () => {
    const [from, to] = spotFor($("#f-bed").value, null, editingId);
    setPositionOptions($("#f-bed").value, from, to);
    updateFormStrip();
  });
  $("#f-from").addEventListener("change", () => {
    const [from, to] = formSpot();
    if (to <= from) $("#f-to").value = Math.min(from + STEP, bedLength($("#f-bed").value));
    updateFormStrip();
  });
  $("#f-to").addEventListener("change", () => {
    const [from, to] = formSpot();
    if (to <= from) $("#f-from").value = Math.max(to - STEP, 0);
    updateFormStrip();
  });

  $("#add-btn").addEventListener("click", () => openAdd(roomiestBed(), null));
  $("#log-form").date.value = todayISO();
  $("#log-form").addEventListener("submit", onLog);
  $("#export").addEventListener("click", onExport);
  $("#import").addEventListener("change", onImport);
}

function onLog(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (!f.text.trim()) return;
  garden.log.push({ id: crypto.randomUUID(), date: f.date, text: f.text.trim() });
  save();
  e.target.text.value = "";
  renderLog();
}

function onExport() {
  const blob = new Blob([JSON.stringify(garden, null, 2)], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: `ascott-tracker-${todayISO()}.json` });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  $("#data-msg").textContent = "Backup exported.";
}

async function onImport(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.beds) || !Array.isArray(data.plantings) || !Array.isArray(data.log)) throw new Error();
    migrate(data);
    garden = data; save(); render();
    $("#data-msg").textContent = `Imported ${data.plantings.length} plantings and ${data.log.length} log entries.`;
  } catch {
    $("#data-msg").textContent = "That file isn't a tracker backup. Choose a file made with Export backup.";
  }
  e.target.value = "";
}
