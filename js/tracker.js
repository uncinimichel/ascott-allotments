// Tracker: beds, plantings and a weekly log, kept in localStorage.
// First visit seeds from data/garden.json.
const KEY = "ascott.garden";
let garden;
let editing = null;

(async function main() {
  garden = store.get(KEY, null);
  if (!garden) {
    try { garden = await loadJSON("data/garden.json"); }
    catch { garden = { beds: [], plantings: [], log: [] }; }
    save();
  }
  $("#log-form").date.value = todayISO();
  $("#planting-form").addEventListener("submit", onPlanting);
  $("#planting-cancel").addEventListener("click", resetPlantingForm);
  $("#log-form").addEventListener("submit", onLog);
  $("#export").addEventListener("click", onExport);
  $("#import").addEventListener("change", onImport);
  render();
})();

function save() { store.set(KEY, garden); }

function render() {
  $("#bed-select").replaceChildren(...garden.beds.map((b) => h("option", { value: b.id }, b.name)));

  $("#bed-list").replaceChildren(...garden.beds.map((bed) => {
    const ps = garden.plantings.filter((p) => p.bed === bed.id);
    return h("article", { class: "bed" },
      h("div", { class: "bed-head" }, h("h3", {}, bed.name), h("span", { class: "meta" }, bed.size)),
      bed.note && h("p", { class: "sub", style: "padding:0 16px;margin:0 0 12px" }, bed.note),
      ps.length === 0
        ? h("div", { class: "planting" }, h("span", { class: "sub", style: "margin:0" }, "Nothing planted yet."))
        : ps.map(plantingRow));
  }));

  const log = garden.log.slice().sort((a, b) => b.date.localeCompare(a.date));
  $("#log-list").replaceChildren(...(log.length
    ? log.map((e) => h("li", {},
        h("div", { class: "when" }, h("span", {}, fmtDate(e.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })),
          h("button", { class: "btn ghost small", onclick: () => { garden.log = garden.log.filter((x) => x.id !== e.id); save(); render(); } }, "Delete")),
        h("p", {}, e.text)))
    : [h("li", { class: "empty" }, "No entries yet. Add one after each visit, even a line.")]));
}

function plantingRow(p) {
  const d = (label, v, opts) => v && h("span", {}, `${label} `, h("b", {}, fmtDate(v, opts)));
  return h("div", { class: "planting" },
    h("div", { class: "top" },
      h("div", {}, h("strong", {}, p.crop), p.variety && h("span", { class: "latin" }, ` ${p.variety}`)),
      h("div", { style: "display:flex;gap:6px" },
        h("button", { class: "btn ghost small", onclick: () => editPlanting(p) }, "Edit"),
        h("button", { class: "btn ghost small", onclick: () => removePlanting(p) }, "Remove"))),
    h("div", { class: "dates" },
      d("sown", p.sown), d("planted", p.planted), d("harvest", p.harvest, { month: "short", year: "numeric" }),
      !p.sown && !p.planted && h("span", {}, "not in yet")),
    p.note && h("div", { class: "sub", style: "margin:0;font-size:15px" }, p.note));
}

function onPlanting(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  if (editing) Object.assign(garden.plantings.find((p) => p.id === editing), f);
  else garden.plantings.push({ id: crypto.randomUUID(), ...f });
  save(); resetPlantingForm(); render();
}

function editPlanting(p) {
  editing = p.id;
  const form = $("#planting-form");
  for (const k of ["crop", "variety", "bed", "sown", "planted", "harvest", "note"]) form[k].value = p[k] || "";
  $("#planting-submit").textContent = "Save planting";
  $("#planting-cancel").hidden = false;
  $("#add-h").textContent = `Edit ${p.crop}`;
  $("#add").scrollIntoView();
}

function resetPlantingForm() {
  editing = null;
  $("#planting-form").reset();
  $("#planting-submit").textContent = "Add planting";
  $("#planting-cancel").hidden = true;
  $("#add-h").textContent = "Add a planting";
}

function removePlanting(p) {
  garden.plantings = garden.plantings.filter((x) => x.id !== p.id);
  save(); render();
}

function onLog(e) {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  garden.log.push({ id: crypto.randomUUID(), date: f.date, text: f.text.trim() });
  save();
  e.target.text.value = "";
  render();
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
    garden = data; save(); render();
    $("#data-msg").textContent = `Imported ${data.plantings.length} plantings and ${data.log.length} log entries.`;
  } catch {
    $("#data-msg").textContent = "That file isn't a tracker backup. Choose a file made with Export backup.";
  }
  e.target.value = "";
}
