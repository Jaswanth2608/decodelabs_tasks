/* ==========================================================================
   OpportunityOS — shared application shell
   --------------------------------------------------------------------------
   This file runs on all five pages and only handles the navigation drawer.

   What it does:
     1. Opens the drawer when the header menu button is clicked
     2. Closes it with the close button, the dimmed overlay, the Escape key,
        or by resizing the window up to desktop width
     3. Keeps keyboard focus inside the open drawer (a simple focus trap)
     4. Moves focus back to the menu button when the drawer closes

   It is a classic script (not a module) so the pages also work when opened
   directly from the file system, and it is wrapped in a function so nothing
   leaks into the global scope.
   ========================================================================== */

(function () {
  "use strict";

  /* At this width and above, the sidebar is always visible (see section 9 of
     the stylesheet), so the drawer behaviour must be switched off. */
  var DESKTOP_BREAKPOINT = 1024;

  /* --- Find the shell elements ----------------------------------------- */
  var body = document.body;
  var sidebar = document.getElementById("app-sidebar");
  var menuButton = document.querySelector("[data-menu-toggle]");
  var closeButton = document.querySelector("[data-menu-close]");
  var overlay = document.querySelector("[data-overlay]");

  /* If a page is ever missing the shell, stop quietly instead of throwing
     errors in the console. */
  if (!sidebar || !menuButton || !overlay) {
    return;
  }

  /* Remembers which element had focus before the drawer opened, so focus can
     be returned to it on close. */
  var lastFocusedElement = null;

  /* --- Helpers ----------------------------------------------------------- */

  function isDesktopWidth() {
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  }

  function isDrawerOpen() {
    return body.classList.contains("drawer-open");
  }

  /* Every element inside the drawer that can receive keyboard focus. */
  function getFocusableItems() {
    return sidebar.querySelectorAll("a[href], button:not([disabled])");
  }

  /* --- Open and close ---------------------------------------------------- */

  function openDrawer() {
    if (isDrawerOpen()) {
      return;
    }

    lastFocusedElement = document.activeElement;

    body.classList.add("drawer-open");
    menuButton.setAttribute("aria-expanded", "true");
    document.addEventListener("keydown", handleKeydown);

    /* Move focus into the drawer, so keyboard users are where the visual
       focus is. */
    var items = getFocusableItems();
    if (items.length > 0) {
      items[0].focus();
    }
  }

  function closeDrawer() {
    if (!isDrawerOpen()) {
      return;
    }

    body.classList.remove("drawer-open");
    menuButton.setAttribute("aria-expanded", "false");
    document.removeEventListener("keydown", handleKeydown);

    /* Return focus to where it was. The fallback handles the rare case where
       that element no longer exists on the page. */
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    } else {
      menuButton.focus();
    }

    lastFocusedElement = null;
  }

  function toggleDrawer() {
    if (isDrawerOpen()) {
      closeDrawer();
    } else {
      openDrawer();
    }
  }

  /* --- Keyboard behaviour ------------------------------------------------ */

  function handleKeydown(event) {
    /* Escape always closes the drawer. */
    if (event.key === "Escape") {
      event.preventDefault();
      closeDrawer();
      return;
    }

    /* Tab is kept inside the drawer while it is open: tabbing forward from
       the last item wraps to the first, and shift+tab backwards from the
       first wraps to the last. */
    if (event.key !== "Tab") {
      return;
    }

    var items = getFocusableItems();
    if (items.length === 0) {
      return;
    }

    var firstItem = items[0];
    var lastItem = items[items.length - 1];

    if (event.shiftKey && document.activeElement === firstItem) {
      event.preventDefault();
      lastItem.focus();
    } else if (!event.shiftKey && document.activeElement === lastItem) {
      event.preventDefault();
      firstItem.focus();
    }
  }

  /* --- Window resizing --------------------------------------------------- */

  /* Growing the window past the breakpoint shows the fixed sidebar, so the
     drawer state and its Escape listener must be cleared. */
  function handleResize() {
    if (isDesktopWidth() && isDrawerOpen()) {
      body.classList.remove("drawer-open");
      menuButton.setAttribute("aria-expanded", "false");
      document.removeEventListener("keydown", handleKeydown);
      lastFocusedElement = null;
    }
  }

  /* --- Wire everything up ------------------------------------------------ */

  menuButton.addEventListener("click", toggleDrawer);

  if (closeButton) {
    closeButton.addEventListener("click", closeDrawer);
  }

  /* Clicking the dimmed area outside the drawer closes it (mouse and touch
     users; keyboard users have Escape). */
  overlay.addEventListener("click", closeDrawer);

  window.addEventListener("resize", handleResize);
})();


/* ==========================================================================
   OpportunityOS — bookmark store (shared by Explore and the Dashboard)
   --------------------------------------------------------------------------
   Bookmarks are just opportunity IDs, kept in localStorage under one versioned
   key. This block runs before the page modules so both Explore and the
   Dashboard read the same list and therefore always agree.

   Why only IDs? Storing IDs keeps a single source of truth for the opportunity
   details (js/data.js) and stops old copies of records piling up in storage.
   ========================================================================== */

(function () {
  "use strict";

  var STORAGE_KEY = "opportunityos.bookmarks.v1";

  /* The starting bookmarks: the records flagged saved: true in the sample
     data. They are only used the first time, when the key does not exist yet. */
  var sampleData = window.OpportunityOS_DATA || { opportunities: [] };
  var seedIds = sampleData.opportunities
    .filter(function (opportunity) {
      return opportunity.saved === true;
    })
    .map(function (opportunity) {
      return opportunity.id;
    });

  var ids = [];
  var storageAvailable = checkStorage();

  /* localStorage can be blocked (private mode, file:// restrictions). The
     store still works for the session, it just cannot remember anything. */
  function checkStorage() {
    try {
      var testKey = "opportunityos.storage-test";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* Reads the saved IDs. Returns null when the key has never been written, so
     the caller can tell "empty" apart from "not set up yet". */
  function readIds() {
    if (!storageAvailable) {
      return null;
    }

    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }

      var parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter(function (id) {
            return typeof id === "string";
          })
        : [];
    } catch (error) {
      return [];
    }
  }

  /* Saves the current IDs. A failure here only costs persistence, never the
     in-memory list, so the page keeps working. */
  function writeIds() {
    if (!storageAvailable) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      /* Ignore: the session copy in `ids` still works. */
    }
  }

  /* Removes any repeated ID, so the store can never hold duplicates even if
     something else once wrote to the same key. */
  function withoutDuplicates(list) {
    var unique = [];
    list.forEach(function (id) {
      if (unique.indexOf(id) === -1) {
        unique.push(id);
      }
    });
    return unique;
  }

  /* --- Start-up: seed once, never overwrite ----------------------------- */
  var stored = readIds();

  if (stored === null) {
    /* First run in this browser: start from the sample saved flags. */
    ids = withoutDuplicates(seedIds);
    writeIds();
  } else {
    /* Existing bookmarks always win; they are never replaced by the seed. */
    ids = withoutDuplicates(stored);
  }

  /* --- Public methods ---------------------------------------------------- */
  function has(id) {
    return ids.indexOf(id) !== -1;
  }

  function count() {
    return ids.length;
  }

  /* Returns a copy, so callers cannot change the store by accident. */
  function list() {
    return ids.slice();
  }

  /* Adds or removes one ID and reports the new state:
     true  = the opportunity is now bookmarked
     false = the bookmark was removed */
  function toggle(id) {
    if (!id) {
      return false;
    }

    var index = ids.indexOf(id);

    if (index === -1) {
      ids.push(id);
      writeIds();
      return true;
    }

    ids.splice(index, 1);
    writeIds();
    return false;
  }

  window.OpportunityOS = window.OpportunityOS || {};
  window.OpportunityOS.bookmarks = {
    storageKey: STORAGE_KEY,
    has: has,
    count: count,
    list: list,
    toggle: toggle
  };
})();


/* ==========================================================================
   OpportunityOS — application statuses (shared by every page)
   --------------------------------------------------------------------------
   One map decides which statuses exist and which badge style each one uses.
   The Dashboard and the My Applications page both read it, so the same
   application can never look different on two pages.
   ========================================================================== */

(function () {
  "use strict";

  /* The five statuses, in the order they are offered in a dropdown. */
  var STATUSES = ["Applied", "Under review", "Interview", "Offer", "Rejected"];

  /* One badge style per status. The classes come from section 10.2 of the
     stylesheet. */
  var STATUS_BADGES = {
    Applied: "badge--neutral",
    "Under review": "badge--neutral",
    Interview: "badge--info",
    Offer: "badge--accent",
    Rejected: "badge--strong"
  };

  function isValidStatus(status) {
    return STATUSES.indexOf(status) !== -1;
  }

  function badgeClass(status) {
    /* An unknown value falls back to the neutral badge instead of breaking. */
    return STATUS_BADGES[status] || "badge--neutral";
  }

  window.OpportunityOS = window.OpportunityOS || {};
  window.OpportunityOS.statuses = {
    list: STATUSES.slice(),
    isValid: isValidStatus,
    badgeClass: badgeClass
  };
})();


/* ==========================================================================
   OpportunityOS — opportunity types (shared by every page)
   --------------------------------------------------------------------------
   One map decides which types exist and which badge style each one uses, so
   Explore and Bookmarks draw the same card header the same way.
   ========================================================================== */

(function () {
  "use strict";

  var TYPES = ["Internship", "Job", "Hackathon"];

  /* One badge style per type. The classes come from section 10.2. */
  var TYPE_BADGES = {
    Internship: "badge--accent",
    Job: "badge--info",
    Hackathon: "badge--strong"
  };

  function badgeClass(type) {
    /* An unknown value falls back to the neutral badge instead of breaking. */
    return TYPE_BADGES[type] || "badge--neutral";
  }

  window.OpportunityOS = window.OpportunityOS || {};
  window.OpportunityOS.types = {
    list: TYPES.slice(),
    badgeClass: badgeClass
  };
})();


/* ==========================================================================
   OpportunityOS — application store (shared by My Applications and Dashboard)
   --------------------------------------------------------------------------
   The user's applications live in localStorage under one versioned key, so a
   status changed on the My Applications page is still there after a reload
   and is what the Dashboard reads too.

   The store is seeded from the sample applications in js/data.js the first
   time the site runs in a browser, and never overwrites records the user has
   since saved. If localStorage is unavailable (private mode, for example) the
   store still works for the session and simply cannot remember anything.
   ========================================================================== */

(function () {
  "use strict";

  var statuses = window.OpportunityOS && window.OpportunityOS.statuses;
  if (!statuses) {
    return;
  }

  var STORAGE_KEY = "opportunityos.applications.v1";
  var sampleData = window.OpportunityOS_DATA || { applications: [] };

  var records = [];
  var storageAvailable = checkStorage();
  var lastIdTimestamp = 0;

  function checkStorage() {
    try {
      var testKey = "opportunityos.storage-test";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return true;
    } catch (error) {
      return false;
    }
  }

  /* --- Reading and writing --------------------------------------------- */

  /* A date must exist on the calendar, not just look like YYYY-MM-DD:
     2026-13-45 matches the pattern but is not a real day, and would otherwise
     be stored and then displayed as 14 Feb 2027. */
  function isRealDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    var parts = value.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  /* Turns anything from storage or from the form into a clean record, or null
     when a required field is missing. Keeping this in one place means a
     corrupt entry can never reach a page. */
  function normalise(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    function text(value) {
      return typeof value === "string" ? value.trim() : "";
    }

    var id = text(record.id);
    var title = text(record.title);
    var company = text(record.company);
    var appliedOn = text(record.appliedOn);

    if (!id || !title || !company) {
      return null;
    }

    /* Dates are always stored as YYYY-MM-DD, which also sorts correctly as
       plain text. */
    if (!isRealDate(appliedOn)) {
      return null;
    }

    return {
      id: id,
      title: title,
      company: company,
      appliedOn: appliedOn,
      status: statuses.isValid(record.status) ? record.status : "Applied",
      /* Anything other than an explicit true is treated as active, so older
         saved records and the sample data load without a migration. */
      archived: record.archived === true
    };
  }

  /* Keeps the first record for each ID, so a doubled entry can never show up
     twice in a list. */
  function withoutDuplicateIds(list) {
    var seen = [];
    var unique = [];

    list.forEach(function (record) {
      if (!record || seen.indexOf(record.id) !== -1) {
        return;
      }

      seen.push(record.id);
      unique.push(record);
    });

    return unique;
  }

  function cleanRecords(input) {
    if (!Array.isArray(input)) {
      return [];
    }

    return withoutDuplicateIds(
      input
        .map(normalise)
        .filter(function (record) {
          return record !== null;
        })
    );
  }

  /* Returns null when the key has never been written, so start-up can tell
     "not set up yet" apart from "the user removed every application". */
  function readRecords() {
    if (!storageAvailable) {
      return null;
    }

    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }

      return cleanRecords(JSON.parse(raw));
    } catch (error) {
      return [];
    }
  }

  function writeRecords() {
    if (!storageAvailable) {
      return;
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      /* Ignore: the session copy in `records` still works. */
    }
  }

  /* --- Start-up: seed once, never overwrite ----------------------------- */

  var stored = readRecords();

  if (stored === null) {
    /* First run in this browser: start from the sample applications. */
    records = cleanRecords(sampleData.applications || []);
    writeRecords();
  } else {
    /* Existing records always win; they are never replaced by the seed. */
    records = stored;
  }

  /* --- Helpers ----------------------------------------------------------- */

  /* Every record the student is still tracking. Archived records sit in the
     same array but are left out of every list, count and duplicate check, so
     the Dashboard and Analytics stop including them automatically. */
  function activeRecords() {
    return records.filter(function (record) {
      return record.archived !== true;
    });
  }

  /* Returns a copy, so callers cannot change the store by accident. */
  function copy(record) {
    return {
      id: record.id,
      title: record.title,
      company: record.company,
      appliedOn: record.appliedOn,
      status: record.status,
      archived: record.archived === true
    };
  }

  /* Titles and organisations are compared trimmed and case-insensitively, so
     "Kestrel Labs " and "kestrel labs" count as the same employer. */
  function sameText(first, second) {
    return (
      String(first).trim().toLowerCase() === String(second).trim().toLowerCase()
    );
  }

  /* Two applications can be added within the same millisecond, so each new ID
     is forced to be larger than the previous one. */
  function nextId() {
    var stamp = Date.now();

    if (stamp <= lastIdTimestamp) {
      stamp = lastIdTimestamp + 1;
    }

    lastIdTimestamp = stamp;
    return "app-" + stamp;
  }

  /* --- Public methods ---------------------------------------------------- */

  /* The applications still being tracked. */
  function list() {
    return activeRecords().map(copy);
  }

  /* The applications the student archived, in the order they were stored. */
  function listArchived() {
    return records
      .filter(function (record) {
        return record.archived === true;
      })
      .map(copy);
  }

  /* Returns the existing record with this title and organisation, or null.
     Archived records are ignored, so an archived role can be tracked again. */
  function findDuplicate(title, company) {
    var active = activeRecords();

    for (var index = 0; index < active.length; index += 1) {
      if (
        sameText(active[index].title, title) &&
        sameText(active[index].company, company)
      ) {
        return copy(active[index]);
      }
    }

    return null;
  }

  /* Returns { ok: true, application } or { ok: false, reason }, where reason is
     "invalid" (a required field is missing) or "duplicate". */
  function add(record) {
    var source = record || {};
    var candidate = normalise({
      id: source.id || nextId(),
      title: source.title,
      company: source.company,
      appliedOn: source.appliedOn,
      status: source.status
    });

    if (!candidate) {
      return { ok: false, reason: "invalid" };
    }

    if (findDuplicate(candidate.title, candidate.company)) {
      return { ok: false, reason: "duplicate" };
    }

    records.push(candidate);
    writeRecords();

    return { ok: true, application: copy(candidate) };
  }

  /* Changes one record's status. An unknown ID or status is ignored and
     reported as false. */
  function setStatus(id, status) {
    if (!statuses.isValid(status)) {
      return false;
    }

    for (var index = 0; index < records.length; index += 1) {
      if (records[index].id === id) {
        records[index].status = status;
        writeRecords();
        return true;
      }
    }

    return false;
  }

  /* The total plus a count for every status, all at zero when there is
     nothing to count. Archived applications are not counted. */
  function countByStatus() {
    var active = activeRecords();
    var counts = { total: active.length };

    statuses.list.forEach(function (status) {
      counts[status] = 0;
    });

    active.forEach(function (record) {
      counts[record.status] += 1;
    });

    return counts;
  }

  /* Hides one record without losing it. Returns false for an unknown ID or a
     record that is already archived. */
  function archive(id) {
    for (var index = 0; index < records.length; index += 1) {
      if (records[index].id === id && records[index].archived !== true) {
        records[index].archived = true;
        writeRecords();
        return true;
      }
    }

    return false;
  }

  /* Brings an archived record back into the tracker. */
  function restore(id) {
    for (var index = 0; index < records.length; index += 1) {
      if (records[index].id === id && records[index].archived === true) {
        records[index].archived = false;
        writeRecords();
        return true;
      }
    }

    return false;
  }

  /* Deletes one record for good. There is no undo, so callers confirm first.
     Returns false when the ID is unknown. */
  function remove(id) {
    for (var index = 0; index < records.length; index += 1) {
      if (records[index].id === id) {
        records.splice(index, 1);
        writeRecords();
        return true;
      }
    }

    return false;
  }

  window.OpportunityOS.applications = {
    storageKey: STORAGE_KEY,
    list: list,
    listArchived: listArchived,
    add: add,
    setStatus: setStatus,
    countByStatus: countByStatus,
    findDuplicate: findDuplicate,
    archive: archive,
    restore: restore,
    remove: remove
  };
})();


/* ==========================================================================
   OpportunityOS — dashboard
   --------------------------------------------------------------------------
   This block only runs on the Dashboard page: it looks for #dashboard and
   stops immediately on the other four pages, so it never interferes with the
   navigation code above.

   It reads the sample data from js/data.js and writes three things into the
   page: the four overview numbers, the recent applications table, and the
   upcoming deadline list. Everything is built from the data, so the page can
   never show a number that disagrees with the rows underneath it.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Only run on the dashboard ---------------------------------------- */
  var dashboard = document.getElementById("dashboard");
  if (!dashboard) {
    return;
  }

  var sampleData = window.OpportunityOS_DATA;
  if (!sampleData) {
    return;
  }

  var opportunities = sampleData.opportunities || [];
  var applicationStore = window.OpportunityOS && window.OpportunityOS.applications;
  var statusMap = window.OpportunityOS && window.OpportunityOS.statuses;

  /* --- Settings --------------------------------------------------------- */
  var DEADLINE_WINDOW_DAYS = 30; /* "upcoming" means within 30 days   */
  var URGENT_WINDOW_DAYS = 7; /* deadlines this close get highlighted */
  var RECENT_APPLICATION_LIMIT = 5;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  /* --- Applications ------------------------------------------------------
     Applications are always read from the shared store above, so a status
     changed (or a row added) on the My Applications page shows up here as
     soon as this page is opened or reloaded. The sample array is only a
     fallback for the unlikely case that the store did not load. */
  function getApplications() {
    if (applicationStore) {
      return applicationStore.list();
    }

    return sampleData.applications || [];
  }

  /* Badge styles come from the shared status map, so every page draws the
     same status the same way. */
  function badgeFor(status) {
    return statusMap ? statusMap.badgeClass(status) : "badge--neutral";
  }

  /* --- Dates ------------------------------------------------------------ */

  /* A date without a time, so comparisons ignore the clock. */
  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /* Turns "2026-11-20" into a Date in local time. */
  function parseIsoDate(isoDate) {
    var parts = isoDate.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  /* Whole days between today and the given date.
     0 = today, 3 = in three days, -2 = two days ago. */
  function daysUntil(isoDate) {
    return Math.round((parseIsoDate(isoDate) - today()) / MS_PER_DAY);
  }

  /* Readable date, for example "20 Nov 2026". */
  var dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  function formatDate(isoDate) {
    return dateFormatter.format(parseIsoDate(isoDate));
  }

  /* Friendly countdown, for example "In 3 days" or "Today". */
  function formatCountdown(days) {
    if (days === 0) {
      return "Today";
    }
    if (days === 1) {
      return "Tomorrow";
    }
    return "In " + days + " days";
  }

  /* --- Calculations ------------------------------------------------------ */

  function countInterviews() {
    return getApplications().filter(function (application) {
      return application.status === "Interview";
    }).length;
  }

  /* Saved opportunities are read from the shared bookmark store, so the
     dashboard and Explore always show the same number. If the store is
     missing for any reason, fall back to the sample saved flags. */
  function countSaved() {
    if (window.OpportunityOS && window.OpportunityOS.bookmarks) {
      return window.OpportunityOS.bookmarks.count();
    }

    return opportunities.filter(function (opportunity) {
      return opportunity.saved === true;
    }).length;
  }

  /* Upcoming means: not expired (0 days or more) and within the window.
     The list is sorted so the nearest deadline is always first. */
  function getUpcomingDeadlines() {
    return opportunities
      .filter(function (opportunity) {
        var days = daysUntil(opportunity.deadline);
        return days >= 0 && days <= DEADLINE_WINDOW_DAYS;
      })
      .sort(function (a, b) {
        return parseIsoDate(a.deadline) - parseIsoDate(b.deadline);
      });
  }

  /* --- Small DOM helpers -------------------------------------------------- */

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  /* --- 1. Overview numbers ------------------------------------------------ */

  function renderStats(deadlineCount) {
    setText("stat-applications", getApplications().length);
    setText("stat-interviews", countInterviews());
    setText("stat-saved", countSaved());
    setText("stat-deadlines", deadlineCount);
  }

  /* --- 2. Recent applications --------------------------------------------- */

  function renderApplications() {
    var tableWrapper = document.getElementById("recent-applications-wrap");
    var tableBody = document.getElementById("recent-applications-body");
    var emptyState = document.getElementById("recent-applications-empty");

    if (!tableWrapper || !tableBody || !emptyState) {
      return;
    }

    /* Newest first, then trimmed to the five most recent. */
    var recent = getApplications()
      .slice()
      .sort(function (a, b) {
        return parseIsoDate(b.appliedOn) - parseIsoDate(a.appliedOn);
      })
      .slice(0, RECENT_APPLICATION_LIMIT);

    tableBody.textContent = "";

    if (recent.length === 0) {
      tableWrapper.hidden = true;
      emptyState.hidden = false;
      return;
    }

    tableWrapper.hidden = false;
    emptyState.hidden = true;

    recent.forEach(function (application) {
      var row = document.createElement("tr");

      row.appendChild(createElement("td", "", application.title));
      row.appendChild(createElement("td", "", application.company));
      row.appendChild(
        createElement("td", "table__num", formatDate(application.appliedOn))
      );

      /* Status is shown as a badge, always with its text so the meaning is
         never carried by colour alone. */
      var statusCell = document.createElement("td");
      var badgeClass = badgeFor(application.status);
      statusCell.appendChild(
        createElement("span", "badge " + badgeClass, application.status)
      );
      row.appendChild(statusCell);

      tableBody.appendChild(row);
    });
  }

  /* --- 3. Upcoming deadlines ---------------------------------------------- */

  function renderDeadlines(deadlines) {
    var list = document.getElementById("deadline-list");
    var emptyState = document.getElementById("deadlines-empty");

    if (!list || !emptyState) {
      return;
    }

    list.textContent = "";

    if (deadlines.length === 0) {
      list.hidden = true;
      emptyState.hidden = false;
      return;
    }

    list.hidden = false;
    emptyState.hidden = true;

    deadlines.forEach(function (opportunity) {
      var days = daysUntil(opportunity.deadline);
      var isUrgent = days <= URGENT_WINDOW_DAYS;

      var item = createElement(
        "li",
        "deadline" + (isUrgent ? " deadline--urgent" : "")
      );

      var main = createElement("div", "deadline__main");
      main.appendChild(createElement("p", "deadline__title", opportunity.title));
      main.appendChild(
        createElement(
          "p",
          "deadline__meta",
          opportunity.organisation + " \u00b7 " + opportunity.type
        )
      );

      var dateBlock = createElement("div", "deadline__date");

      /* A real <time> element with a machine-readable date. */
      var time = createElement("time", "", formatDate(opportunity.deadline));
      time.setAttribute("datetime", opportunity.deadline);
      dateBlock.appendChild(time);
      dateBlock.appendChild(
        createElement(
          "span",
          "deadline__countdown",
          isUrgent ? "Closing soon \u00b7 " + formatCountdown(days) : formatCountdown(days)
        )
      );

      item.appendChild(main);
      item.appendChild(dateBlock);
      list.appendChild(item);
    });
  }

  /* --- 4. Draw everything -------------------------------------------------- */

  function renderDashboard() {
    var deadlines = getUpcomingDeadlines();
    renderStats(deadlines.length);
    renderApplications();
    renderDeadlines(deadlines);
  }

  /* A small hook so the renderer can be re-run later (for example once
     bookmarks and applications are editable) and so the empty state can be
     checked from the browser console while developing. */
  window.OpportunityOS = window.OpportunityOS || {};
  window.OpportunityOS.renderDashboard = renderDashboard;

  renderDashboard();
})();


/* ==========================================================================
   OpportunityOS — explore opportunities
   --------------------------------------------------------------------------
   This block only runs on explore.html (#explore). It filters the shared
   sample dataset, draws the cards, opens the details modal and saves
   bookmarks through the shared bookmark store above.

   Filtering is kept in one small `state` object so the four controls can
   never reset each other: every control changes one property and then calls
   render() again.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Only run on the Explore page -------------------------------------- */
  var explore = document.getElementById("explore");
  if (!explore) {
    return;
  }

  var sampleData = window.OpportunityOS_DATA;
  var bookmarks = window.OpportunityOS && window.OpportunityOS.bookmarks;

  if (!sampleData || !bookmarks) {
    return;
  }

  var opportunities = sampleData.opportunities || [];

  /* --- Elements ---------------------------------------------------------- */
  var filters = document.getElementById("filters");
  var searchInput = document.getElementById("search-input");
  var locationSelect = document.getElementById("location-select");
  var typeGroup = document.querySelector('[data-filter-group="type"]');
  var modeGroup = document.querySelector('[data-filter-group="mode"]');
  var list = document.getElementById("opportunity-list");
  var emptyState = document.getElementById("opportunities-empty");
  var resultCount = document.getElementById("result-count");
  var bookmarkStatus = document.getElementById("bookmark-status");
  var clearButtons = document.querySelectorAll("[data-clear-filters]");

  var modal = document.getElementById("opportunity-modal");
  var modalTitle = document.getElementById("opportunity-modal-title");
  var modalSummary = document.getElementById("opportunity-modal-summary");
  var modalDetails = document.getElementById("opportunity-modal-details");

  /* Badge styles come from the shared type map near the top of this file, so
     Explore and Bookmarks can never draw a type differently. */
  var types = window.OpportunityOS && window.OpportunityOS.types;

  /* --- State ------------------------------------------------------------- */
  var state = {
    search: "",
    type: "all",
    mode: "all",
    location: "all"
  };

  var lastFocusedElement = null;
  var toastTimer = null;

  /* --- Dates -------------------------------------------------------------
     Small local helpers. The dashboard keeps its own copy so each page module
     stays easy to read on its own. */
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  function parseIsoDate(isoDate) {
    var parts = isoDate.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function formatDate(isoDate) {
    return dateFormatter.format(parseIsoDate(isoDate));
  }

  function daysUntil(isoDate) {
    return Math.round((parseIsoDate(isoDate) - today()) / MS_PER_DAY);
  }

  function countdownLabel(days) {
    if (days < 0) {
      return "Closed";
    }
    if (days === 0) {
      return "today";
    }
    if (days === 1) {
      return "tomorrow";
    }
    return "in " + days + " days";
  }

  /* --- Filtering --------------------------------------------------------- */

  function matchesFilters(opportunity) {
    var term = state.search.trim().toLowerCase();

    /* Search covers both the title and the organisation. */
    if (term) {
      var searchable = (
        opportunity.title +
        " " +
        opportunity.organisation
      ).toLowerCase();

      if (searchable.indexOf(term) === -1) {
        return false;
      }
    }

    if (state.type !== "all" && opportunity.type !== state.type) {
      return false;
    }

    if (state.mode !== "all" && opportunity.mode !== state.mode) {
      return false;
    }

    if (state.location !== "all" && opportunity.location !== state.location) {
      return false;
    }

    return true;
  }

  /* --- Card building ----------------------------------------------------- */

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function buildCard(opportunity) {
    var card = createElement("li", "card opportunity-card");

    /* Header: title and type badge. */
    var header = createElement("div", "card__header");
    header.appendChild(createElement("h3", "card__title", opportunity.title));

    var badgeClass = types ? types.badgeClass(opportunity.type) : "badge--neutral";
    header.appendChild(
      createElement("span", "badge " + badgeClass, opportunity.type)
    );
    card.appendChild(header);

    /* Organisation, mode and location. */
    card.appendChild(
      createElement("p", "opportunity-card__org", opportunity.organisation)
    );
    card.appendChild(
      createElement(
        "p",
        "opportunity-card__meta",
        opportunity.mode + " \u00b7 " + opportunity.location
      )
    );

    /* Deadline with a machine-readable <time> element. */
    var days = daysUntil(opportunity.deadline);
    var deadline = createElement("p", "opportunity-card__deadline");
    var time = createElement("time", "", formatDate(opportunity.deadline));
    time.setAttribute("datetime", opportunity.deadline);
    deadline.appendChild(document.createTextNode("Closes "));
    deadline.appendChild(time);
    deadline.appendChild(
      document.createTextNode(" \u00b7 " + countdownLabel(days))
    );
    card.appendChild(deadline);

    card.appendChild(
      createElement("p", "opportunity-card__summary", opportunity.summary)
    );

    /* Footer: Save / Saved toggle and View details. */
    var footer = createElement("div", "card__footer");
    var isSaved = bookmarks.has(opportunity.id);

    var saveButton = createElement(
      "button",
      "btn btn--secondary",
      isSaved ? "Saved" : "Save"
    );
    saveButton.type = "button";
    saveButton.setAttribute("aria-pressed", isSaved ? "true" : "false");
    saveButton.setAttribute("data-action", "bookmark");
    saveButton.setAttribute("data-id", opportunity.id);
    footer.appendChild(saveButton);

    var detailsButton = createElement(
      "button",
      "btn btn--tertiary",
      "View details"
    );
    detailsButton.type = "button";
    detailsButton.setAttribute("data-action", "details");
    detailsButton.setAttribute("data-id", opportunity.id);
    detailsButton.setAttribute(
      "aria-label",
      "View details for " + opportunity.title
    );
    footer.appendChild(detailsButton);

    card.appendChild(footer);
    return card;
  }

  /* --- Rendering --------------------------------------------------------- */

  function render() {
    var matches = opportunities.filter(matchesFilters);

    list.textContent = "";
    resultCount.textContent =
      "Showing " +
      matches.length +
      " of " +
      opportunities.length +
      " sample opportunities";

    if (matches.length === 0) {
      list.hidden = true;
      emptyState.hidden = false;
      return;
    }

    list.hidden = false;
    emptyState.hidden = true;

    matches.forEach(function (opportunity) {
      list.appendChild(buildCard(opportunity));
    });
  }

  /* --- Bookmarking -------------------------------------------------------- */

  function announce(message) {
    if (!bookmarkStatus) {
      return;
    }

    bookmarkStatus.textContent = message;
    bookmarkStatus.classList.add("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      bookmarkStatus.classList.remove("is-visible");
      bookmarkStatus.textContent = "";
    }, 3000);
  }

  function toggleBookmark(opportunity, button) {
    /* The store prevents duplicates and reports the new state. */
    var isSaved = bookmarks.toggle(opportunity.id);

    button.setAttribute("aria-pressed", isSaved ? "true" : "false");
    button.textContent = isSaved ? "Saved" : "Save";

    announce((isSaved ? "Saved " : "Removed ") + opportunity.title);
  }

  /* --- Details modal ------------------------------------------------------ */

  function addDetail(label, value) {
    modalDetails.appendChild(createElement("dt", "", label));
    modalDetails.appendChild(createElement("dd", "", value));
  }

  function openModal(opportunity, trigger) {
    lastFocusedElement = trigger || document.activeElement;

    modalTitle.textContent = opportunity.title;
    modalSummary.textContent = opportunity.summary;
    modalDetails.textContent = "";

    addDetail("Organisation", opportunity.organisation);
    addDetail("Type", opportunity.type);
    addDetail("Work mode", opportunity.mode);
    addDetail("Location", opportunity.location);
    addDetail("Deadline", formatDate(opportunity.deadline));
    addDetail("Time left", countdownLabel(daysUntil(opportunity.deadline)));

    modal.hidden = false;
    document.addEventListener("keydown", handleModalKeydown);

    /* Focus the close button so keyboard users start inside the dialog. */
    var closeButton = modal.querySelector("[data-modal-close]");
    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeModal() {
    if (modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.removeEventListener("keydown", handleModalKeydown);

    /* Return focus to the button that opened the dialog. */
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    } else {
      searchInput.focus();
    }

    lastFocusedElement = null;
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    /* Keep Tab inside the dialog while it is open. */
    if (event.key !== "Tab") {
      return;
    }

    var focusable = modal.querySelectorAll(
      "button:not([disabled]), a[href], input, select, textarea"
    );

    if (focusable.length === 0) {
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* --- Clearing ----------------------------------------------------------- */

  function clearFilters() {
    var focusWasInEmptyState = emptyState.contains(document.activeElement);

    state.search = "";
    state.type = "all";
    state.mode = "all";
    state.location = "all";

    searchInput.value = "";
    locationSelect.value = "all";

    [typeGroup, modeGroup].forEach(function (group) {
      if (!group) {
        return;
      }

      Array.prototype.forEach.call(
        group.querySelectorAll("button[data-value]"),
        function (chip) {
          var isAll = chip.getAttribute("data-value") === "all";
          chip.setAttribute("aria-pressed", isAll ? "true" : "false");
        }
      );
    });

    render();

    /* If the empty state's button is what was clicked, it is about to be
       hidden, so move focus somewhere sensible instead of losing it. */
    if (focusWasInEmptyState) {
      searchInput.focus();
    }
  }

  /* --- Wiring ------------------------------------------------------------- */

  /* Location options come from the dataset, so they can never drift out of
     date when the sample data changes. */
  function fillLocations() {
    var locations = [];

    opportunities.forEach(function (opportunity) {
      if (locations.indexOf(opportunity.location) === -1) {
        locations.push(opportunity.location);
      }
    });

    locations.sort();

    locations.forEach(function (location) {
      var option = document.createElement("option");
      option.value = location;
      option.textContent = location;
      locationSelect.appendChild(option);
    });
  }

  /* The form has no submit button, but pressing Enter in the search field can
     still submit it; keep the page where it is. */
  if (filters) {
    filters.addEventListener("submit", function (event) {
      event.preventDefault();
    });
  }

  searchInput.addEventListener("input", function () {
    state.search = searchInput.value;
    render();
  });

  locationSelect.addEventListener("change", function () {
    state.location = locationSelect.value;
    render();
  });

  /* Each chip group updates only its own part of the state. */
  [typeGroup, modeGroup].forEach(function (group) {
    if (!group) {
      return;
    }

    group.addEventListener("click", function (event) {
      var chip = event.target.closest("button[data-value]");
      if (!chip) {
        return;
      }

      var key = group.getAttribute("data-filter-group");
      if (!key) {
        return;
      }

      state[key] = chip.getAttribute("data-value");

      Array.prototype.forEach.call(
        group.querySelectorAll("button[data-value]"),
        function (item) {
          item.setAttribute(
            "aria-pressed",
            item === chip ? "true" : "false"
          );
        }
      );

      render();
    });
  });

  Array.prototype.forEach.call(clearButtons, function (button) {
    button.addEventListener("click", clearFilters);
  });

  /* One listener on the list handles both card actions. */
  list.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var id = button.getAttribute("data-id");
    var opportunity = opportunities.filter(function (item) {
      return item.id === id;
    })[0];

    if (!opportunity) {
      return;
    }

    if (button.getAttribute("data-action") === "bookmark") {
      toggleBookmark(opportunity, button);
    } else {
      openModal(opportunity, button);
    }
  });

  /* Close the modal with its buttons or the backdrop. */
  modal.addEventListener("click", function (event) {
    if (event.target.closest("[data-modal-close]") || event.target.closest("[data-modal-backdrop]")) {
      closeModal();
    }
  });

  fillLocations();
  render();
})();


/* ==========================================================================
   OpportunityOS — my applications
   --------------------------------------------------------------------------
   This block only runs on applications.html (#applications).

   It reads and writes through the shared application store above, so any
   change made here is what the Dashboard shows. It draws:
     1. The five overview numbers and the live count
     2. One row per application, each with a status dropdown
     3. The two empty states
     4. The add-application dialog, with validation and duplicate prevention

   Search and the status filter live in one `state` object, so changing one
   never resets the other. Every control changes its own property, then calls
   render() again.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Only run on the My Applications page ------------------------------ */
  var page = document.getElementById("applications");
  if (!page) {
    return;
  }

  var store = window.OpportunityOS && window.OpportunityOS.applications;
  var statuses = window.OpportunityOS && window.OpportunityOS.statuses;

  if (!store || !statuses) {
    return;
  }

  /* --- Elements ---------------------------------------------------------- */
  var list = document.getElementById("application-list");
  var emptyState = document.getElementById("applications-empty");
  var noMatchState = document.getElementById("applications-no-match");
  var countLabel = document.getElementById("applications-count");
  var resultCount = document.getElementById("applications-result-count");
  var filtersForm = document.getElementById("application-filters");
  var searchInput = document.getElementById("application-search");
  var statusFilter = document.getElementById("status-filter");
  var clearButtons = document.querySelectorAll(
    "[data-clear-application-filters]"
  );
  var addButtons = document.querySelectorAll("[data-add-application]");

  var modal = document.getElementById("add-application-modal");
  var form = document.getElementById("add-application-form");
  var formError = document.getElementById("application-form-error");
  var titleInput = document.getElementById("application-title");
  var titleError = document.getElementById("application-title-error");
  var companyInput = document.getElementById("application-organisation");
  var companyError = document.getElementById(
    "application-organisation-error"
  );
  var dateInput = document.getElementById("application-date");
  var dateError = document.getElementById("application-date-error");
  var statusInput = document.getElementById("application-status");
  var toast = document.getElementById("application-status-message");

  /* Archive and delete use their own confirmation dialog. */
  var archivedSection = document.getElementById("archived-section");
  var archivedList = document.getElementById("archived-list");
  var archivedCount = document.getElementById("archived-count");
  var confirmModal = document.getElementById("confirm-modal");
  var confirmTitle = document.getElementById("confirm-title");
  var confirmText = document.getElementById("confirm-text");
  var confirmAccept = document.getElementById("confirm-accept");

  /* Keyed by status, plus "total". */
  var overviewNumbers = {
    total: document.getElementById("overview-total"),
    Applied: document.getElementById("overview-applied"),
    Interview: document.getElementById("overview-interview"),
    Offer: document.getElementById("overview-offer"),
    Rejected: document.getElementById("overview-rejected")
  };

  /* Without the list and the dialog there is nothing to build. */
  if (!list || !modal || !form || !emptyState || !noMatchState) {
    return;
  }

  /* --- State ------------------------------------------------------------- */
  var state = {
    search: "",
    status: "all"
  };

  var lastFocusedElement = null;
  var toastTimer = null;

  /* --- Dates -------------------------------------------------------------
     Small local helpers, following the same pattern as the other modules. */
  var dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  function parseIsoDate(isoDate) {
    var parts = isoDate.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function formatDate(isoDate) {
    return dateFormatter.format(parseIsoDate(isoDate));
  }

  /* Today as YYYY-MM-DD in the browser's own time zone, so the date field's
     default matches the user's calendar. */
  function isoToday() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  /* --- Small DOM helpers -------------------------------------------------- */

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  /* --- Announcements ------------------------------------------------------
     A short visible message that a screen reader also reads out politely. */

  function announce(message) {
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      toast.textContent = "";
    }, 3000);
  }

  /* --- Overview numbers and live count ------------------------------------ */

  function renderOverview() {
    var counts = store.countByStatus();

    Object.keys(overviewNumbers).forEach(function (key) {
      if (overviewNumbers[key]) {
        overviewNumbers[key].textContent = counts[key];
      }
    });

    if (countLabel) {
      countLabel.textContent =
        counts.total === 1
          ? "1 application tracked"
          : counts.total + " applications tracked";
    }
  }

  /* --- Filtering ---------------------------------------------------------- */

  function matchesFilters(application) {
    var term = state.search.trim().toLowerCase();

    /* Search covers both the title and the organisation. */
    if (term) {
      var searchable = (
        application.title +
        " " +
        application.company
      ).toLowerCase();

      if (searchable.indexOf(term) === -1) {
        return false;
      }
    }

    if (state.status !== "all" && application.status !== state.status) {
      return false;
    }

    return true;
  }

  /* --- Rows ---------------------------------------------------------------
     One row layout for every screen size: it stacks on phones and becomes
     four columns at 768px (see section 13 of the stylesheet). */

  /* The applied date, shared by the active rows and the archived ones. */
  function buildDate(application) {
    var dateBlock = createElement("p", "application-row__date");
    dateBlock.appendChild(
      createElement("span", "application-row__date-label", "Applied")
    );
    /* A space between the two, so a screen reader says "Applied 12 Nov 2026"
       rather than running the words together. CSS ignores whitespace-only
       children of a flex container, so the spacing stays the layout gap. */
    dateBlock.appendChild(document.createTextNode(" "));

    var time = createElement("time", "", formatDate(application.appliedOn));
    time.setAttribute("datetime", application.appliedOn);
    dateBlock.appendChild(time);

    return dateBlock;
  }

  /* One small button for a row action. The application's title is part of the
     accessible name, so screen-reader users know which record it affects. */
  function buildActionButton(label, application, action, variant) {
    var button = createElement(
      "button",
      "btn application-row__action " + variant,
      label
    );

    button.type = "button";
    button.setAttribute("data-action", action);
    button.setAttribute("data-id", application.id);
    button.setAttribute("aria-label", label + ": " + application.title);

    return button;
  }

  function buildRow(application) {
    var row = createElement("li", "application-row");

    /* Column 1: title and organisation. */
    var main = createElement("div", "application-row__main");
    main.appendChild(
      createElement("p", "application-row__title", application.title)
    );
    main.appendChild(
      createElement("p", "application-row__org", application.company)
    );
    row.appendChild(main);

    /* Column 2: the date, as a real <time> element. */
    row.appendChild(buildDate(application));

    /* Column 3: the current status, always with its text. */
    var statusBlock = createElement("div", "application-row__status");
    statusBlock.appendChild(
      createElement(
        "span",
        "badge " + statuses.badgeClass(application.status),
        application.status
      )
    );
    row.appendChild(statusBlock);

    /* Column 4: a labelled dropdown for changing the status. */
    var control = createElement("div", "application-row__control");
    var selectId = "status-" + application.id;

    var label = createElement(
      "label",
      "application-row__label",
      "Status for " + application.title
    );
    label.setAttribute("for", selectId);
    control.appendChild(label);

    var select = createElement("select", "select application-row__select");
    select.id = selectId;
    select.setAttribute("data-id", application.id);

    statuses.list.forEach(function (status) {
      var option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      option.selected = status === application.status;
      select.appendChild(option);
    });

    control.appendChild(select);
    row.appendChild(control);

    /* Column 5: archive and delete, both confirmed before anything happens. */
    var actions = createElement("div", "application-row__actions");
    actions.appendChild(
      buildActionButton("Archive", application, "archive", "btn--secondary")
    );
    actions.appendChild(
      buildActionButton("Delete", application, "delete", "btn--danger")
    );
    row.appendChild(actions);

    return row;
  }

  /* An archived row keeps its details and offers the two ways back: restore
     it, or delete it for good. */
  function buildArchivedRow(application) {
    var row = createElement("li", "application-row application-row--archived");

    var main = createElement("div", "application-row__main");
    main.appendChild(
      createElement("p", "application-row__title", application.title)
    );
    main.appendChild(
      createElement("p", "application-row__org", application.company)
    );
    row.appendChild(main);

    row.appendChild(buildDate(application));

    var statusBlock = createElement("div", "application-row__status");
    statusBlock.appendChild(
      createElement(
        "span",
        "badge " + statuses.badgeClass(application.status),
        application.status
      )
    );
    row.appendChild(statusBlock);

    var actions = createElement("div", "application-row__actions");
    actions.appendChild(
      buildActionButton("Restore", application, "restore", "btn--secondary")
    );
    actions.appendChild(
      buildActionButton("Delete", application, "delete", "btn--danger")
    );
    row.appendChild(actions);

    return row;
  }

  /* --- Rendering ---------------------------------------------------------- */

  function render() {
    var all = store.list();
    var matches = all.filter(matchesFilters);

    /* Newest first. The ISO dates sort correctly as plain text. */
    matches.sort(function (a, b) {
      if (a.appliedOn === b.appliedOn) {
        return 0;
      }
      return a.appliedOn < b.appliedOn ? 1 : -1;
    });

    renderOverview();

    /* The archived list is independent of the search and status filters, and
       is drawn before the early returns below so it always stays current. */
    renderArchived();

    list.textContent = "";

    /* Empty tracker: the two empty states are never shown together. */
    if (all.length === 0) {
      list.hidden = true;
      emptyState.hidden = false;
      noMatchState.hidden = true;
      if (resultCount) {
        resultCount.textContent = "";
      }
      return;
    }

    emptyState.hidden = true;

    if (matches.length === 0) {
      list.hidden = true;
      noMatchState.hidden = false;
      if (resultCount) {
        resultCount.textContent =
          "No applications match your search and status filter";
      }
      return;
    }

    noMatchState.hidden = true;
    list.hidden = false;

    if (resultCount) {
      resultCount.textContent =
        "Showing " +
        matches.length +
        " of " +
        all.length +
        (all.length === 1 ? " application" : " applications");
    }

    matches.forEach(function (application) {
      list.appendChild(buildRow(application));
    });
  }

  /* --- Archived list ------------------------------------------------------- */

  function renderArchived() {
    if (!archivedSection || !archivedList) {
      return;
    }

    var archived = store.listArchived();
    archivedList.textContent = "";

    /* Nothing archived: keep the whole section out of the page. */
    archivedSection.hidden = archived.length === 0;

    if (archivedCount) {
      archivedCount.textContent =
        archived.length === 1
          ? "1 archived application"
          : archived.length + " archived applications";
    }

    archived.forEach(function (application) {
      archivedList.appendChild(buildArchivedRow(application));
    });
  }

  /* --- Status changes -----------------------------------------------------
     One listener on the list handles every dropdown. */

  list.addEventListener("change", function (event) {
    var select = event.target.closest("select[data-id]");
    if (!select) {
      return;
    }

    var id = select.getAttribute("data-id");
    var nextStatus = select.value;
    var record = store.list().filter(function (item) {
      return item.id === id;
    })[0];

    if (!record || !store.setStatus(id, nextStatus)) {
      render();
      return;
    }

    /* Redraw: the badge, the five numbers and the count all change. */
    render();

    /* render() rebuilt the rows, so put focus back on the same dropdown. */
    var replaced = list.querySelector('select[data-id="' + id + '"]');
    if (replaced) {
      replaced.focus();
    }

    announce(record.title + " moved to " + nextStatus + ".");
  });

  /* --- Archive, delete and restore ----------------------------------------
     Archive keeps the record but hides it from My Applications, the Dashboard
     and Analytics. Delete removes it for good. Neither happens on the first
     click: each opens the confirmation dialog, which is filled in with the
     right wording and button label just before it appears. */

  var pendingAction = null;
  var confirmTrigger = null;

  /* Looks in both lists, so the same click handler serves active rows and
     archived ones. */
  function findAnywhere(id) {
    var all = store.list().concat(store.listArchived());

    for (var index = 0; index < all.length; index += 1) {
      if (all[index].id === id) {
        return all[index];
      }
    }

    return null;
  }

  function openConfirm(type, application, trigger) {
    if (!confirmModal) {
      return;
    }

    var isDelete = type === "delete";

    /* Remember what to do if the user confirms, and where focus came from. */
    pendingAction = {
      type: type,
      id: application.id,
      title: application.title
    };
    confirmTrigger = trigger || document.activeElement;

    if (confirmTitle) {
      confirmTitle.textContent = isDelete
        ? "Delete application?"
        : "Archive application?";
    }

    /* Curly quotes keep the title readable inside the sentence. */
    if (confirmText) {
      confirmText.textContent = isDelete
        ? "\u201C" +
          application.title +
          "\u201D at " +
          application.company +
          " will be removed from this browser permanently. This cannot be undone."
        : "\u201C" +
          application.title +
          "\u201D at " +
          application.company +
          " will be hidden from My Applications, the Dashboard and Analytics. You can restore it from the Archived list at any time.";
    }

    if (confirmAccept) {
      confirmAccept.textContent = isDelete
        ? "Delete permanently"
        : "Archive application";
      confirmAccept.className = isDelete
        ? "btn btn--danger"
        : "btn btn--primary";
    }

    confirmModal.hidden = false;
    document.addEventListener("keydown", handleConfirmKeydown);

    /* Focus starts on the safe choice when a record would be deleted. The
       backdrop is also a [data-confirm-cancel] element but cannot take focus,
       so the visible Cancel button in the footer is picked instead. */
    var cancelButton = confirmModal.querySelector(
      ".modal__footer [data-confirm-cancel]"
    );

    if (!isDelete && confirmAccept) {
      confirmAccept.focus();
    } else if (cancelButton) {
      cancelButton.focus();
    }
  }

  function closeConfirm() {
    if (!confirmModal || confirmModal.hidden) {
      return;
    }

    confirmModal.hidden = true;
    pendingAction = null;
    document.removeEventListener("keydown", handleConfirmKeydown);

    /* The row's buttons are redrawn after a change, so the trigger may be
       gone; only restore focus to it when it is still on the page. */
    if (confirmTrigger && document.contains(confirmTrigger)) {
      confirmTrigger.focus();
    } else if (addButtons.length > 0) {
      addButtons[0].focus();
    }

    confirmTrigger = null;
  }

  function handleConfirmKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeConfirm();
      return;
    }

    /* Keep Tab inside the dialog while it is open. */
    if (event.key !== "Tab") {
      return;
    }

    var focusable = confirmModal.querySelectorAll("button:not([disabled])");

    if (focusable.length === 0) {
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* The Cancel button, the close button and the backdrop all cancel. */
  if (confirmModal) {
    confirmModal.addEventListener("click", function (event) {
      if (event.target.closest("[data-confirm-cancel]")) {
        closeConfirm();
      }
    });
  }

  if (confirmAccept) {
    confirmAccept.addEventListener("click", function () {
      if (!pendingAction) {
        closeConfirm();
        return;
      }

      var action = pendingAction;
      var changed =
        action.type === "delete"
          ? store.remove(action.id)
          : store.archive(action.id);

      closeConfirm();

      /* Both lists, the five overview numbers and the live count redraw from
         the store, so this page can never disagree with the saved data. */
      render();

      announce(
        changed
          ? action.title +
              (action.type === "delete" ? " deleted." : " archived.")
          : "That application could not be changed."
      );
    });
  }

  /* One handler for every row button, in either list. */
  function handleRowAction(event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var id = button.getAttribute("data-id");
    var application = findAnywhere(id);

    if (!application) {
      return;
    }

    var action = button.getAttribute("data-action");

    if (action === "restore") {
      if (store.restore(id)) {
        render();

        /* The row has moved to the main list; put focus on its new control. */
        var restored = list.querySelector('select[data-id="' + id + '"]');
        if (restored) {
          restored.focus();
        }

        announce(application.title + " restored to My Applications.");
      }
      return;
    }

    openConfirm(action, application, button);
  }

  list.addEventListener("click", handleRowAction);

  if (archivedList) {
    archivedList.addEventListener("click", handleRowAction);
  }

  /* --- Add application dialog --------------------------------------------- */

  function setFieldError(input, errorElement, message) {
    if (!input || !errorElement) {
      return;
    }

    if (!message) {
      input.removeAttribute("aria-invalid");
      errorElement.textContent = "";
      errorElement.hidden = true;
      return;
    }

    input.setAttribute("aria-invalid", "true");
    errorElement.textContent = message;
    errorElement.hidden = false;
  }

  function showFormError(message) {
    if (!formError) {
      return;
    }

    formError.textContent = message;
    formError.hidden = !message;
  }

  function clearFormErrors() {
    setFieldError(titleInput, titleError, "");
    setFieldError(companyInput, companyError, "");
    setFieldError(dateInput, dateError, "");
    showFormError("");
  }

  function openModal(trigger) {
    lastFocusedElement = trigger || document.activeElement;

    form.reset();
    clearFormErrors();

    /* A sensible starting point: applied today, at the first status. */
    if (dateInput) {
      dateInput.value = isoToday();
      dateInput.max = isoToday();
    }
    if (statusInput) {
      statusInput.value = "Applied";
    }

    modal.hidden = false;
    document.addEventListener("keydown", handleModalKeydown);

    /* Focus moves into the dialog so keyboard users start inside it. */
    if (titleInput) {
      titleInput.focus();
    }
  }

  function closeModal() {
    if (modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.removeEventListener("keydown", handleModalKeydown);

    /* Focus goes back to whichever button opened the dialog. */
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    } else if (addButtons.length > 0) {
      addButtons[0].focus();
    }

    lastFocusedElement = null;
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    /* Keep Tab inside the dialog while it is open. */
    if (event.key !== "Tab") {
      return;
    }

    var focusable = modal.querySelectorAll(
      "button:not([disabled]), a[href], input, select, textarea"
    );

    if (focusable.length === 0) {
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* Checks every field and reports the first problem inline. Returns true
     only when the form may be saved. */
  function validateForm() {
    var valid = true;

    var title = titleInput ? titleInput.value.trim() : "";
    var company = companyInput ? companyInput.value.trim() : "";
    var appliedOn = dateInput ? dateInput.value : "";

    var titleMessage = title ? "" : "Enter the opportunity title.";
    setFieldError(titleInput, titleError, titleMessage);
    if (titleMessage) {
      valid = false;
    }

    var companyMessage = company ? "" : "Enter the organisation name.";
    setFieldError(companyInput, companyError, companyMessage);
    if (companyMessage) {
      valid = false;
    }

    var dateMessage = "";
    if (!appliedOn) {
      dateMessage = "Choose the date you applied.";
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedOn)) {
      dateMessage = "Enter a valid date.";
    } else if (appliedOn > isoToday()) {
      dateMessage = "The date cannot be in the future.";
    }
    setFieldError(dateInput, dateError, dateMessage);
    if (dateMessage) {
      valid = false;
    }

    if (!valid) {
      showFormError("");
      return false;
    }

    /* The store compares titles and organisations trimmed and
       case-insensitively, so "google " and "Google" are the same employer. */
    var duplicate = store.findDuplicate(title, company);
    if (duplicate) {
      showFormError(
        "You already track " +
          duplicate.title +
          " at " +
          duplicate.company +
          "."
      );
      return false;
    }

    showFormError("");
    return true;
  }

  function focusFirstProblem() {
    var invalid = form.querySelector('[aria-invalid="true"]');

    if (invalid) {
      invalid.focus();
      return;
    }

    if (formError && !formError.hidden) {
      formError.focus();
    }
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!validateForm()) {
      focusFirstProblem();
      return;
    }

    var result = store.add({
      title: titleInput.value,
      company: companyInput.value,
      appliedOn: dateInput.value,
      status: statusInput.value
    });

    if (!result.ok) {
      showFormError(
        result.reason === "duplicate"
          ? "You already track this opportunity at this organisation."
          : "That application could not be saved. Check the details and try again."
      );
      focusFirstProblem();
      return;
    }

    closeModal();
    render();
    announce(
      "Added " +
        result.application.title +
        " at " +
        result.application.company +
        "."
    );
  });

  /* Correcting a field clears its own message, so errors never linger after
     the user has fixed them. */
  [
    [titleInput, titleError],
    [companyInput, companyError],
    [dateInput, dateError]
  ].forEach(function (pair) {
    var input = pair[0];
    var errorElement = pair[1];

    if (!input) {
      return;
    }

    input.addEventListener("input", function () {
      setFieldError(input, errorElement, "");
      showFormError("");
    });
  });

  /* --- Clearing the filters ----------------------------------------------- */

  function clearFilters() {
    var focusWasInNoMatch = noMatchState.contains(document.activeElement);

    state.search = "";
    state.status = "all";

    if (searchInput) {
      searchInput.value = "";
    }
    if (statusFilter) {
      statusFilter.value = "all";
    }

    render();

    /* The empty state's button is about to be hidden, so move focus instead
       of losing it. */
    if (focusWasInNoMatch && searchInput) {
      searchInput.focus();
    }
  }

  /* --- Wiring -------------------------------------------------------------- */

  /* The form has no submit button of its own, but pressing Enter in the
     search box can still submit it; keep the page where it is. */
  if (filtersForm) {
    filtersForm.addEventListener("submit", function (event) {
      event.preventDefault();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      state.search = searchInput.value;
      render();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", function () {
      state.status = statusFilter.value;
      render();
    });
  }

  Array.prototype.forEach.call(clearButtons, function (button) {
    button.addEventListener("click", clearFilters);
  });

  Array.prototype.forEach.call(addButtons, function (button) {
    button.addEventListener("click", function () {
      openModal(button);
    });
  });

  /* Close the dialog with its close button, Cancel, or the backdrop. */
  modal.addEventListener("click", function (event) {
    if (event.target.closest("[data-application-modal-close]")) {
      closeModal();
    }
  });

  render();
})();


/* ==========================================================================
   OpportunityOS — my bookmarks
   --------------------------------------------------------------------------
   This block only runs on bookmarks.html (#bookmarks).

   It shows the opportunities the user saved from Explore, using the same
   shared bookmark store, so nothing here is a second copy of the bookmarks:
   removing one here changes what Explore and the Dashboard show after they
   are reloaded.

   What it draws:
     1. The live saved count and the filter results
     2. One card per bookmark, with Remove, View details and Add to
        applications actions
     3. Two empty states
     4. Its own details dialog (the Explore dialog belongs to that page's
        module and is not shared)

   Filters live in one `state` object, so changing one never resets another.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Only run on the Bookmarks page ------------------------------------ */
  var page = document.getElementById("bookmarks");
  if (!page) {
    return;
  }

  var sampleData = window.OpportunityOS_DATA;
  var bookmarks = window.OpportunityOS && window.OpportunityOS.bookmarks;
  var types = window.OpportunityOS && window.OpportunityOS.types;
  var applications = window.OpportunityOS && window.OpportunityOS.applications;

  if (!sampleData || !bookmarks || !types) {
    return;
  }

  var opportunities = sampleData.opportunities || [];

  /* --- Elements ---------------------------------------------------------- */
  var list = document.getElementById("bookmark-list");
  var emptyState = document.getElementById("bookmarks-empty");
  var emptyHeading = document.getElementById("bookmarks-empty-title");
  var emptyLink = document.getElementById("bookmarks-empty-link");
  var noMatchState = document.getElementById("bookmarks-no-match");
  var noMatchHeading = document.getElementById("bookmarks-no-match-title");
  var savedCount = document.getElementById("bookmarks-count");
  var resultCount = document.getElementById("bookmark-result-count");
  var filtersForm = document.getElementById("bookmark-filters");
  var searchInput = document.getElementById("bookmark-search");
  var locationSelect = document.getElementById("bookmark-location");
  var modeSelect = document.getElementById("bookmark-mode");
  var typeGroup = document.querySelector('[data-bookmark-filter="type"]');
  var clearButtons = document.querySelectorAll(
    "[data-clear-bookmark-filters]"
  );
  var toast = document.getElementById("bookmark-message");

  var modal = document.getElementById("bookmark-modal");
  var modalTitle = document.getElementById("bookmark-modal-title");
  var modalSummary = document.getElementById("bookmark-modal-summary");
  var modalDetails = document.getElementById("bookmark-modal-details");

  /* Without the list and the dialog there is nothing to build. */
  if (!list || !modal || !emptyState || !noMatchState) {
    return;
  }

  /* --- State ------------------------------------------------------------- */
  var state = {
    search: "",
    type: "all",
    location: "all",
    mode: "all"
  };

  var lastFocusedElement = null;
  var toastTimer = null;

  /* --- Dates -------------------------------------------------------------
     Small local helpers, following the same pattern as the other modules. */
  var MS_PER_DAY = 24 * 60 * 60 * 1000;
  var dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  function parseIsoDate(isoDate) {
    var parts = isoDate.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  function daysUntil(isoDate) {
    return Math.round((parseIsoDate(isoDate) - today()) / MS_PER_DAY);
  }

  function formatDate(isoDate) {
    return dateFormatter.format(parseIsoDate(isoDate));
  }

  function countdownLabel(days) {
    if (days < 0) {
      return "Closed";
    }
    if (days === 0) {
      return "today";
    }
    if (days === 1) {
      return "tomorrow";
    }
    return "in " + days + " days";
  }

  /* Today as YYYY-MM-DD, used as the applied-on date when a bookmark is added
     to the applications store. */
  function isoToday() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, "0");
    var day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  /* --- Small DOM helpers -------------------------------------------------- */

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  /* --- Announcements ------------------------------------------------------ */

  function announce(message) {
    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.classList.add("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove("is-visible");
      toast.textContent = "";
    }, 3000);
  }

  /* --- Data --------------------------------------------------------------- */

  /* The saved opportunities, always read from the shared bookmark store. The
     order follows the dataset; render() sorts them for display. */
  function getSaved() {
    return opportunities.filter(function (opportunity) {
      return bookmarks.has(opportunity.id);
    });
  }

  /* Filters are ANDed: every active control has to match. */
  function matchesFilters(opportunity) {
    var term = state.search.trim().toLowerCase();

    if (term) {
      var searchable = (
        opportunity.title +
        " " +
        opportunity.organisation
      ).toLowerCase();

      if (searchable.indexOf(term) === -1) {
        return false;
      }
    }

    if (state.type !== "all" && opportunity.type !== state.type) {
      return false;
    }

    if (state.location !== "all" && opportunity.location !== state.location) {
      return false;
    }

    if (state.mode !== "all" && opportunity.mode !== state.mode) {
      return false;
    }

    return true;
  }

  /* Upcoming deadlines first, soonest at the top; expired opportunities last.
     Sort is stable, so two expired ones keep their dataset order and two on
     the same day keep the order they were saved in. */
  function sortByDeadline(collection) {
    return collection.slice().sort(function (a, b) {
      var aDays = daysUntil(a.deadline);
      var bDays = daysUntil(b.deadline);
      var aExpired = aDays < 0;
      var bExpired = bDays < 0;

      if (aExpired !== bExpired) {
        return aExpired ? 1 : -1;
      }

      if (aExpired && bExpired) {
        return 0;
      }

      return parseIsoDate(a.deadline) - parseIsoDate(b.deadline);
    });
  }

  /* --- Cards -------------------------------------------------------------- */

  function buildCard(opportunity) {
    var card = createElement("li", "card opportunity-card bookmark-card");

    /* Header: title and type badge, from the shared type map. */
    var header = createElement("div", "card__header");
    header.appendChild(createElement("h3", "card__title", opportunity.title));
    header.appendChild(
      createElement(
        "span",
        "badge " + types.badgeClass(opportunity.type),
        opportunity.type
      )
    );
    card.appendChild(header);

    /* Organisation, mode and location. */
    card.appendChild(
      createElement("p", "opportunity-card__org", opportunity.organisation)
    );
    card.appendChild(
      createElement(
        "p",
        "opportunity-card__meta",
        opportunity.mode + " \u00b7 " + opportunity.location
      )
    );

    /* Deadline with a machine-readable <time> element. */
    var days = daysUntil(opportunity.deadline);
    var deadline = createElement("p", "opportunity-card__deadline");
    var time = createElement("time", "", formatDate(opportunity.deadline));
    time.setAttribute("datetime", opportunity.deadline);
    deadline.appendChild(document.createTextNode("Closes "));
    deadline.appendChild(time);
    deadline.appendChild(
      document.createTextNode(" \u00b7 " + countdownLabel(days))
    );
    card.appendChild(deadline);

    card.appendChild(
      createElement("p", "opportunity-card__summary", opportunity.summary)
    );

    /* Footer: Remove bookmark, View details, Add to applications. */
    var footer = createElement("div", "card__footer");

    var removeButton = createElement(
      "button",
      "btn btn--secondary",
      "Remove bookmark"
    );
    removeButton.type = "button";
    removeButton.setAttribute("data-action", "remove");
    removeButton.setAttribute("data-id", opportunity.id);
    removeButton.setAttribute(
      "aria-label",
      "Remove bookmark for " + opportunity.title
    );
    footer.appendChild(removeButton);

    var detailsButton = createElement(
      "button",
      "btn btn--tertiary",
      "View details"
    );
    detailsButton.type = "button";
    detailsButton.setAttribute("data-action", "details");
    detailsButton.setAttribute("data-id", opportunity.id);
    detailsButton.setAttribute(
      "aria-label",
      "View details for " + opportunity.title
    );
    footer.appendChild(detailsButton);

    /* If this opportunity is already tracked, the action is shown disabled
       instead of letting a duplicate application be created. */
    var tracked =
      applications &&
      applications.findDuplicate(opportunity.title, opportunity.organisation);

    var addButton = createElement(
      "button",
      "btn " + (tracked ? "btn--secondary" : "btn--primary"),
      tracked ? "In applications" : "Add to applications"
    );
    addButton.type = "button";
    addButton.setAttribute("data-action", "add-application");
    addButton.setAttribute("data-id", opportunity.id);
    addButton.setAttribute(
      "aria-label",
      tracked
        ? opportunity.title + " is already in your applications"
        : "Add " + opportunity.title + " to your applications"
    );

    if (tracked) {
      addButton.disabled = true;
    }

    footer.appendChild(addButton);

    card.appendChild(footer);
    return card;
  }

  /* --- Rendering ---------------------------------------------------------- */

  function render() {
    var all = getSaved();
    var matches = sortByDeadline(all.filter(matchesFilters));

    if (savedCount) {
      savedCount.textContent =
        bookmarks.count() === 1
          ? "1 opportunity saved"
          : bookmarks.count() + " opportunities saved";
    }

    list.textContent = "";

    /* Nothing saved at all: the empty tracker state. */
    if (all.length === 0) {
      list.hidden = true;
      emptyState.hidden = false;
      noMatchState.hidden = true;
      if (resultCount) {
        resultCount.textContent = "";
      }
      return;
    }

    emptyState.hidden = true;

    /* Saved, but the filters exclude everything. */
    if (matches.length === 0) {
      list.hidden = true;
      noMatchState.hidden = false;
      if (resultCount) {
        resultCount.textContent = "No bookmarks match the current filters";
      }
      return;
    }

    noMatchState.hidden = true;
    list.hidden = false;

    if (resultCount) {
      resultCount.textContent =
        "Showing " +
        matches.length +
        " of " +
        all.length +
        (all.length === 1 ? " saved opportunity" : " saved opportunities");
    }

    matches.forEach(function (opportunity) {
      list.appendChild(buildCard(opportunity));
    });
  }

  /* --- Removing a bookmark ------------------------------------------------
     The shared store only offers toggle(), so has() is checked first: that way
     a double click can never turn into a second toggle and re-add the
     bookmark. */

  function removeBookmark(opportunity, button) {
    if (!bookmarks.has(opportunity.id)) {
      render();
      return;
    }

    /* Remember where the clicked button sat, so focus can go to the same
       position in the redrawn list. */
    var removeButtons = Array.prototype.slice.call(
      list.querySelectorAll('[data-action="remove"]')
    );
    var index = removeButtons.indexOf(button);

    bookmarks.toggle(opportunity.id);
    render();

    announce("Removed " + opportunity.title + " from bookmarks.");

    /* Focus must never stay on the removed button. */
    var remaining = list.querySelectorAll('[data-action="remove"]');

    if (remaining.length > 0) {
      var next = index < 0 ? 0 : Math.min(index, remaining.length - 1);
      remaining[next].focus();
      return;
    }

    /* The last visible card went away: move to the state now on screen. */
    if (!emptyState.hidden && emptyHeading) {
      emptyHeading.focus();
    } else if (!noMatchState.hidden && noMatchHeading) {
      noMatchHeading.focus();
    } else if (emptyLink) {
      emptyLink.focus();
    }
  }

  /* --- Adding to applications ---------------------------------------------
     Reuses the application store and its duplicate rule (title + organisation,
     trimmed and case-insensitive). No opportunityId is stored, and no new
     storage key is created. */

  function markTracked(button, opportunity) {
    button.textContent = "In applications";
    button.className = "btn btn--secondary";
    button.disabled = true;
    button.setAttribute(
      "aria-label",
      opportunity.title + " is already in your applications"
    );
  }

  /* A disabled button cannot keep focus, so move it to the same card's
     View details button instead of dropping it on the page. */
  function focusAfterTracked(button) {
    var footer = button.parentNode;
    var details = footer
      ? footer.querySelector('[data-action="details"]')
      : null;

    if (details) {
      details.focus();
    }
  }

  function addToApplications(opportunity, button) {
    if (!applications) {
      announce("Applications are not available on this page.");
      return;
    }

    /* Already tracked: say so, disable the action, add nothing. */
    if (applications.findDuplicate(opportunity.title, opportunity.organisation)) {
      markTracked(button, opportunity);
      focusAfterTracked(button);
      announce(
        opportunity.title +
          " at " +
          opportunity.organisation +
          " is already in your applications."
      );
      return;
    }

    var result = applications.add({
      title: opportunity.title,
      company: opportunity.organisation,
      appliedOn: isoToday(),
      status: "Applied"
    });

    if (!result.ok) {
      if (result.reason === "duplicate") {
        markTracked(button, opportunity);
        focusAfterTracked(button);
        announce("That application is already in your tracker.");
        return;
      }

      announce(
        opportunity.title + " could not be added. Please try again."
      );
      return;
    }

    /* The bookmark stays saved; only the action changes. */
    markTracked(button, opportunity);
    focusAfterTracked(button);
    announce("Added " + opportunity.title + " to your applications.");
  }

  /* --- Details dialog ----------------------------------------------------- */

  function addDetail(label, value) {
    modalDetails.appendChild(createElement("dt", "", label));
    modalDetails.appendChild(createElement("dd", "", value));
  }

  function openModal(opportunity, trigger) {
    lastFocusedElement = trigger || document.activeElement;

    modalTitle.textContent = opportunity.title;
    modalSummary.textContent = opportunity.summary;
    modalDetails.textContent = "";

    addDetail("Organisation", opportunity.organisation);
    addDetail("Type", opportunity.type);
    addDetail("Work mode", opportunity.mode);
    addDetail("Location", opportunity.location);
    addDetail("Deadline", formatDate(opportunity.deadline));
    addDetail("Time left", countdownLabel(daysUntil(opportunity.deadline)));

    modal.hidden = false;
    document.addEventListener("keydown", handleModalKeydown);

    /* Focus starts inside the dialog. The selector asks for a button, because
       the backdrop shares the close attribute and is not focusable. */
    var closeButton = modal.querySelector("button[data-bookmark-modal-close]");
    if (closeButton) {
      closeButton.focus();
    }
  }

  function closeModal() {
    if (modal.hidden) {
      return;
    }

    modal.hidden = true;
    document.removeEventListener("keydown", handleModalKeydown);

    /* Focus returns to the View details button that opened it. */
    if (lastFocusedElement && document.contains(lastFocusedElement)) {
      lastFocusedElement.focus();
    } else if (searchInput) {
      searchInput.focus();
    }

    lastFocusedElement = null;
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeModal();
      return;
    }

    /* Keep Tab inside the dialog while it is open. */
    if (event.key !== "Tab") {
      return;
    }

    var focusable = modal.querySelectorAll(
      "button:not([disabled]), a[href], input, select, textarea"
    );

    if (focusable.length === 0) {
      return;
    }

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* --- Clearing the filters ----------------------------------------------- */

  function clearFilters() {
    var focusWasInNoMatch = noMatchState.contains(document.activeElement);

    state.search = "";
    state.type = "all";
    state.location = "all";
    state.mode = "all";

    if (searchInput) {
      searchInput.value = "";
    }
    if (locationSelect) {
      locationSelect.value = "all";
    }
    if (modeSelect) {
      modeSelect.value = "all";
    }

    if (typeGroup) {
      Array.prototype.forEach.call(
        typeGroup.querySelectorAll("button[data-value]"),
        function (chip) {
          var isAll = chip.getAttribute("data-value") === "all";
          chip.setAttribute("aria-pressed", isAll ? "true" : "false");
        }
      );
    }

    render();

    /* The no-results state is about to be hidden, so move focus somewhere
       sensible instead of losing it. */
    if (focusWasInNoMatch && searchInput) {
      searchInput.focus();
    }
  }

  /* --- Wiring -------------------------------------------------------------- */

  /* Location options come from the dataset, so they cannot drift out of date. */
  function fillLocations() {
    if (!locationSelect) {
      return;
    }

    var locations = [];

    opportunities.forEach(function (opportunity) {
      if (locations.indexOf(opportunity.location) === -1) {
        locations.push(opportunity.location);
      }
    });

    locations.sort();

    locations.forEach(function (location) {
      var option = document.createElement("option");
      option.value = location;
      option.textContent = location;
      locationSelect.appendChild(option);
    });
  }

  /* The form has no submit button, but Enter in the search field can still
     submit it; keep the page where it is. */
  if (filtersForm) {
    filtersForm.addEventListener("submit", function (event) {
      event.preventDefault();
    });
  }

  if (searchInput) {
    searchInput.addEventListener("input", function () {
      state.search = searchInput.value;
      render();
    });
  }

  if (locationSelect) {
    locationSelect.addEventListener("change", function () {
      state.location = locationSelect.value;
      render();
    });
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", function () {
      state.mode = modeSelect.value;
      render();
    });
  }

  /* Each chip updates only its own part of the state. */
  if (typeGroup) {
    typeGroup.addEventListener("click", function (event) {
      var chip = event.target.closest("button[data-value]");
      if (!chip) {
        return;
      }

      state.type = chip.getAttribute("data-value");

      Array.prototype.forEach.call(
        typeGroup.querySelectorAll("button[data-value]"),
        function (item) {
          item.setAttribute("aria-pressed", item === chip ? "true" : "false");
        }
      );

      render();
    });
  }

  Array.prototype.forEach.call(clearButtons, function (button) {
    button.addEventListener("click", clearFilters);
  });

  /* One listener handles all three card actions, so nothing is bound twice. */
  list.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    var id = button.getAttribute("data-id");
    var opportunity = opportunities.filter(function (item) {
      return item.id === id;
    })[0];

    if (!opportunity) {
      return;
    }

    var action = button.getAttribute("data-action");

    if (action === "remove") {
      removeBookmark(opportunity, button);
    } else if (action === "details") {
      openModal(opportunity, button);
    } else if (action === "add-application") {
      addToApplications(opportunity, button);
    }
  });

  /* Close the dialog with its buttons or the backdrop. */
  modal.addEventListener("click", function (event) {
    if (event.target.closest("[data-bookmark-modal-close]")) {
      closeModal();
    }
  });

  fillLocations();
  render();
})();


/* ==========================================================================
   OpportunityOS — analytics
   --------------------------------------------------------------------------
   This block only runs on analytics.html (#analytics).

   Everything on the page is calculated here from the shared application store
   and the sample opportunity dataset, so the numbers cannot disagree with
   My Applications or the Dashboard.

   Definitions used below (also written on the page):
     interview conversion = (Interview + Offer) / all applications
       An offer means an interview happened, so offers count towards this.
     offer conversion     = Offer / all applications
     awaiting a decision  = Applied + Under review
     most common status   = the status with the highest count; ties go to the
                            first status in the shared order
   With zero applications, rates are shown as "—" instead of 0%, because a
   percentage of nothing would be misleading.
   ========================================================================== */

(function () {
  "use strict";

  /* --- Only run on the Analytics page ------------------------------------ */
  var page = document.getElementById("analytics");
  if (!page) {
    return;
  }

  var sampleData = window.OpportunityOS_DATA;
  var statuses = window.OpportunityOS && window.OpportunityOS.statuses;
  var applications = window.OpportunityOS && window.OpportunityOS.applications;
  var bookmarks = window.OpportunityOS && window.OpportunityOS.bookmarks;

  if (!sampleData || !statuses || !applications) {
    return;
  }

  var opportunities = sampleData.opportunities || [];

  /* --- Settings --------------------------------------------------------- */
  var DEADLINE_WINDOW_DAYS = 30;
  var RECENT_APPLICATION_LIMIT = 5;
  var MS_PER_DAY = 24 * 60 * 60 * 1000;

  /* One bar style per status, using the existing palette tokens. */
  var BAR_CLASSES = {
    Applied: "chart__bar--applied",
    "Under review": "chart__bar--under-review",
    Interview: "chart__bar--interview",
    Offer: "chart__bar--offer",
    Rejected: "chart__bar--rejected"
  };

  /* --- Elements ---------------------------------------------------------- */
  var summary = document.getElementById("analytics-summary");
  var emptyState = document.getElementById("analytics-empty");
  var chartSection = document.getElementById("analytics-chart-section");
  var chart = document.getElementById("status-chart");
  var chartSummary = document.getElementById("chart-summary");
  var insightsSection = document.getElementById("analytics-insights-section");
  var insightInterview = document.getElementById("insight-interview");
  var insightOffer = document.getElementById("insight-offer");
  var insightAwaiting = document.getElementById("insight-awaiting");
  var insightCommon = document.getElementById("insight-common");
  var insightCommonNote = document.getElementById("insight-common-note");
  var recentWrap = document.getElementById("analytics-recent-wrap");
  var recentBody = document.getElementById("analytics-recent-body");
  var deadlineList = document.getElementById("analytics-deadline-list");
  var deadlinesEmpty = document.getElementById("analytics-deadlines-empty");

  /* Keyed by the analytics card's id. */
  var numberElements = {
    total: document.getElementById("analytics-total"),
    Applied: document.getElementById("analytics-applied"),
    "Under review": document.getElementById("analytics-review"),
    Interview: document.getElementById("analytics-interview"),
    Offer: document.getElementById("analytics-offer"),
    Rejected: document.getElementById("analytics-rejected")
  };

  if (!summary || !emptyState || !chart || !chartSection) {
    return;
  }

  /* --- Dates -------------------------------------------------------------
     Every date on this page is defensive: a missing or malformed date shows
     as "—" and is skipped by sorting, instead of breaking the page. */
  var dateFormatter = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  function isIsoDate(value) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  function parseIsoDate(value) {
    var parts = value.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  /* The regex alone would accept 2026-13-45, so the parts are compared with
     the date the browser builds from them: only a real calendar day passes. */
  function isValidDateValue(value) {
    if (!isIsoDate(value)) {
      return false;
    }

    var parts = value.split("-");
    var year = Number(parts[0]);
    var month = Number(parts[1]);
    var day = Number(parts[2]);
    var date = new Date(year, month - 1, day);

    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  function formatDate(value) {
    return isValidDateValue(value) ? dateFormatter.format(parseIsoDate(value)) : "—";
  }

  function today() {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  /* Days until a date, or null when the date cannot be used. */
  function daysUntil(value) {
    if (!isValidDateValue(value)) {
      return null;
    }

    return Math.round((parseIsoDate(value) - today()) / MS_PER_DAY);
  }

  function formatCountdown(days) {
    if (days === 0) {
      return "Today";
    }
    if (days === 1) {
      return "Tomorrow";
    }
    return "In " + days + " days";
  }

  /* --- Small helpers ------------------------------------------------------ */

  function createElement(tagName, className, text) {
    var element = document.createElement(tagName);
    if (className) {
      element.className = className;
    }
    if (text !== undefined) {
      element.textContent = text;
    }
    return element;
  }

  function setText(element, value) {
    if (element) {
      element.textContent = value;
    }
  }

  /* Rounded percentage of the total. Zero applications gives 0, and callers
     show "—" rather than a 0% rate, so nothing divides by zero. */
  function share(count, total) {
    return total > 0 ? Math.round((count / total) * 100) : 0;
  }

  /* --- 1. Overview numbers and live summary ------------------------------- */

  function renderOverview(counts) {
    Object.keys(numberElements).forEach(function (key) {
      setText(numberElements[key], counts[key]);
    });

    var parts = [];

    if (counts.total === 0) {
      parts.push("No applications tracked yet");
    } else {
      parts.push(
        counts.total +
          (counts.total === 1 ? " application tracked" : " applications tracked")
      );
    }

    if (bookmarks) {
      var saved = bookmarks.count();
      parts.push(
        saved + (saved === 1 ? " saved opportunity" : " saved opportunities")
      );
    }

    if (counts.Interview > 0) {
      parts.push(
        counts.Interview +
          (counts.Interview === 1
            ? " application at interview stage"
            : " applications at interview stage")
      );
    }

    if (counts.Offer > 0) {
      parts.push(counts.Offer + (counts.Offer === 1 ? " offer" : " offers"));
    }

    summary.textContent = parts.join(" \u00b7 ");
  }

  /* --- 2. Status breakdown chart ------------------------------------------ */

  function renderChart(counts) {
    chart.textContent = "";

    statuses.list.forEach(function (status) {
      var count = counts[status];
      var percentage = share(count, counts.total);

      var row = createElement("li", "chart__row");

      /* A spoken summary of the row, so the bar is never the only cue. */
      row.setAttribute(
        "aria-label",
        status +
          ": " +
          count +
          (count === 1 ? " application, " : " applications, ") +
          percentage +
          " percent"
      );

      row.appendChild(createElement("span", "chart__label", status));

      var track = createElement("span", "chart__track");
      track.setAttribute("aria-hidden", "true");

      var bar = createElement(
        "span",
        "chart__bar " + (BAR_CLASSES[status] || "chart__bar--applied")
      );
      bar.style.width = percentage + "%";
      track.appendChild(bar);

      row.appendChild(track);
      row.appendChild(createElement("span", "chart__value num", count));
      row.appendChild(createElement("span", "chart__percent num", percentage + "%"));

      chart.appendChild(row);
    });

    if (chartSummary) {
      chartSummary.textContent =
        counts.total === 1
          ? "1 application across " + statuses.list.length + " statuses"
          : counts.total + " applications across " + statuses.list.length + " statuses";
    }
  }

  /* --- 3. Insights -------------------------------------------------------- */

  function mostCommonStatus(counts) {
    var best = null;

    statuses.list.forEach(function (status) {
      if (counts[status] > 0 && (!best || counts[status] > counts[best])) {
        best = status;
      }
    });

    return best;
  }

  function renderInsights(counts) {
    var total = counts.total;

    /* No applications: rates are undefined, so show a dash, never 0%. */
    if (total === 0) {
      setText(insightInterview, "\u2014");
      setText(insightOffer, "\u2014");
      setText(insightAwaiting, "0");
      setText(insightCommon, "\u2014");
      setText(
        insightCommonNote,
        "The status the largest number of your applications share."
      );
      return;
    }

    /* An offer implies an interview happened, so both count as reached. */
    var interviewed = counts.Interview + counts.Offer;
    var common = mostCommonStatus(counts);

    setText(insightInterview, share(interviewed, total) + "%");
    setText(insightOffer, share(counts.Offer, total) + "%");
    setText(insightAwaiting, counts.Applied + counts["Under review"]);
    setText(insightCommon, common || "\u2014");
    setText(
      insightCommonNote,
      common
        ? counts[common] +
            " of " +
            total +
            " applications share this status."
        : "The status the largest number of your applications share."
    );
  }

  /* --- 4. Recent applications --------------------------------------------- */

  function renderRecent(list) {
    if (!recentWrap || !recentBody) {
      return;
    }

    /* Newest first; unusable dates sort to the bottom instead of breaking. */
    var recent = list
      .slice()
      .sort(function (a, b) {
        var aDate = isValidDateValue(a.appliedOn) ? a.appliedOn : "";
        var bDate = isValidDateValue(b.appliedOn) ? b.appliedOn : "";

        if (aDate === bDate) {
          return 0;
        }

        return aDate < bDate ? 1 : -1;
      })
      .slice(0, RECENT_APPLICATION_LIMIT);

    recentBody.textContent = "";

    if (recent.length === 0) {
      recentWrap.hidden = true;
      return;
    }

    recentWrap.hidden = false;

    recent.forEach(function (application) {
      var row = document.createElement("tr");

      row.appendChild(createElement("td", "", application.title));
      row.appendChild(createElement("td", "", application.company));
      row.appendChild(
        createElement("td", "table__num", formatDate(application.appliedOn))
      );

      var statusCell = document.createElement("td");
      statusCell.appendChild(
        createElement(
          "span",
          "badge " + statuses.badgeClass(application.status),
          application.status
        )
      );
      row.appendChild(statusCell);

      recentBody.appendChild(row);
    });
  }

  /* --- 5. Upcoming opportunity deadlines ---------------------------------- */

  function getUpcomingDeadlines() {
    return opportunities
      .filter(function (opportunity) {
        var days = daysUntil(opportunity.deadline);
        return days !== null && days >= 0 && days <= DEADLINE_WINDOW_DAYS;
      })
      .sort(function (a, b) {
        return parseIsoDate(a.deadline) - parseIsoDate(b.deadline);
      });
  }

  function renderDeadlines() {
    if (!deadlineList || !deadlinesEmpty) {
      return;
    }

    var deadlines = getUpcomingDeadlines();

    deadlineList.textContent = "";

    if (deadlines.length === 0) {
      deadlineList.hidden = true;
      deadlinesEmpty.hidden = false;
      return;
    }

    deadlineList.hidden = false;
    deadlinesEmpty.hidden = true;

    deadlines.forEach(function (opportunity) {
      var days = daysUntil(opportunity.deadline);
      var isUrgent = days <= 7;

      var item = createElement(
        "li",
        "deadline" + (isUrgent ? " deadline--urgent" : "")
      );

      var main = createElement("div", "deadline__main");
      main.appendChild(createElement("p", "deadline__title", opportunity.title));
      main.appendChild(
        createElement(
          "p",
          "deadline__meta",
          opportunity.organisation + " \u00b7 " + opportunity.type
        )
      );

      var dateBlock = createElement("div", "deadline__date");
      var time = createElement("time", "", formatDate(opportunity.deadline));
      time.setAttribute("datetime", opportunity.deadline);
      dateBlock.appendChild(time);
      dateBlock.appendChild(
        createElement("span", "deadline__countdown", formatCountdown(days))
      );

      item.appendChild(main);
      item.appendChild(dateBlock);
      deadlineList.appendChild(item);
    });
  }

  /* --- 6. Draw everything -------------------------------------------------- */

  function render() {
    var counts = applications.countByStatus();
    var hasApplications = counts.total > 0;

    renderOverview(counts);
    renderChart(counts);
    renderInsights(counts);
    renderRecent(applications.list());
    renderDeadlines();

    /* With no applications the breakdown and insights would be empty, so the
       helpful empty state takes their place and the deadlines stay visible. */
    emptyState.hidden = hasApplications;
    chartSection.hidden = !hasApplications;
    if (insightsSection) {
      insightsSection.hidden = !hasApplications;
    }
  }

  /* A small hook so the renderer can be re-run after data changes while
     developing, and checked from the browser console. */
  window.OpportunityOS = window.OpportunityOS || {};
  window.OpportunityOS.renderAnalytics = render;

  render();
})();
