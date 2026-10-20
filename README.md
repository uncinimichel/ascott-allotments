# Ascott Allotments

Live at https://uncinimichel.github.io/ascott-allotments/

A phone-first site for my no-dig plot at Ascott Allotments, Ealing (3 × 3 m, two beds of 1.2 × 3 m).

| Page | What it does |
| --- | --- |
| `index.html` | Clearing: weed guide (remove or keep), bed prep steps, site rules with cultivation deadlines, before/after photos |
| `plot.html` | The autumn 2026 layout drawn to scale (north up); tap a crop for its photo, months and catalogue link. Where the plot is on site, next summer's crops, pots |
| `catalog.html` | In four parts (vegetables, fruit, flowers, weeds). Every crop with a photo, a 12-month bar (sow, plant, harvest, flowers) with today marked, and how to grow it no-dig. `?date=2027-03-01` previews another day |
| `tracker.html` | Interactive plan: tap a planting to update it, tap empty ground to add one; beds, weekly log, backup |
| `shopping.html` | Orders, things to buy, free materials and kit as checklists; trading hut hours (open now or next opening) and membership |
| `calendar.html` | Placeholder for the London no-dig calendar with weekly reminders |

Shared data lives in `data/`:

- `site.json`: the source of truth: site and plot details, layout, next summer's plan, shopping lists, trading huts, weeds, steps and rules. The tracker seeds from its layout on first visit.
- `credits.json`: photo credits for `img/plants/` (all from Wikimedia Commons, freely licensed)
- `crop-credits.json`: photo credits for `img/crops/`, same source
- The catalogue lives in `site.json` under `catalog.crops`; layout, succession and pot entries point at it with `catalog` ids

Tracker entries, shopping ticks and progress photos are saved in the browser on the device you use. Export a tracker backup now and then.

## Run it locally

The pages load JSON, so they need a web server rather than opening the file directly:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Still to do

- Seed the tracker from `Ascott_NoDig_Planner.xlsx` (calendar, crop plan, fruit data)
- Check the weed guide against photos of the actual plot and the welcome email pictures
- Calendar page with weekly reminders
- Plant/weed ID from a photo
- Offline support at the plot
