// Shopping page: checklists saved on the phone, plus trading hut opening times.
const SHOP_KEY = "ascott.shopping";
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

(async function main() {
  let site;
  try { site = await loadJSON("data/site.json"); }
  catch (err) {
    $("main").prepend(h("p", { class: "empty" }, "The shopping list didn't load. Open this page through a web server (see README)."));
    throw err;
  }
  renderLists(site.shopping.groups);
  renderHuts(site.tradingHuts);
  $("#bar-links").append(
    ...site.shopping.groups.map((g) => h("li", {}, h("a", { href: `#${g.id}` }, shortName(g.name)))),
    h("li", {}, h("a", { href: "#huts" }, "Huts")));
  initBar();
})();

const shortName = (name) => ({ "Ordered from Suttons": "Ordered", "Still to buy": "To buy", "Gather for free": "Free", "Clearing kit": "Kit" }[name] || name);

function renderLists(groups) {
  const saved = store.get(SHOP_KEY, {});
  const state = {};
  for (const g of groups) for (const it of g.items) state[it.id] = saved[it.id] ?? !!it.have;

  const progress = () => {
    const toBuy = groups.find((g) => g.id === "buy")?.items ?? [];
    const ordered = groups.find((g) => g.id === "ordered")?.items ?? [];
    const left = toBuy.filter((i) => !state[i.id]).length;
    const waiting = ordered.filter((i) => !state[i.id]).length;
    $("#progress").textContent = `${left ? `${left} thing${left === 1 ? "" : "s"} still to buy` : "Nothing left to buy"}, ${waiting ? `${waiting} order${waiting === 1 ? "" : "s"} still to arrive` : "all orders arrived"}.`;
    for (const g of groups) {
      const done = g.items.filter((i) => state[i.id]).length;
      $(`#count-${g.id}`).textContent = `${done} of ${g.items.length}`;
    }
  };

  $("#groups").append(...groups.map((g) => h("section", { id: g.id, "aria-labelledby": `${g.id}-h` },
    h("div", { class: "group-title" }, h("h2", { id: `${g.id}-h` }, g.name), h("span", { class: "count", id: `count-${g.id}` })),
    g.sub && h("p", { class: "sub" }, g.sub),
    h("ul", { class: "checklist" }, g.items.map((it) => {
      const id = `item-${it.id}`;
      return h("li", {}, h("label", { for: id },
        h("input", { type: "checkbox", id, checked: state[it.id], "aria-describedby": it.why ? `${id}-why` : null,
          onchange: (e) => { state[it.id] = e.target.checked; store.set(SHOP_KEY, state); progress(); } }),
        h("span", {},
          h("span", { class: "what" }, it.name, it.qty && h("span", { class: "qty" }, ` · ${it.qty}`)),
          it.why && h("span", { class: "why", id: `${id}-why` }, it.why))));
    })))));
  progress();
}

/* ---------- Trading huts ---------- */
const mins = (hhmm) => { const [a, b] = hhmm.split(":").map(Number); return a * 60 + b; };
const clock = (hhmm) => {
  const [a, b] = hhmm.split(":").map(Number);
  const hr = a % 12 || 12;
  return `${hr}${b ? `:${String(b).padStart(2, "0")}` : ""}${a < 12 ? "am" : "pm"}`;
};

function inClosedSeason(date, cs) {
  const m = date.getMonth() + 1, d = date.getDate();
  return m >= cs.fromMonth || m < cs.untilMonth || (m === cs.untilMonth && d < cs.untilDay);
}

// "Open now until 4pm", or when it next opens.
function hutStatus(hut, cs, now = new Date()) {
  if (inClosedSeason(now, cs)) return { open: false, text: `${cs.label}. Reopens mid-February.` };
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const today = hut.hours.find((s) => s.day === now.getDay() && nowMin >= mins(s.open) && nowMin < mins(s.close));
  if (today) return { open: true, text: `Open now until ${clock(today.close)}` };
  for (let add = 0; add < 8; add++) {
    const d = new Date(now); d.setDate(d.getDate() + add);
    if (inClosedSeason(d, cs)) return { open: false, text: `Closed now. ${cs.label}.` };
    const slot = hut.hours.filter((s) => s.day === d.getDay()).sort((a, b) => mins(a.open) - mins(b.open))
      .find((s) => add > 0 || mins(s.open) > nowMin);
    if (slot) {
      const when = add === 0 ? "today" : add === 1 ? "tomorrow" : DAY[d.getDay()];
      return { open: false, text: `Closed now. Opens ${when} at ${clock(slot.open)}` };
    }
  }
  return { open: false, text: "Closed" };
}

function renderHuts(t) {
  $("#huts-org").append(`Run by the ${t.org}. ${t.membership.perks} `,
    h("a", { href: t.hutsUrl, target: "_blank", rel: "noopener" }, "Trading huts page"), " · ",
    h("a", { href: t.url, target: "_blank", rel: "noopener" }, "EHAA website"));

  const draw = () => $("#hut-list").replaceChildren(...t.huts.map((hut) => {
    const st = hutStatus(hut, t.closedSeason);
    return h("article", { class: "hut" },
      h("div", { class: "hut-head" }, h("h3", {}, hut.name), h("span", { class: st.open ? "pill growing" : "pill" }, st.open ? "Open" : "Closed")),
      h("p", { class: "hut-status" }, st.text),
      h("ul", { class: "hours" }, hut.hours.slice().sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7)).map((s) =>
        h("li", {}, h("span", {}, DAY[s.day]), h("span", { class: "mono" }, `${clock(s.open)}–${clock(s.close)}`)))),
      hut.where && h("p", { class: "hut-where" }, hut.where));
  }).concat(h("p", { class: "hut-season" }, `${t.closedSeason.label}.`)));
  draw();
  setInterval(draw, 60_000);

  // Membership card: warn as the expiry date gets close.
  const valid = new Date(t.membership.validTo + "T23:59:59");
  const days = Math.ceil((valid - new Date()) / 86_400_000);
  const msg = days < 0 ? `Membership card expired on ${fmtDate(t.membership.validTo)}. Renew it to keep the member prices.`
    : days <= 45 ? `Membership card runs out on ${fmtDate(t.membership.validTo)}, in ${days} day${days === 1 ? "" : "s"}. Time to renew.`
    : `Membership card valid until ${fmtDate(t.membership.validTo)}.`;
  $("#member").replaceChildren(h("p", { class: days <= 45 ? "member-note warn" : "member-note" }, msg));
}
