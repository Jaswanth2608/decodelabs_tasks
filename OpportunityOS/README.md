# OpportunityOS

A student career and opportunity management platform, built with **HTML5, CSS3
and vanilla JavaScript only** — no frameworks, no CSS libraries, no build step,
no backend.

## Problem statement

Students juggle internship listings, application deadlines and interview stages
across bookmarks, notes and email. It is easy to lose track of what was saved,
what was applied to, and where each application currently stands.
OpportunityOS brings those three jobs into one calm interface: browse sample
opportunities, keep the ones worth returning to, and track every application
from first submission to final outcome.

## Project objectives

* Present opportunities in one searchable, filterable place.
* Let a student save opportunities without losing them on refresh.
* Track applications and their status through a five-stage pipeline.
* Show progress honestly: counts, a status breakdown, conversion rates and
  upcoming deadlines.
* Do all of this with plain HTML, CSS and JavaScript that a beginner can read
  and explain.
* Meet accessibility basics: keyboard operation, visible focus, clear labels,
  live announcements and meaningful empty states.

## Main features

* **Shared navigation shell** — a 240px sidebar at 1024px and above, and an
  accessible off-canvas drawer with a compact header below that.
* **Dashboard** — application and interview counts, saved opportunities,
  deadlines in the next 30 days, the five most recent applications and quick
  actions.
* **Explore Opportunities** — search by title or organisation, filter by type,
  work mode and location, open a details dialog, save or unsave opportunities.
* **My Applications** — five overview cards, a filterable application list with
  an inline status dropdown, an add-application dialog with validation and
  duplicate prevention, and per-row archive or delete behind a confirmation
  dialog. Archived applications are hidden from every page and can be restored
  from the Archived section.
* **Bookmarks** — the saved opportunities as cards, with remove, details and
  add-to-applications actions.
* **Analytics** — six overview numbers, a CSS bar chart of the five statuses,
  conversion insights, recent applications and upcoming opportunity deadlines.
* **Persistent demo data** — bookmarks and applications are stored in the
  browser with `localStorage`, seeded from sample data on first run.
* **Accessible interactions** — focus traps in the drawer and dialogs, Escape
  and backdrop closing, focus returned to the control that opened a dialog, and
  polite live regions for status changes and confirmations.
* **Responsive layout** — mobile-first CSS with only two breakpoints
  (`min-width: 768px` and `min-width: 1024px`).

## Technology stack

| Layer | What is used |
| --- | --- |
| Markup | HTML5 (`<time>`, `<table>`, `<dialog>`-style modal markup, landmark elements) |
| Styling | CSS3 custom properties, Grid, Flexbox, two mobile-first media queries |
| Behaviour | Vanilla JavaScript (ES5-style classic scripts, IIFEs, no modules, no bundler) |
| Storage | `window.localStorage` only |
| Data | A static sample dataset in `js/data.js` |
| Icons | Inline SVG for the menu and close buttons |
| Fonts | Inter and JetBrains Mono **if available**, otherwise system fonts |

No React, Vue, Angular, Bootstrap, Tailwind, chart library, icon package, build
tool or package manager is used.

## The five pages

| File | Page | What it does |
| --- | --- | --- |
| `index.html` | Dashboard | Counts, upcoming deadlines, recent applications, quick actions |
| `explore.html` | Explore Opportunities | Search, filters, opportunity cards, details dialog, save bookmarks |
| `applications.html` | My Applications | Overview cards, filterable list, inline status changes, add-application form |
| `bookmarks.html` | Bookmarks | Saved opportunities with remove, details and add-to-applications |
| `analytics.html` | Analytics | Overview numbers, status chart, conversion insights, deadlines |

Every page shares the same sidebar, header and skip link.

## Running the project locally

There is nothing to install.

1. Download or clone the folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).

The site also works from the file system (`file://`), because the scripts are
classic deferred scripts and every path is relative. If you prefer a local
server for development, any static server works, for example:

```bash
python -m http.server 8123
```

then visit `http://127.0.0.1:8123/index.html`.

No API keys, environment variables or accounts are needed.

## How localStorage is used

Two versioned keys hold everything the student creates:

| Key | Contents |
| --- | --- |
| `opportunityos.bookmarks.v1` | An array of opportunity IDs that are bookmarked |
| `opportunityos.applications.v1` | An array of application records |

Each application record looks like this:

```json
{
  "id": "app-1",
  "title": "Product Design Intern",
  "company": "Northwind Studio",
  "appliedOn": "2026-11-12",
  "status": "Under review",
  "archived": false
}
```

`archived` is `false` for everything being tracked. An archived record keeps its
`true` flag, which is why the Dashboard, Analytics and every count leave it out
while it can still be restored.

Rules the stores follow:

* **Seeded once.** The sample data in `js/data.js` fills a key only when that
  key does not exist yet. Existing user data is never overwritten.
* **One source of truth.** Bookmarks store only IDs, so opportunity details are
  never copied or stale. Every page reads the same store.
* **Safe reads.** Malformed JSON, duplicate IDs, missing fields, invalid status
  values and impossible calendar dates (for example `2026-13-45`) are discarded
  instead of breaking a page.
* **Session fallback.** If `localStorage` is blocked (private browsing, browser
  restrictions), the stores still work in memory for that visit, but the data
  cannot be remembered after a reload.

Clearing site data in the browser, or removing those two keys, resets the
project to its sample data.

## Project folder structure

```
OpportunityOS/
├── index.html            Dashboard
├── explore.html          Explore Opportunities
├── applications.html     My Applications
├── bookmarks.html        Bookmarks
├── analytics.html        Analytics
├── README.md
├── CSS/
│   └── style.css         All styles, in numbered sections:
│                         1–7  tokens, reset, typography, focus, breakpoints
│                         8–9  shell and responsive shell behaviour
│                         10   reusable components
│                         11   Dashboard layout
│                         12   Explore layout
│                         13   My Applications layout
│                         14   Bookmarks layout
│                         15   Analytics layout
└── js/
    ├── data.js           Sample opportunities and applications
    └── app.js            Shared stores plus one module per page:
                           shell, bookmarks store, status map, type map,
                           application store, dashboard, explore,
                           applications, bookmarks, analytics
```

`js/app.js` is loaded on every page, but each page module starts by checking for
its own root element and returns immediately if it is not on that page. That is
why one file can safely hold all five pages' behaviour.

## Design system

The visual system comes from approved wireframes (grayscale layout, spacing,
typography and components) with the final palette applied through CSS custom
properties in one place — the colour-token section of `CSS/style.css`.

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#F2F0EA` | Moonlit Grey page background |
| `--color-tint` | `#ADD4E0` | Ethereal Blue highlight surfaces and chart bars |
| `--color-accent` | `#A47864` | Mocha Mousse borders, chart bars |
| `--color-accent-strong` | `#7A5644` | Primary buttons, small accent text |
| `--color-ink` | `#2A2321` | Headings and body text |

Everything else uses those tokens: square corners, 1px hairline borders, no
shadows, no gradients beyond flat fills. No other file declares a colour.

Reusable components (section 10): buttons, badges, filter chips, inputs and
selects, checkbox/radio styling, cards and panels, tables with a scrolling
wrapper, empty states, placeholder patterns and the modal.

## Testing and responsive support

The project was tested manually in Chromium at **390px, 768px, 1024px and
1440px**, with no horizontal page overflow at any of those widths.

Checked during development:

* Every navigation link, script and stylesheet resolves.
* All five statuses can be set and survive a reload.
* New applications can be added; empty fields, missing dates, future dates and
  duplicate title + organisation combinations are rejected.
* Bookmark removal updates every page's count and never deletes an application.
* Add-to-applications refuses to create a second copy of the same role.
* Archiving an application removes it from the count, the Dashboard table and
  the Analytics chart, and restoring it brings it back; deleting it after
  confirmation removes it for good.
* Search, status, type, mode and location filters combine without resetting one
  another, and each page has a no-results state plus a genuine empty state.
* The drawer, all dialogs, focus traps, Escape and backdrop closing work.
* Malformed or unavailable `localStorage` does not break a page.
* `node --check js/app.js` passes, and the stylesheet has balanced braces.

Not automated: there is no test runner, no browser automation suite and no
accessibility audit tooling in the repository. Keyboard use and responsive
behaviour were verified by hand rather than by CI.

## Known limitations

* **Frontend only.** There is no backend, database, login or synchronisation.
  Data lives in one browser on one device.
* **Sample data only.** The 8 opportunities in `js/data.js` are invented for the
  demo. Nothing is fetched from a live job or internship service.
* **No live deadlines.** Opportunity deadlines are sample dates generated
  relative to today; application records have an applied-on date but no
  deadline of their own.
* **No cross-tab sync.** Two open tabs do not update each other until one is
  reloaded; there is no `storage` event listener.
* **No undo.** Bookmarks can be removed and re-added. Applications can be
  archived (reversible) or deleted permanently after a confirmation dialog, but
  a deleted application cannot be recovered and there is no undo for either
  action.
* **No editing.** An application's title, organisation and applied-on date are
  fixed once added; only its status, archive state and existence can change.
* **Reset means clearing site data.** Restoring the sample data requires
  clearing the two `localStorage` keys (or site data) in the browser.
* **Rounding.** Chart percentages are rounded to whole numbers, so they can add
  up to 99% or 101%.
* **Narrow tables scroll.** On the smallest screens the application tables
  scroll inside their wrapper rather than reflowing into cards.
* **Duplicates are matched by text.** "Already tracked" means the same title and
  organisation, compared case-insensitively; renaming a record could allow a
  duplicate later.

## Future improvements

* A backend with accounts, so data follows the student between devices.
* Editing applications after they are added, plus an undo for deletion and
  bookmark removal.
* A real opportunity source (API or admin-imported data) instead of samples.
* Deadlines tied to applications, with reminders and a calendar view.
* CSV or JSON export/import for backup.
* Cross-tab synchronisation with the `storage` event.
* Automated tests (DOM unit tests for the stores, end-to-end tests for the
  journeys) and an automated accessibility check.
* Optional interview notes, contact details and document attachments per
  application.
