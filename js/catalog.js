// Catalogue: every crop on the plot or planned, with photos and a month bar showing today.
(async function main() {
  let site, credits = {};
  try {
    [site, credits] = await Promise.all([loadJSON("data/site.json"), loadJSON("data/crop-credits.json").catch(() => ({}))]);
  } catch (err) {
    $("main").prepend(h("p", { class: "empty" }, "The catalogue didn't load. Open this page through a web server (see README)."));
    throw err;
  }
  // ?date=2027-03-15 previews another day.
  const q = new URLSearchParams(location.search).get("date");
  const now = q && !isNaN(new Date(q + "T12:00:00")) ? new Date(q + "T12:00:00") : new Date();

  const groups = groupCrops(site);
  renderNow(site.catalog.crops, now);
  renderList(site, groups, credits, now);
  $("#cat-note").textContent = site.catalog.note;
  $("#cat-credits").textContent = "Photos from Wikimedia Commons, freely licensed. The photographer and licence are under each photo.";
  openFromHash();
  addEventListener("hashchange", openFromHash);
  initBar();
})();

// Which section each crop belongs in, and where it goes on the plot.
function groupCrops(site) {
  const where = {}, group = {};
  const add = (id, g, text) => {
    if (!id) return;
    group[id] ??= g;
    (where[id] ??= []).push(text);
  };
  const areas = Object.fromEntries(site.plot.areas.map((a) => [a.id, a]));
  for (const p of site.layout) for (const id of p.catalog || []) add(id, "plot-crops", `${areas[p.bed].name}, ${p.from}–${p.to} m from the west end`);
  for (const c of site.plot.companions || []) add(c.catalog, "flowers", `${areas[c.area].name}, between the strawberries ${c.from}–${c.to} m`);
  for (const p of site.pots) for (const id of p.catalog || []) add(id, "flowers", p.where);
  for (const r of site.succession) for (const id of r.catalog || []) add(id, "next-crops", `After the ${r.now.toLowerCase()}, from ${r.when}`);
  return { where, group };
}

function renderNow(crops, now) {
  const m = now.getMonth() + 1;
  $("#today-lede").textContent = `${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}. When to sow, plant and pick everything on the plot, with today marked on every bar.`;
  $("#now-h").textContent = `This month: ${MONTH_LONG[m - 1]}`;
  const doing = (keys) => crops.filter((c) => keys.some((k) => (c.calendar[k] || []).some((r) => inRange(m, r))));
  const chip = (c, extra) => h("a", { class: "crop-chip", href: `#${c.id}` },
    h("img", { src: cropPhoto(c.id), alt: "", loading: "lazy" }), c.name, extra && h("small", {}, extra));
  const col = (act, title, list, tag) => list.length && h("div", { class: "job", "data-act": act },
    h("h3", {}, title), h("div", { class: "chip-row" }, list.map((c) => chip(c, tag?.(c)))));
  const sow = doing(["sowOut", "sowIn"]);
  const plant = doing(["plant"]);
  const jobs = [
    col("sowOut", "Sow", sow, (c) => (c.calendar.sowIn || []).some((r) => inRange(m, r)) && !(c.calendar.sowOut || []).some((r) => inRange(m, r)) ? "indoors" : null),
    col("plant", "Plant", plant),
  ].filter(Boolean);
  $("#now-jobs").replaceChildren(...(jobs.length ? jobs : [h("p", { class: "sub" }, "Nothing to sow or plant this month. Keep the covers on and pick what's ready.")]));

  // The next month that brings new sowing or planting.
  for (let add = 1; add <= 12; add++) {
    const mm = ((m - 1 + add) % 12) + 1;
    const parts = [["sowIn", "sow indoors"], ["sowOut", "sow outside"], ["plant", "plant"]].map(([k, verb]) => {
      const list = crops.filter((c) => (c.calendar[k] || []).some((r) => r[0] === mm));
      return list.length ? `${verb[0].toUpperCase()}${verb.slice(1)}: ${list.map((c) => c.name.toLowerCase()).join(", ")}` : null;
    }).filter(Boolean);
    if (parts.length) {
      $("#coming").replaceChildren(h("b", {}, `Next up, ${MONTH_LONG[mm - 1]}. `), parts.join(". ") + ".");
      break;
    }
  }
}

const GROUPS = [
  { id: "plot-crops", title: "In the plot", sub: "Sown and planted this autumn. Tap one for how to grow it." },
  { id: "flowers", title: "Flowers and pots", sub: "Flowers to bring in hoverflies, and what grows in pots." },
  { id: "next-crops", title: "Next summer", sub: "What follows each crop as it comes out." },
];

function renderList(site, { where, group }, credits, now) {
  const list = $("#crop-list");
  $("#legend").append(...ACTS.map((a) => h("span", { "data-act": a.key }, h("i", {}), a.label)),
    h("span", { class: "lg-today" }, h("i", {}), "Today"));
  $("#ruler").replaceWith(monthRuler(now));

  for (const g of GROUPS) {
    const crops = site.catalog.crops.filter((c) => group[c.id] === g.id);
    if (!crops.length) continue;
    list.append(h("section", { id: g.id, "aria-labelledby": `${g.id}-h` },
      h("div", { class: "group-title" }, h("h2", { id: `${g.id}-h` }, g.title), h("span", { class: "count" }, String(crops.length))),
      h("p", { class: "sub" }, g.sub),
      h("div", { class: "crops" }, crops.map((c) => cropEntry(c, where[c.id] || [], credits[c.id], now, g.id === "plot-crops")))));
  }
}

function statusFor(crop, now) {
  const { active, next } = cropNow(crop, now);
  const job = active.find((k) => k !== "harvest" && k !== "flower") || active[0];
  return job ? { act: job, text: ACT[job].now } : next ? { act: next.act, text: next.text, later: true } : null;
}

function cropEntry(c, where, credit, now, onPlot) {
  const st = statusFor(c, now);
  const fact = (k, v) => v && [h("dt", {}, k), h("dd", {}, v)];
  const d = h("details", { class: "crop", id: c.id },
    h("summary", {},
      h("img", { class: "thumb", src: cropPhoto(c.id), alt: "", loading: "lazy", width: 64, height: 64 }),
      h("span", { class: "crop-name" },
        h("b", {}, c.name),
        h("span", { class: "crop-sub" }, c.variety || h("i", {}, c.latin))),
      st && h("span", { class: st.later ? "status later" : "status", "data-act": st.act }, st.text),
      monthBar(c, { now })),
    h("div", { class: "crop-body" },
      h("figure", { class: "crop-photo" },
        h("img", { src: cropPhoto(c.id), alt: c.name, loading: "lazy" }),
        credit && h("figcaption", {}, h("a", { href: credit.source, target: "_blank", rel: "noopener" }, credit.author || "Wikimedia Commons"), ` · ${credit.license}`)),
      h("p", { class: "about" }, c.about),
      monthBar(c, { now, labelled: true }),
      h("dl", { class: "crop-facts" },
        fact("How to grow it, no-dig", c.grow),
        fact("Spacing", c.spacing),
        fact("Tip", c.tip),
        fact(onPlot ? "On your plot" : "Where", where.join(". ")),
        c.variety && fact("Latin name", h("i", {}, c.latin))),
      onPlot && h("a", { class: "btn ghost small", href: `plot.html?crop=${c.id}#layout` }, "Show it on the plot")));
  return d;
}

// #garlic opens that entry and scrolls to it.
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el || el.tagName !== "DETAILS") return;
  el.open = true;
  requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
}
