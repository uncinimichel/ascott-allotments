// Crop catalogue helpers shared by the catalogue, plot and tracker pages:
// the month bar, "what to do now" and matching a planting to its catalogue entries.
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ACTS = [
  { key: "sowIn", label: "Sow indoors", now: "Sow indoors now", next: "Sow indoors" },
  { key: "sowOut", label: "Sow outside", now: "Sow now", next: "Sow" },
  { key: "plant", label: "Plant out", now: "Plant now", next: "Plant" },
  { key: "harvest", label: "Harvest", now: "Picking now", next: "Pick from" },
  { key: "flower", label: "Flowers", now: "In flower", next: "Flowers from" },
];
const ACT = Object.fromEntries(ACTS.map((a) => [a.key, a]));

const inRange = (m, [a, b]) => (a <= b ? m >= a && m <= b : m >= a || m <= b);
const rangeText = ([a, b]) => (a === b ? MONTH_SHORT[a - 1] : `${MONTH_SHORT[a - 1]}–${MONTH_SHORT[b - 1]}`);

// Where today sits in the year, 0–1, to the day.
function yearFraction(now = new Date()) {
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return (now.getMonth() + (now.getDate() - 0.5) / days) / 12;
}

function cropPhoto(id) { return `img/crops/${id}.jpg`; }

// "Sow outside Oct–Nov and Feb–Apr. Harvest May–Jul."
function calendarText(crop) {
  return ACTS.filter((a) => crop.calendar[a.key])
    .map((a) => `${a.label} ${crop.calendar[a.key].map(rangeText).join(" and ")}.`).join(" ");
}

// The jobs going on this month, and the next one to start if nothing is.
function cropNow(crop, now = new Date()) {
  const m = now.getMonth() + 1;
  const active = ACTS.filter((a) => (crop.calendar[a.key] || []).some((r) => inRange(m, r)));
  let next = null;
  for (let add = 1; add <= 12 && !next; add++) {
    const mm = ((m - 1 + add) % 12) + 1;
    const a = ACTS.find((a) => (crop.calendar[a.key] || []).some((r) => r[0] === mm));
    if (a) next = { act: a.key, month: mm, text: `${a.next} ${MONTH_SHORT[mm - 1]}` };
  }
  return { active: active.map((a) => a.key), next };
}

// The 12-month bar: one thin track per job, the current month shaded, a line for today.
// `labelled` adds the job names on the left and month letters underneath.
function monthBar(crop, { now = new Date(), labelled = false } = {}) {
  const acts = ACTS.filter((a) => crop.calendar[a.key]);
  const tracks = acts.map((a) => {
    const segs = [];
    for (const [s, e] of crop.calendar[a.key]) {
      if (s <= e) segs.push([s, e]);
      else segs.push([s, 12], [1, e]);
    }
    return h("div", { class: "track", "data-act": a.key },
      segs.map(([s, e]) => h("span", { class: "seg", style: `left:${((s - 1) / 12) * 100}%;width:${((e - s + 1) / 12) * 100}%` })));
  });
  const m = now.getMonth();
  const bar = h("div", { class: "mbar", role: "img", "aria-label": calendarText(crop) },
    h("span", { class: "mbar-month", style: `left:${(m / 12) * 100}%`, "aria-hidden": "true" }),
    tracks,
    h("span", { class: "mbar-today", style: `left:${yearFraction(now) * 100}%`, "aria-hidden": "true" }));
  if (!labelled) return bar;
  return h("div", { class: "mbar-labelled" },
    h("div", { class: "mbar-labels", "aria-hidden": "true" }, acts.map((a) => h("span", { "data-act": a.key }, a.label))),
    h("div", {}, bar, h("div", { class: "ruler-months small", "aria-hidden": "true" }, MONTH_SHORT.map((x, i) => h("span", { class: i === m ? "now" : null }, x[0])))));
}

// Month letters with today's pin, for above a list of bars.
function monthRuler(now = new Date()) {
  const m = now.getMonth(), f = yearFraction(now);
  const shift = f < 0.08 ? "0" : f > 0.92 ? "-100%" : "-50%";
  return h("div", { class: "ruler", "aria-hidden": "true" },
    h("span", { class: "ruler-pin", style: `left:${f * 100}%` },
      h("span", { style: `transform:translateX(${shift})` }, `Today · ${now.getDate()} ${MONTH_SHORT[m]}`)),
    h("div", { class: "ruler-months" }, MONTH_SHORT.map((x, i) => h("span", { class: i === m ? "now" : null }, x[0]))));
}

// Catalogue entries for a planting: the layout's own links first, then by name.
function cropsFor(catalog, planting, layout = []) {
  const byId = Object.fromEntries(catalog.crops.map((c) => [c.id, c]));
  const plan = layout.find((p) => p.id === planting.id && p.crop === planting.crop);
  if (plan?.catalog) return plan.catalog.map((id) => byId[id]).filter(Boolean);
  const name = (planting.crop || "").toLowerCase().trim();
  if (!name) return [];
  const hit = catalog.crops.find((c) => c.name.toLowerCase() === name || c.aliases.includes(name))
    || catalog.crops.find((c) => c.aliases.some((a) => name.includes(a)));
  return hit ? [hit] : [];
}
