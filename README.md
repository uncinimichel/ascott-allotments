# Ascott Allotments

Live at https://uncinimichel.github.io/ascott-allotments/

A phone-first site for my no-dig plot at Ascott Allotments, Ealing (3 × 3 m, two beds of 1.2 × 3 m).

| Page | What it does |
| --- | --- |
| `index.html` | Clearing the weeds: weed guide, plot plan drawn to scale, tools checklist, clearing steps, site rules with cultivation deadlines, before/after photos |
| `tracker.html` | Beds, plantings (sown / planted / harvest dates) and a weekly log, with backup export and import |
| `calendar.html` | Placeholder for the London no-dig calendar with weekly reminders |

Shared data lives in `data/`:

- `site.json`: weeds, plot layout, tools, steps and rules (used by the index, and later by the calendar)
- `garden.json`: seed data for the tracker on first visit
- `credits.json`: photo credits for `img/plants/` (all from Wikimedia Commons, freely licensed)

Tracker entries, ticked tools and progress photos are saved in the browser on the device you use. Export a tracker backup now and then.

## Run it locally

The pages load JSON, so they need a web server rather than opening the file directly:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

## Still to do

- Seed the tracker from `Ascott_NoDig_Planner.xlsx` (calendar, crop plan, fruit data)
- Check the weed guide against photos of the actual plot
- Calendar page with weekly reminders
- Plant/weed ID from a photo
- Offline support at the plot
