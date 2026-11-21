/* Calendar - synced with ATOM (atom_calendar.py) through calendar.json on the private repo's data branch. */
(function () {
  "use strict";
  const { icon, fillIcons, $, $$, esc, pad, dkey, parseKey, addDays, today, WD, MON, MONTHS, flash, openSheet, closeSheet } = UI;

  const DEMO = new URLSearchParams(location.search).has("demo");
  const sync = new DocSync.Syncer({
    storageKey: DEMO ? "cal-demo" : "cal", file: "calendar.json", collection: "events", device: "phone",
    onChange: render, onStatus: UI.status,
  });
  const REPEATS = [["none", "Never"], ["daily", "Every Day"], ["weekly", "Every Week"], ["monthly", "Every Month"], ["yearly", "Every Year"]];
  let view = localStorage.getItem("cal.view") || "month";
  let persian = false;
  try { persian = localStorage.getItem("cal.persian") === "1"; } catch (_) {}
  let selected = today();
  const firstOf = (d) => {                                     // first day of d's month in the calendar being shown
    if (!persian) return new Date(d.getFullYear(), d.getMonth(), 1);
    const j = Jalali.fromDate(d);
    return Jalali.toDate(j.y, j.m, 1);
  };
  let shown = firstOf(selected);

  // ---- occurrences (mirrors atom_calendar.occurs) -----------------------------------------
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  function occurs(e, d) {
    const start = parseKey(e.day), k = dkey(d);
    if (d < start || (e.skip || []).includes(k)) return false;
    if (e.until && k > e.until) return false;
    switch (e.repeat || "none") {
      case "none": return k === e.day;
      case "daily": return true;
      case "weekly": return Math.round((d - start) / 864e5) % 7 === 0;
      case "monthly": return d.getDate() === Math.min(start.getDate(), daysIn(d.getFullYear(), d.getMonth()));
      case "yearly":
        if (start.getMonth() === 1 && start.getDate() === 29 && !isLeap(d.getFullYear())) return d.getMonth() === 1 && d.getDate() === 28;
        return d.getMonth() === start.getMonth() && d.getDate() === start.getDate();
      default: return false;
    }
  }
  const byStart = (a, b) => (a.start || "").localeCompare(b.start || "") || a.title.toLowerCase().localeCompare(b.title.toLowerCase());
  const on = (d) => sync.items.filter((e) => occurs(e, d)).sort(byStart);

  // ---- formatting -------------------------------------------------------------------------
  const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
  const mins = (t) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  function clock(t) {                                          // 14:05 -> 2:05 PM in the user's locale style
    const [h, m] = t.split(":").map(Number);
    return new Date(2000, 0, 1, h, m).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  function dayName(d) {
    const diff = Math.round((d - today()) / 864e5);
    if (persian) {
      const j = Jalali.fromDate(d);
      const fa = `${Jalali.WEEKDAYS[d.getDay()]} ${Jalali.digits(j.d)} ${Jalali.MONTHS[j.m - 1]}`;
      return diff === 0 ? `امروز · ${fa}` : diff === 1 ? `فردا · ${fa}` : fa;
    }
    const base = `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
    return diff === 0 ? `Today · ${base}` : diff === 1 ? `Tomorrow · ${base}` : base;
  }
  function eventRow(e, d) {
    const isToday = dkey(d) === dkey(today());
    const end = e.end || e.start;
    const past = d < today() || (isToday && e.start && mins(end) < nowMin());
    const now = isToday && e.start && mins(e.start) <= nowMin() && nowMin() <= mins(end);
    const meta = [];
    if (e.location) meta.push(`<span>${icon("pin")}${esc(e.location)}</span>`);
    if (e.repeat && e.repeat !== "none") meta.push(`<span>${icon("repeat")}${esc(REPEATS.find((r) => r[0] === e.repeat)[1])}</span>`);
    return `<button class="event ${now ? "now" : ""} ${past && !now ? "past" : ""}" data-id="${e.id}" data-day="${dkey(d)}">
      ${e.start ? `<span class="when">${clock(e.start)}${e.end ? `<small>${clock(e.end)}</small>` : ""}</span>` : `<span class="when allday">${persian ? "تمام روز" : "all-day"}</span>`}
      <span class="bar"></span>
      <span class="what"><span class="t">${esc(e.title)}</span>${meta.length ? `<span class="meta">${meta.join("")}</span>` : ""}</span>
    </button>`;
  }

  // ---- render -------------------------------------------------------------------------------
  function render() {
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.view === view));
    $("#month-view").hidden = view !== "month";
    $("#agenda-view").hidden = view !== "agenda";
    $("#month-step").hidden = view !== "month";
    applyCalendar();
    if (view === "month") {
      const j = persian ? Jalali.fromDate(shown) : null;
      const name = persian ? Jalali.MONTHS[j.m - 1] : MONTHS[shown.getMonth()];
      const year = persian ? Jalali.digits(j.y) : String(shown.getFullYear());
      $("#title").textContent = name;
      $("#small-title").textContent = `${name} ${year}`;
      $("#year").textContent = year;
      renderMonth();
    } else {
      $("#title").textContent = $("#small-title").textContent = persian ? "برنامه" : "Agenda";
      $("#year").textContent = persian ? "۶۰ روز آینده" : "Next 60 days";
      renderAgenda();
    }
  }

  function applyCalendar() {
    const dir = persian ? "rtl" : "ltr";
    document.documentElement.dataset.cal = persian ? "fa" : "en";
    for (const id of ["#large", "#weekdays", "#month"]) $(id).dir = dir;
    const fa = $("#btn-fa");
    $("#btn-today").textContent = persian ? "امروز" : "Today";
    fa.classList.toggle("on", persian);
    fa.textContent = persian ? "EN" : "فا";
    fa.setAttribute("aria-pressed", String(persian));
    fa.setAttribute("aria-label", persian ? "Gregorian calendar" : "Iranian calendar");
    $("#prev").innerHTML = icon(persian ? "right" : "left");     // arrows point the way the month moves
    $("#next").innerHTML = icon(persian ? "left" : "right");
    $("#weekdays").innerHTML = persian
      ? Jalali.SHORT_DAYS.map((d, i) => `<span class="${i === 6 ? "fri" : ""}">${d}</span>`).join("")
      : ["M", "T", "W", "T", "F", "S", "S"].map((d, i) => `<span class="${i > 4 ? "we" : ""}">${d}</span>`).join("");
    $$(".section-head").forEach((h) => { h.dir = dir; });
  }

  function monthGrid(first) {
    const j = persian ? Jalali.fromDate(first) : null;
    const count = persian ? Jalali.monthDays(j.y, j.m) : daysIn(first.getFullYear(), first.getMonth());
    const lead = persian ? (first.getDay() + 1) % 7 : (first.getDay() + 6) % 7;   // Saturday / Monday first
    const start = addDays(first, -lead);
    const weeks = Math.ceil((lead + count) / 7);
    const tk = dkey(today()), sk = dkey(selected), all = sync.items;
    let html = "";
    for (let i = 0; i < weeks * 7; i++) {
      const d = addDays(start, i), k = dkey(d);
      const n = all.some((e) => occurs(e, d));
      const out = i < lead || i >= lead + count;
      const weekend = persian ? d.getDay() === 5 && "fri" : d.getDay() % 6 === 0 && "we";
      const cls = [out && "out", weekend, k === tk && "today", k === sk && "sel"].filter(Boolean).join(" ");
      const number = persian ? Jalali.digits(Jalali.fromDate(d).d) : d.getDate();
      html += `<button class="${cls}" data-day="${k}" aria-label="${persian ? esc(dayName(d)) : d.toDateString()}${n ? ", has events" : ""}"><span class="n">${number}</span>${n ? `<span class="dot"></span>` : ""}</button>`;
    }
    return html;
  }

  function renderMonth() {
    $("#month").innerHTML = monthGrid(shown);
    const evs = on(selected);
    $("#day-list").innerHTML = `<div class="section"><div class="section-head"><span>${esc(dayName(selected))}</span><span class="count">${evs.length || ""}</span></div>
      <div class="group">${evs.length ? evs.map((e) => eventRow(e, selected)).join("") :
        `<button class="row tint" id="add-here" ${persian ? 'dir="rtl"' : ""}>${persian ? "افزودن رویداد" : "Add Event"}</button>`}</div></div>`;
    $$("#day-list .section-head").forEach((h) => { h.dir = persian ? "rtl" : "ltr"; });
  }

  function renderAgenda() {
    const t = today();
    let html = "", count = 0;
    for (let i = 0; i < 60; i++) {
      const d = addDays(t, i), evs = on(d);
      if (!evs.length) continue;
      count += evs.length;
      html += `<div class="section"><div class="section-head ${i === 0 ? "today" : ""}"><span>${esc(dayName(d))}</span><span class="count">${evs.length}</span></div>
        <div class="group">${evs.map((e) => eventRow(e, d)).join("")}</div></div>`;
    }
    $("#agenda-view").innerHTML = count ? html :
      `<div class="empty"><div class="glyph">${icon("calendar")}</div><h2>No upcoming events</h2><p>The next 60 days are clear.</p></div>`;
    $$("#agenda-view .section-head").forEach((h) => { h.dir = persian ? "rtl" : "ltr"; });
  }

  // ---- month paging: drag 1:1, project the release, spring to the next month ------------------
  function stepMonth(dir) {
    if (persian) {
      const j = Jalali.fromDate(shown), next = Jalali.addMonths(j.y, j.m, dir);
      shown = Jalali.toDate(next.y, next.m, 1);
    } else shown = new Date(shown.getFullYear(), shown.getMonth() + dir, 1);
    render();
  }
  function bindMonthDrag() {
    const grid = $("#month");
    let x0 = 0, y0 = 0, dx = 0, hist = [], mode = null, anim = null;
    const set = (x) => { grid.style.transform = x ? `translateX(${x}px)` : ""; grid.style.opacity = String(1 - Math.min(.5, Math.abs(x) / innerWidth)); };
    grid.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      if (anim) anim.stop();
      x0 = e.clientX; y0 = e.clientY; dx = 0; mode = null; hist = [[e.timeStamp, e.clientX]];
    });
    grid.addEventListener("pointermove", (e) => {
      if (e.pointerType === "mouse" || hist.length === 0) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (!mode) {                                              // 10px of hysteresis before committing to a direction
        if (Math.hypot(mx, my) < 10) return;
        mode = Math.abs(mx) > Math.abs(my) ? "h" : "v";
        if (mode === "h") grid.setPointerCapture(e.pointerId);
      }
      if (mode !== "h") return;
      dx = mx; set(dx);
      hist.push([e.timeStamp, e.clientX]); if (hist.length > 6) hist.shift();
    });
    const end = (e) => {
      if (mode !== "h") { hist = []; return; }
      const [t0, xs] = hist[0], dt = (e.timeStamp - t0) / 1000;
      const v = dt > 0 ? (e.clientX - xs) / dt : 0;
      const landing = dx + UI.project(v);
      const w = grid.clientWidth;
      hist = []; mode = null;
      if (Math.abs(landing) > w / 3) {
        const dir = landing < 0 ? 1 : -1;
        anim = UI.spring({ from: dx, to: -dir * w, velocity: v, response: .3, onUpdate: set, onDone: () => {
          stepMonth(persian ? -dir : dir);                      // right-to-left: swiping right goes forward
          anim = UI.spring({ from: dir * w * .35, to: 0, response: .35, onUpdate: set });
        } });
      } else anim = UI.spring({ from: dx, to: 0, velocity: v, response: .3, onUpdate: set });
    };
    grid.addEventListener("pointerup", end);
    grid.addEventListener("pointercancel", end);
  }

  // ---- event sheet ---------------------------------------------------------------------------
  function editor(id, occurrenceDay) {
    const existing = id ? sync.get(id) : null;
    const e = existing ? { ...existing, skip: [...(existing.skip || [])] } :
      { id: DocSync.uid("e"), title: "", day: dkey(selected), start: "", end: "", location: "", notes: "", repeat: "none",
        until: "", skip: [], createdAt: Date.now() };
    if (!existing) { const h = Math.min(22, new Date().getHours() + 1); e.start = `${pad(h)}:00`; e.end = `${pad(h + 1)}:00`; }
    let allDay = !e.start;
    const repeating = existing && existing.repeat && existing.repeat !== "none";
    openSheet(`
      <div class="s-head"><span class="left"><button class="nav-btn" data-close>Cancel</button></span><h2>${existing ? "Edit Event" : "New Event"}</h2>
        <span class="right"><button class="nav-btn done" id="e-save">${existing ? "Done" : "Add"}</button></span></div>
      <div class="s-body">
        <div class="section"><div class="group">
          <div class="row"><input class="inline" id="e-title" value="${esc(e.title)}" maxlength="200" placeholder="Title" autofocus></div>
          <div class="row"><input class="inline" id="e-loc" value="${esc(e.location || "")}" maxlength="200" placeholder="Location"></div>
        </div></div>
        <div class="section"><div class="group">
          <div class="row tap" id="e-allday"><span class="grow">All-day</span><span class="switch ${allDay ? "on" : ""}"></span></div>
          <div class="row when-row"><span class="grow" id="e-day-label">${allDay ? "Date" : "Starts"}</span><span class="inputs"><input class="inline" type="date" id="e-day" value="${esc(e.day)}" aria-label="Date">
            <input class="inline" type="time" id="e-start" value="${esc(e.start)}" aria-label="Start time" ${allDay ? "hidden" : ""}></span>
            ${persian ? `<span class="fa-date" id="e-fa" dir="rtl"></span>` : ""}</div>
          <label class="row" id="e-end-row" ${allDay ? "hidden" : ""}><span class="grow">Ends</span><input class="inline" type="time" id="e-end" value="${esc(e.end)}"></label>
        </div></div>
        <div class="section"><div class="group">
          <label class="row repeat-row"><span class="grow">Repeat</span>
            <select class="inline" id="e-repeat">${REPEATS.map(([v, n]) => `<option value="${v}" ${(e.repeat || "none") === v ? "selected" : ""}>${n}</option>`).join("")}</select>
            <span class="chev">${icon("right")}</span></label>
          <label class="row" id="e-until-row" ${(e.repeat || "none") === "none" ? "hidden" : ""}><span class="grow">End Repeat</span>
            <input class="inline" type="date" id="e-until" value="${esc(e.until || "")}"></label>
        </div></div>
        <div class="section"><div class="group"><div class="row"><textarea class="inline" id="e-notes" maxlength="2000" placeholder="Notes">${esc(e.notes || "")}</textarea></div></div></div>
        <div class="err-text" id="e-err"></div>
        ${existing ? `<div class="section"><div class="group del-choice" id="e-delc">
          <button class="row destructive" id="e-del">Delete Event</button>
          ${repeating ? `<button class="row destructive" id="e-del-one" hidden>Delete This Event Only</button>
          <button class="row destructive" id="e-del-all" hidden>Delete All Future Events</button>` : ""}
        </div></div>` : ""}
      </div>`, (el) => {
      $("[data-close]", el).onclick = () => closeSheet();
      const faDate = $("#e-fa", el);
      if (faDate) {                                                // the date picker is the phone's own: show it in Farsi too
        const show = () => {
          const v = $("#e-day", el).value;
          if (!v) { faDate.textContent = ""; return; }
          const d = parseKey(v), j = Jalali.fromDate(d);
          faDate.textContent = `${Jalali.WEEKDAYS[d.getDay()]} ${Jalali.digits(j.d)} ${Jalali.MONTHS[j.m - 1]} ${Jalali.digits(j.y)}`;
        };
        $("#e-day", el).addEventListener("input", show);
        show();
      }
      $("#e-allday", el).onclick = () => {
        allDay = !allDay;
        $("#e-allday .switch", el).classList.toggle("on", allDay);
        $("#e-start", el).hidden = allDay; $("#e-end-row", el).hidden = allDay;
        $("#e-day-label", el).textContent = allDay ? "Date" : "Starts";
      };
      $("#e-repeat", el).onchange = (ev) => { e.repeat = ev.target.value; $("#e-until-row", el).hidden = e.repeat === "none"; };
      $("#e-start", el).addEventListener("change", () => {          // keep an hour-long default when the start moves
        const s = $("#e-start", el).value, en = $("#e-end", el);
        if (s && (!en.value || en.value <= s)) en.value = `${pad(Math.min(23, +s.slice(0, 2) + 1))}:${s.slice(3)}`;
      });
      const del = $("#e-del", el);
      if (del) del.onclick = () => {
        if (repeating) { del.hidden = true; $("#e-del-one", el).hidden = false; $("#e-del-all", el).hidden = false; return; }
        if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = "Tap Again to Delete"; return; }
        sync.remove(e.id, `Delete ${e.title.slice(0, 40)}`); closeSheet(); render(); flash("Deleted");
      };
      const one = $("#e-del-one", el);
      if (one) one.onclick = () => {
        const x = { ...sync.get(e.id) }; x.skip = [...(x.skip || []), occurrenceDay || x.day];
        sync.put(x, `Skip ${x.title.slice(0, 30)} ${occurrenceDay}`); closeSheet(); render(); flash("Deleted");
      };
      const all = $("#e-del-all", el);
      if (all) all.onclick = () => { sync.remove(e.id, `Delete ${e.title.slice(0, 40)}`); closeSheet(); render(); flash("Deleted"); };
      $("#e-save", el).onclick = () => {
        const err = $("#e-err", el);
        e.title = $("#e-title", el).value.trim();
        e.day = $("#e-day", el).value;
        e.start = allDay ? "" : $("#e-start", el).value;
        e.end = allDay ? "" : $("#e-end", el).value;
        e.location = $("#e-loc", el).value.trim();
        e.until = e.repeat === "none" ? "" : $("#e-until", el).value;
        e.notes = $("#e-notes", el).value.trim();
        if (!e.title) { err.textContent = "Add a title for the event."; $("#e-title", el).focus(); return; }
        if (!e.day) { err.textContent = "Pick a date."; return; }
        if (!allDay && !e.start) { err.textContent = "Pick a start time, or turn on All-day."; return; }
        if (e.end && e.end <= e.start) e.end = "";
        if (e.until && e.until < e.day) { err.textContent = "End Repeat must be after the event's date."; return; }
        sync.put(e, `${existing ? "Edit" : "Add"} ${e.title.slice(0, 40)}`);
        selected = parseKey(e.day); shown = firstOf(selected);
        closeSheet(); render(); flash(existing ? "Saved" : "Added");
      };
    });
  }

  // ---- wiring --------------------------------------------------------------------------------
  function bind() {
    fillIcons();
    $("#btn-settings").innerHTML = icon("gear");
    $("#btn-add").innerHTML = icon("plus");
    UI.bindStatus($("#status"));
    UI.bindNav($("#nav"), $("#large"));
    bindMonthDrag();
    $("#prev").onclick = () => stepMonth(-1);
    $("#next").onclick = () => stepMonth(1);
    $("#btn-today").onclick = () => { selected = today(); shown = firstOf(selected); view = "month"; render(); };
    $("#btn-fa").onclick = () => {
      persian = !persian;
      try { localStorage.setItem("cal.persian", persian ? "1" : "0"); } catch (_) {}
      shown = firstOf(selected);
      render();
    };
    $("#month").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-day]"); if (!b) return;
      selected = parseKey(b.dataset.day);
      const month = firstOf(selected);
      if (dkey(month) !== dkey(shown)) shown = month;
      render();
    });
    $("#page").addEventListener("click", (ev) => {
      if (ev.target.closest("#add-here")) return editor(null);
      const r = ev.target.closest(".event"); if (r) editor(r.dataset.id, r.dataset.day);
    });
    $("#btn-add").onclick = () => editor(null);
    $("#tabs").onclick = (ev) => {
      const b = ev.target.closest("[data-view]"); if (!b) return;
      view = b.dataset.view; localStorage.setItem("cal.view", view); render(); window.scrollTo({ top: 0 });
    };
    $("#btn-settings").onclick = () => UI.settingsSheet(sync, {
      repoHint: "TaymazNaghashi/ATOMcalender", appName: "Calendar",
      extra: `<div class="section"><div class="section-head">Data</div><div class="group">
        <button class="row tint" id="s-export">Export Backup</button></div></div>`,
      mountExtra: (el) => { $("#s-export", el).onclick = () => UI.exportJSON(sync.doc, "calendar"); },
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { sync.sync(); render(); } });
    setInterval(() => { if (!document.hidden) sync.sync(); }, 60000);
  }

  function demo() {
    if (sync.items.length) return;
    const t = today(), k = (n) => dkey(addDays(t, n)), now = Date.now();
    const ev = (id, title, day, start, end, extra = {}) => sync.doc.events[id] = Object.assign({ id, title, day, start, end,
      location: "", notes: "", repeat: "none", until: "", skip: [], createdAt: now, updatedAt: now }, extra);
    ev("d1", "Design review", k(0), "10:00", "11:00", { location: "Studio 2" });
    ev("d2", "Gym", k(-14), "18:30", "19:30", { repeat: "weekly" });
    ev("d3", "Lunch with Sam", k(0), "13:00", "14:00", { location: "Noodle bar" });
    ev("d4", "Dentist", k(3), "09:15", "", {});
    ev("d5", "Rent due", k(-20), "", "", { repeat: "monthly" });
    ev("d6", "Flight to Berlin", k(9), "07:40", "09:55", { location: "Gate B12" });
    ev("d7", "Mum's birthday", k(5), "", "", { repeat: "yearly" });
  }

  bind();
  if (DEMO) demo();
  render();
  UI.registerSW();
  if (!DEMO) { if (sync.connected) sync.sync(); else UI.status({ state: "local", text: "On this device only" }); }
  window.__cal = { occurs, firstOf };
})();
