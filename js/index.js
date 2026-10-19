// Clearing page: weed guide, bed prep steps, site rules, progress photos.

(async function main() {
  let site, credits;
  try {
    [site, credits] = await Promise.all([loadJSON("data/site.json"), loadJSON("data/credits.json")]);
  } catch (err) {
    $("main").prepend(h("p", { class: "empty" },
      "The plot data didn't load. Open this page through a web server (see README), not straight from the file."));
    throw err;
  }
  renderWeeds(site, credits);
  renderSteps(site.steps);
  renderRules(site.rules);
  renderCredits(site.weeds, credits);
  initPhotos();
  initBar();
})();

/* ---------- Weeds ---------- */
function renderWeeds(site, credits) {
  const root = $("#weed-groups");
  // At-a-glance answer first: what comes out, what stays.
  const keep = site.weeds.filter((w) => w.group === "keep");
  const remove = site.weeds.filter((w) => w.group !== "keep");
  const chip = (w) => h("a", { href: `#weed-${w.id}`, class: "chip" }, w.name.replace(/^…or /, ""));
  root.append(h("div", { class: "verdicts" },
    h("div", { class: "verdict-box remove" }, h("div", { class: "verdict-head" }, h("b", {}, "Remove"), ` ${remove.length} weeds`), h("div", { class: "chips" }, remove.map(chip))),
    h("div", { class: "verdict-box keep" }, h("div", { class: "verdict-head" }, h("b", {}, "Keep"), ` ${keep.length} plants`), h("div", { class: "chips" }, keep.map(chip)))));
  for (const g of site.weedGroups) {
    const weeds = site.weeds.filter((w) => w.group === g.id);
    // The two "check" groups are side-by-side comparisons, not catalogues.
    const pair = g.id === "check" || g.id === "problem";
    root.append(h("div", { class: "group", "data-group": g.id },
      h("div", { class: "group-head" }, h("span", { class: "swatch", "aria-hidden": "true" }), h("h3", {}, g.name)),
      h("p", { class: "group-blurb" }, g.blurb),
      h("div", { class: pair ? "cards pair" : "cards" }, weeds.map((w) => weedCard(w, credits[w.id])))));
  }
}

function weedCard(w, credit) {
  const fig = w.photo
    ? h("figure", {},
        h("img", { src: w.photo, alt: `${w.name} (${w.latin})`, loading: "lazy", width: 720, height: 540 }),
        credit && h("figcaption", {}, h("a", { href: credit.source, target: "_blank", rel: "noopener" },
          `${credit.author} · ${credit.license}`)))
    : h("figure", { class: "nophoto" }, "No reference photo: every grass clump looks different. Pull one and check the roots.");

  const effort = w.difficulty > 0 && h("span", { class: "tag effort", title: `Effort ${w.difficulty} of 3` },
    "effort ", [1, 2, 3].map((n) => h("i", { class: n <= w.difficulty ? "on" : "" })));

  const verdict = w.group === "keep" ? "keep" : "remove";
  return h("article", { class: `card ${verdict}`, id: `weed-${w.id}` },
    h("div", { class: `verdict-strip ${verdict}` }, verdict === "keep" ? "Keep" : "Remove"),
    fig,
    h("div", { class: "card-body" },
      h("div", {},
        h("div", { class: "card-title" }, h("h3", {}, w.name)),
        h("div", { class: "latin" }, w.latin)),
      h("div", { class: "tags" },
        h("span", { class: "tag life" }, w.life),
        effort,
        w.checkInPerson && h("span", { class: "tag verify" }, "check in person")),
      h("dl", {},
        h("div", {}, h("dt", {}, "How to tell"), h("dd", {}, w.spot)),
        h("div", {}, h("dt", {}, w.group === "keep" ? "What to do" : "Remove"), h("dd", {}, w.remove)),
        w.dispose && h("div", {}, h("dt", {}, "Dispose"), h("dd", {}, w.dispose)))));
}

/* ---------- Steps ---------- */
function renderSteps(steps) {
  $("#steps-list").append(...steps.map((st) => h("li", {}, h("div", {}, h("h3", {}, st.title), h("p", {}, st.body)))));
}

/* ---------- Rules ---------- */
function renderRules(rules) {
  const KEY = "ascott.startDate";
  const input = $("#start-date");
  input.value = store.get(KEY, "");
  const box = $("#milestones");
  const draw = () => {
    box.replaceChildren(...rules.cultivated.map((r) => {
      let by = `${r.months} months in`, past = false;
      if (input.value) {
        const d = new Date(input.value + "T12:00:00");
        d.setMonth(d.getMonth() + r.months);
        by = `by ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
        past = d < new Date();
      }
      return h("div", { class: past ? "milestone past" : "milestone" },
        h("div", { class: "pct" }, `${r.pct}%`),
        h("div", { class: "by" }, past ? `${by} (passed)` : by));
    }));
  };
  input.addEventListener("change", () => { store.set(KEY, input.value); draw(); });
  draw();
  $("#rule-notes").append(...rules.notes.map((n) => h("li", {}, n)));
}

/* ---------- Credits ---------- */
function renderCredits(weeds, credits) {
  $("#credits").append(...weeds.filter((w) => credits[w.id]).map((w) => {
    const c = credits[w.id];
    return h("li", {}, `${w.name}: `, h("a", { href: c.source, target: "_blank", rel: "noopener" }, c.file), ` by ${c.author}, ${c.license}`);
  }));
}

/* ---------- Photos (IndexedDB, stays on the device) ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("ascott", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("photos", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(db, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction("photos", mode);
    const out = fn(t.objectStore("photos"));
    t.oncomplete = () => resolve(out && out.result);
    t.onerror = () => reject(t.error);
  });
}

// Phone photos are 3–8 MB; shrink to 1600 px so years of visits fit.
async function shrink(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.82));
}

async function initPhotos() {
  let db;
  try { db = await openDB(); }
  catch { $("#photo-grid").replaceWith(h("p", { class: "empty" }, "This browser is blocking photo storage, so progress photos can't be saved here.")); return; }

  const urls = [];
  const draw = async () => {
    urls.splice(0).forEach(URL.revokeObjectURL);
    const all = (await tx(db, "readonly", (st) => st.getAll())).sort((a, b) => a.date.localeCompare(b.date));
    const fig = (p, label) => {
      const u = URL.createObjectURL(p.blob); urls.push(u);
      return h("figure", {}, h("img", { src: u, alt: `Plot on ${fmtDate(p.date)}` }), h("figcaption", {}, h("span", {}, label || fmtDate(p.date)),
        !label && h("button", { class: "del", "aria-label": `Delete photo from ${fmtDate(p.date)}`,
          onclick: async () => { await tx(db, "readwrite", (st) => st.delete(p.id)); draw(); } }, "delete")));
    };
    const compare = $("#photo-compare");
    if (all.length === 0) {
      compare.replaceChildren(h("p", { class: "empty" }, "No photos yet. Add one before you start clearing: it's the 'before'."));
    } else if (all.length === 1) {
      compare.replaceChildren(h("div", { class: "compare" }, fig(all[0], `Before · ${fmtDate(all[0].date)}`),
        h("figure", { class: "empty" }, "Your next photo shows up here as 'after'.")));
    } else {
      const last = all[all.length - 1];
      compare.replaceChildren(h("div", { class: "compare" },
        fig(all[0], `Before · ${fmtDate(all[0].date)}`), fig(last, `Latest · ${fmtDate(last.date)}`)));
    }
    $("#photo-grid").replaceChildren(...all.slice().reverse().map((p) => fig(p)));
  };

  $("#photo-input").addEventListener("change", async (e) => {
    for (const file of e.target.files) {
      const blob = await shrink(file).catch(() => file);
      const date = file.lastModified ? new Date(file.lastModified).toISOString().slice(0, 10) : todayISO();
      await tx(db, "readwrite", (st) => st.put({ id: crypto.randomUUID(), date, blob }));
    }
    e.target.value = "";
    draw();
  });
  draw();
}
