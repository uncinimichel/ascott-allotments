// Catalogue: every crop on the plot or planned, with photos and a month bar showing today.
(async function main() {
  let site, credits = {}, weedCredits = {};
  try {
    [site, credits, weedCredits] = await Promise.all([loadJSON("data/site.json"),
      loadJSON("data/crop-credits.json").catch(() => ({})), loadJSON("data/credits.json").catch(() => ({}))]);
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
  renderWeeds(site, weedCredits);
  $("#cat-note").textContent = `${site.catalog.note} ${site.catalog.varietiesNote || ""}`;
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
  for (const c of site.plot.companions || []) add(c.catalog, "plot-crops", `${areas[c.area].name}, between the strawberries ${c.from}–${c.to} m`);
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

// The catalogue is split by what a plant is; where it grows is a tag on each row.
const KINDS = [
  { id: "veg", kind: "veg", title: "Vegetables", sub: "On the plot now, in pots, and what follows next summer. Tap one for how to grow it." },
  { id: "fruit", kind: "fruit", title: "Fruit", sub: "Strawberries in the ground and citrus in pots." },
  { id: "flowers", kind: "flower", title: "Flowers", sub: "Grown to bring in hoverflies, whose larvae eat aphids." },
];
const PLACE = { "plot-crops": "In the plot", idea: "Could add this winter", flowers: "In pots", "next-crops": "Next summer" };
const PLACE_ORDER = ["plot-crops", "idea", "flowers", "next-crops"];
const IDEA_WHERE = "Not planted yet. It could join the winter salads under the fleece in Bed B as module plugs.";

function renderList(site, { where, group }, credits, now) {
  const list = $("#crop-list");
  $("#legend").append(...ACTS.map((a) => h("span", { "data-act": a.key }, h("i", {}), a.label)),
    h("span", { class: "lg-today" }, h("i", {}), "Today"));
  $("#ruler").replaceWith(monthRuler(now));

  // Pots that aren't flowers (tomatoes, citrus) are tagged "In pots" rather than in the flowers group.
  const placeOf = (c) => group[c.id] || (c.idea ? "idea" : null);
  const rank = (c) => PLACE_ORDER.indexOf(placeOf(c));
  for (const k of KINDS) {
    const crops = site.catalog.crops.filter((c) => c.kind === k.kind).sort((a, b) => rank(a) - rank(b));
    if (!crops.length) continue;
    list.append(h("section", { id: k.id, "aria-labelledby": `${k.id}-h` },
      h("div", { class: "group-title" }, h("h2", { id: `${k.id}-h` }, k.title), h("span", { class: "count" }, String(crops.length))),
      h("p", { class: "sub" }, k.sub),
      h("div", { class: "crops" }, crops.map((c) => cropEntry(c, where[c.id] || (c.idea ? [IDEA_WHERE] : []), credits[c.id], now, placeOf(c))))));
  }
}

function statusFor(crop, now) {
  const { active, next } = cropNow(crop, now);
  const job = active.find((k) => k !== "harvest" && k !== "flower") || active[0];
  return job ? { act: job, text: ACT[job].now } : next ? { act: next.act, text: next.text, later: true } : null;
}

function cropEntry(c, where, credit, now, place) {
  const st = statusFor(c, now);
  const onPlot = place === "plot-crops";
  const fact = (k, v) => v && [h("dt", {}, k), h("dd", {}, v)];
  const d = h("details", { class: "crop", id: c.id },
    h("summary", {},
      h("img", { class: "thumb", src: cropPhoto(c.id), alt: "", loading: "lazy", width: 64, height: 64 }),
      h("span", { class: "crop-name" },
        h("b", {}, c.name),
        h("span", { class: "crop-sub" }, c.variety || h("i", {}, c.latin)),
        h("span", { class: "tags-line" },
          PLACE[place] && h("span", { class: "place", "data-place": place }, PLACE[place]),
          c.varieties?.length > 1 && h("span", { class: "vcount" }, `${c.varieties.length} varieties`))),
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
      onPlot && h("a", { class: "btn ghost small", href: `plot.html?crop=${c.id}#layout` }, "Show it on the plot"),
      varietyList(c)));
  return d;
}

/* ---------- Varieties: what else to grow, and why ---------- */
function varietyList(c) {
  const vs = c.varieties || [];
  if (!vs.length) return null;
  const single = vs.length === 1;
  return h("div", { class: "varieties" },
    h("div", { class: "varieties-head" },
      h("h3", {}, single ? "Variety" : "Varieties"),
      !single && h("span", { class: "count" }, `${vs.length} · swipe`)),
    h("div", { class: single ? "variety-row single" : "variety-row", role: "list" }, vs.map((v) =>
      h("article", { class: v.chosen ? "variety chosen" : "variety", role: "listitem" },
        v.chosen && h("span", { class: "ribbon" }, "You're growing this"),
        h("div", { class: "variety-name" },
          h("b", {}, v.name),
          v.agm && h("span", { class: "agm", title: "RHS Award of Garden Merit" }, "RHS AGM")),
        h("p", {}, v.why),
        h("div", { class: "variety-foot" },
          h("span", { class: "best" }, v.best),
          v.note && h("span", { class: "vnote" }, v.note),
          v.seller && h("span", { class: "seller", title: "Only the seed seller says this; not independently confirmed" }, "seller's claim"))))),
    c.sources?.length && h("p", { class: "sources" }, "Sources: ",
      c.sources.flatMap((s, i) => [i ? " · " : "", h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label)])));
}

/* ---------- Weeds: what comes out, and what looks like a weed but stays ---------- */
function renderWeeds(site, credits) {
  const groups = Object.fromEntries(site.weedGroups.map((g) => [g.id, g]));
  const remove = site.weeds.filter((w) => w.group !== "keep");
  const keep = site.weeds.filter((w) => w.group === "keep");
  const part = (title, list) => [h("h3", { class: "weed-part" }, title), h("div", { class: "crops" }, list.map((w) => weedEntry(w, groups[w.group], credits[w.id])))];
  $("#weeds").append(
    h("div", { class: "group-title" }, h("h2", { id: "weeds-h" }, "Weeds"), h("span", { class: "count" }, String(site.weeds.length))),
    h("p", { class: "sub" }, "What to pull while clearing, and the plants already there that look like weeds but stay. No digging: cut or pull, never fork the bed over."),
    ...part(`Remove · ${remove.length}`, remove),
    ...part(`Keep · ${keep.length}`, keep));
}

const WEED_TAG = { easy: "Easy annual", check: "Check the root", problem: "Possible problem", keep: "Keep" };

function weedEntry(w, g, credit) {
  const fact = (k, v) => v && [h("dt", {}, k), h("dd", {}, v)];
  const thumb = w.photo
    ? h("img", { class: "thumb", src: w.photo, alt: "", loading: "lazy", width: 64, height: 64 })
    : h("span", { class: "thumb none", "aria-hidden": "true" }, "?");
  return h("details", { class: "crop weed", id: `weed-${w.id}`, "data-group": w.group },
    h("summary", {},
      thumb,
      h("span", { class: "crop-name" }, h("b", {}, w.name.replace(/^…or /, "")), h("span", { class: "crop-sub" }, h("i", {}, w.latin), ` · ${w.life}`)),
      h("span", { class: "status weed-status" }, WEED_TAG[w.group])),
    h("div", { class: "crop-body" },
      w.photo
        ? h("figure", { class: "crop-photo" },
            h("img", { src: w.photo, alt: w.name, loading: "lazy" }),
            credit && h("figcaption", {}, h("a", { href: credit.source, target: "_blank", rel: "noopener" }, credit.author), ` · ${credit.license}`))
        : h("p", { class: "about" }, "No reference photo: every grass clump looks different. Pull one and check the roots."),
      g && h("p", { class: "about" }, g.blurb),
      h("dl", { class: "crop-facts" },
        fact("How to spot it", w.spot),
        fact(w.group === "keep" ? "What to do" : "How to remove it, no-dig", w.remove),
        fact("Where it goes", w.dispose)),
      h("a", { class: "btn ghost small", href: `index.html#weed-${w.id}` }, "On the clearing page")));
}

// #garlic opens that entry and scrolls to it.
function openFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  const el = id && document.getElementById(id);
  if (!el || el.tagName !== "DETAILS") return;
  el.open = true;
  requestAnimationFrame(() => el.scrollIntoView({ block: "start" }));
}
