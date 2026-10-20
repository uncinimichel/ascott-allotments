// No-dig page: how the method works, the year's jobs, and the tools (ticks shared with the shopping list).
(async function main() {
  let site, credits = {};
  try {
    [site, credits] = await Promise.all([loadJSON("data/site.json"), loadJSON("data/credits.json").catch(() => ({}))]);
  } catch (err) {
    $("main").prepend(h("p", { class: "empty" }, "The no-dig guide didn't load. Open this page through a web server (see README)."));
    throw err;
  }
  const nd = site.noDig;
  $("#lede").textContent = nd.lede;
  renderHow(nd);
  renderYear(nd.year, new Date());
  renderTools(nd.tools, site.shopping, credits["tool:hori-hori"]);
  $("#skip-list").append(...nd.skip.map((s) => h("li", {}, h("b", {}, s.name), h("span", {}, s.why))));
  $("#nd-sources").append("Sources: ", ...nd.sources.flatMap((s, i) => [i ? " · " : "", h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.label)]));
  initBar();
})();

function renderHow(nd) {
  $("#layers").append(...nd.layers.map((l) => h("li", { "data-layer": l.id },
    h("i", { "aria-hidden": "true" }),
    h("div", {}, h("b", {}, l.name), l.depth && h("span", { class: "depth" }, l.depth), h("p", {}, l.note)))));
  $("#principles").append(...nd.principles.map((p) => h("article", { class: "principle" }, h("h3", {}, p.title), h("p", {}, p.body))));
}

function renderYear(year, now) {
  const m = now.getMonth() + 1;
  $("#seasons").append(...year.map((s) => {
    const current = s.months.includes(m);
    return h("article", { class: current ? "season now" : "season", "aria-current": current ? "true" : null },
      h("div", { class: "season-head" }, h("h3", {}, s.season), current && h("span", { class: "pill ready" }, "Now")),
      h("ul", {}, s.jobs.map((j) => h("li", {}, j))));
  }));
}

/* ---------- Tools ---------- */
const NEED = {
  essential: { title: "Essential", sub: "The no-dig kit. Get these first." },
  useful: { title: "Useful", sub: "Makes the job easier; borrow before you buy." },
  have: { title: "You already have", sub: "Keep them, but use them differently." },
};

// Chalk-line drawings, 64 × 64.
const ICONS = {
  dibber: '<path d="M22 10h20M32 10v8M27 18h10l-2 30-3 10-3-10z"/><path d="M28 30h8M28.5 38h7" class="thin"/>',
  hoe: '<path d="M52 6L24 44"/><path d="M12 42l14-3 4 9-15 6z"/>',
  line: '<path d="M12 14v40M52 14v40M12 22h40"/><circle cx="12" cy="10" r="5"/><path d="M8 54l4 6 4-6M48 54l4 6 4-6" class="thin"/>',
  rake: '<path d="M32 4v38M12 42h40"/><path d="M15 42v12M21 42v12M27 42v12M33 42v12M39 42v12M45 42v12M50 42v12" class="thin"/>',
  can: '<path d="M14 28h26v26H14zM40 36l14-14M52 18l7-4-2 9z"/><path d="M18 28c0-14 18-14 18 0" />',
  kneeler: '<rect x="8" y="26" width="48" height="18" rx="7"/><path d="M24 26c0-8 16-8 16 0" class="thin"/>',
  fork: '<path d="M26 4h12M32 4v26M20 30h24M20 30v24M28 30v24M36 30v24M44 30v24"/>',
  spade: '<path d="M26 4h12M32 4v28M22 32h20v16l-10 10-10-10z"/>',
  shears: '<path d="M30 34L10 8M34 34L54 8"/><circle cx="24" cy="46" r="8"/><circle cx="40" cy="46" r="8"/>',
  bucket: '<path d="M14 24h36l-5 32H19z"/><path d="M14 24c0-16 36-16 36 0" class="thin"/>',
  gloves: '<path d="M20 58V30l-6-10c-2-4 3-7 6-3l4 7V10c0-4 6-4 6 0v12-14c0-4 6-4 6 0v14-10c0-4 6-4 6 0v12-6c0-4 6-4 6 0v20c0 10-6 16-6 16v4z"/>',
};
const icon = (name) => {
  const s = h("span", { class: "tool-icon", "aria-hidden": "true" });
  s.innerHTML = `<svg viewBox="0 0 64 64">${ICONS[name] || ""}</svg>`;
  return s;
};

function toolStatus(tool, items, ticked) {
  if (!tool.shop) return { cls: "missing", text: "Not on your list" };
  const it = items[tool.shop];
  const got = ticked[tool.shop] ?? !!it?.have;
  if (got) return { cls: "got", text: it?.have ? "You have it" : "Ticked off" };
  return { cls: "todo", text: "On your shopping list" };
}

function renderTools(tools, shopping, credit) {
  const items = Object.fromEntries(shopping.groups.flatMap((g) => g.items.map((i) => [i.id, i])));
  const ticked = store.get("ascott.shopping", {});

  const hh = tools.find((t) => t.id === "hori-hori");
  const st = toolStatus(hh, items, ticked);
  $("#hori").append(h("article", { class: "hori" },
    h("figure", {},
      h("img", { src: "img/tools/hori-hori.jpg", alt: "A hori hori held in a gloved hand, showing the depth scale in inches and millimetres on the blade", loading: "lazy" }),
      credit && h("figcaption", {}, h("a", { href: credit.source, target: "_blank", rel: "noopener" }, credit.author), ` · ${credit.license}`)),
    h("div", { class: "hori-body" },
      h("div", { class: "hori-title" },
        h("span", { class: "need essential" }, "The essential one"),
        h("h3", {}, hh.name), h("span", { class: "aka" }, hh.aka)),
      h("p", { class: "hori-why" }, hh.why),
      h("ol", { class: "uses" }, hh.uses.map((u) => h("li", {}, h("b", {}, u.title), h("span", {}, u.body)))),
      h("p", { class: "hori-tip" }, hh.tip),
      h("a", { class: `tool-status ${st.cls}`, href: "shopping.html#buy" }, st.text))));

  for (const [need, g] of Object.entries(NEED)) {
    const list = tools.filter((t) => t.need === need && t.id !== "hori-hori");
    if (!list.length) continue;
    $("#tool-groups").append(h("div", { class: "tool-group", "data-need": need },
      h("div", { class: "tool-group-head" }, h("h3", {}, g.title), h("span", { class: "sub" }, g.sub)),
      h("div", { class: "tool-grid" }, list.map((t) => {
        const s = toolStatus(t, items, ticked);
        return h("article", { class: "tool" },
          icon(t.icon),
          h("div", {},
            h("h4", {}, t.name, t.aka && h("span", { class: "aka" }, ` · ${t.aka}`)),
            h("p", {}, t.why),
            need !== "have" && h(t.shop ? "a" : "span", { class: `tool-status ${s.cls}`, href: t.shop ? "shopping.html#buy" : null }, s.text)));
      }))));
  }
}
