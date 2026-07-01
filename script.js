const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz8Q7mUCKkJiWV1N_h2PWK94zavgUy5C4TkkWOiAPF-dP_A-fwZw6Gjnh9_MBXZn4bwYA/exec";

const PARTY = {
  dateLabel: "Saturday, July 4, 2026",
  // Example once the date is known: "2026-07-04T20:00:00+02:00"
  startDateIso: "2026-07-04T20:00:00+01:00",
};

const MAP_LINK = "https://goo.gl/maps/HZ3ZkuQPdAaonbyH6";
const COMING_STATUSES = new Set(["I’m coming 🔥", "I'm coming 🔥", "Maybe 👀"]);

const isConfigured = () =>
  APPS_SCRIPT_URL &&
  APPS_SCRIPT_URL !== "[PASTE_GOOGLE_APPS_SCRIPT_WEB_APP_URL_HERE]";

const qs = (selector, parent = document) => parent.querySelector(selector);
const qsa = (selector, parent = document) => [...parent.querySelectorAll(selector)];

function setStatus(formKey, message, type = "") {
  const status = qs(`[data-status-for="${formKey}"]`);
  if (!status) return;
  status.textContent = message;
  status.className = `form-status ${type}`.trim();
}

function getFirstName(name = "") {
  return name.trim().split(/\s+/)[0] || "Guest";
}

function encodeQuery(params) {
  return new URLSearchParams(params).toString();
}

async function sendToSheet(payload) {
  if (!isConfigured()) {
    throw new Error("Google Apps Script URL is not configured yet.");
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || "The Google Sheet could not be updated.");
  }

  return result;
}

async function fetchSheet(params) {
  if (!isConfigured()) {
    throw new Error("Google Apps Script URL is not configured yet.");
  }

  const response = await fetch(`${APPS_SCRIPT_URL}?${encodeQuery(params)}`, {
    method: "GET",
    redirect: "follow",
  });
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.success) {
    throw new Error(result?.error || "Could not load data from Google Sheets.");
  }

  return result;
}

function withButtonState(form, busyText, task) {
  const button = qs("button[type='submit']", form);
  const original = button.textContent;
  button.disabled = true;
  button.textContent = busyText;

  return Promise.resolve(task()).finally(() => {
    button.disabled = false;
    button.textContent = original;
  });
}

function setupParticles() {
  const field = qs("#particleField");
  if (!field) return;

  for (let i = 0; i < 34; i += 1) {
    const particle = document.createElement("span");
    particle.className = "particle";
    particle.style.left = `${Math.random() * 100}%`;
    particle.style.setProperty("--duration", `${7 + Math.random() * 9}s`);
    particle.style.setProperty("--delay", `${Math.random() * -11}s`);
    particle.style.setProperty("--drift", `${-40 + Math.random() * 80}px`);
    particle.style.opacity = `${0.35 + Math.random() * 0.55}`;
    field.appendChild(particle);
  }
}

function setupCountdown() {
  qs("#partyDateLabel").textContent = PARTY.dateLabel;

  const start = Date.parse(PARTY.startDateIso);
  if (!Number.isFinite(start)) return;

  qs("#countdownNote").hidden = true;

  const tick = () => {
    const remaining = Math.max(0, start - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    qs("#days").textContent = String(days).padStart(2, "0");
    qs("#hours").textContent = String(hours).padStart(2, "0");
    qs("#minutes").textContent = String(minutes).padStart(2, "0");
    qs("#seconds").textContent = String(secs).padStart(2, "0");
  };

  tick();
  window.setInterval(tick, 1000);
}

function renderGuestList(guests = []) {
  const root = qs("#guestList");
  const safeGuests = guests.filter((guest) => COMING_STATUSES.has(guest.attendanceStatus));

  if (!safeGuests.length) {
    root.innerHTML = '<article class="guest-pill">Guest list opens after RSVPs.</article>';
    return;
  }

  root.innerHTML = safeGuests
    .map((guest) => {
      const displayName = guest.publicDisplayName || getFirstName(guest.fullName);
      return `<article class="guest-pill">${escapeHtml(displayName)}</article>`;
    })
    .join("");
}

function renderMemoryWall(memories = []) {
  const root = qs("#memoryWall");

  if (!memories.length) {
    root.innerHTML = `
      <article class="feature-card empty-card">
        <span>Approved memories will appear here.</span>
        <p>Private messages stay in Iyed’s Google Sheet until he approves them.</p>
      </article>
    `;
    return;
  }

  root.innerHTML = memories
    .map(
      (memory) => `
        <article class="feature-card">
          <span>${escapeHtml(memory.publicDisplayName || getFirstName(memory.fullName))}</span>
          <p>${escapeHtml(memory.memoryMessage)}</p>
          ${
            memory.funnyRoast
              ? `<p><strong>Roast:</strong> ${escapeHtml(memory.funnyRoast)}</p>`
              : ""
          }
        </article>
      `,
    )
    .join("");
}

async function loadPublicData() {
  if (!isConfigured()) return;

  try {
    const result = await fetchSheet({ action: "public" });
    renderGuestList(result.guestList || []);
    renderMemoryWall(result.memories || []);
  } catch (error) {
    console.warn(error);
  }
}

function setupRsvpForm() {
  const form = qs("#rsvpForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      type: "rsvp",
      fullName: data.get("fullName").trim(),
      attendanceStatus: data.get("attendanceStatus"),
      guestCount: data.get("guestCount"),
      message: data.get("message").trim(),
      publicDisplayName: getFirstName(data.get("fullName")),
    };

    setStatus("rsvp", "Saving...");
    withButtonState(form, "Saving...", async () => {
      try {
        await sendToSheet(payload);
        setStatus(
          "rsvp",
          "Your RSVP is saved. See you at Iyed’s Bac Party.",
          "success",
        );
        form.reset();
        await loadPublicData();
      } catch (error) {
        setStatus("rsvp", error.message, "error");
      }
    });
  });
}

function setupMusicForm() {
  const form = qs("#musicForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const genres = data.getAll("genres");
    const suggestedSongs = data.get("suggestedSongs").trim();

    if (!genres.length && !suggestedSongs) {
      setStatus("music", "Choose at least one genre or suggest a song.", "error");
      return;
    }

    const payload = {
      type: "music",
      fullName: data.get("fullName").trim(),
      genres,
      suggestedSongs,
    };

    setStatus("music", "Saving...");
    withButtonState(form, "Saving...", async () => {
      try {
        await sendToSheet(payload);
        setStatus("music", "Music vote saved. DJ Iyed is watching.", "success");
        form.reset();
      } catch (error) {
        setStatus("music", error.message, "error");
      }
    });
  });
}

function setupMemoryForm() {
  const form = qs("#memoryForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const data = new FormData(form);
    const payload = {
      type: "memory",
      fullName: data.get("fullName").trim(),
      memoryMessage: data.get("memoryMessage").trim(),
      funnyRoast: data.get("funnyRoast").trim(),
    };

    setStatus("memory", "Saving...");
    withButtonState(form, "Saving...", async () => {
      try {
        await sendToSheet(payload);
        setStatus("memory", "Your message has been added to the memory wall.", "success");
        form.reset();
        await loadPublicData();
      } catch (error) {
        setStatus("memory", error.message, "error");
      }
    });
  });
}

function setupAdmin() {
  const params = new URLSearchParams(window.location.search);
  if (window.location.hash === "#admin" || params.get("admin") === "1") {
    document.body.classList.add("admin-mode");
  }

  const form = qs("#adminForm");
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const token = new FormData(form).get("adminToken").trim();
    setStatus("admin", "Loading...");

    withButtonState(form, "Loading...", async () => {
      try {
        const result = await fetchSheet({ action: "admin", token });
        renderAdmin(result);
        setStatus("admin", "Admin data loaded.", "success");
      } catch (error) {
        setStatus("admin", error.message, "error");
      }
    });
  });
}

function renderAdmin(data) {
  const dashboard = qs("#adminDashboard");
  const stats = data.stats || {};
  const genreCounts = data.genreCounts || {};
  const songs = data.suggestedSongs || [];
  const memories = data.memories || [];
  const guests = data.guestList || [];

  dashboard.innerHTML = `
    <div class="metric-grid">
      ${metricCard("Total RSVP", stats.totalRsvp || 0)}
      ${metricCard("Coming", stats.coming || 0)}
      ${metricCard("Maybe", stats.maybe || 0)}
      ${metricCard("Not coming", stats.notComing || 0)}
    </div>

    <section>
      <h3>Music Genre Votes</h3>
      ${renderKeyValueList(genreCounts)}
    </section>

    <section>
      <h3>Suggested Songs</h3>
      ${renderSimpleList(songs, "No songs suggested yet.")}
    </section>

    <section>
      <h3>Memory Wall Messages</h3>
      ${renderSimpleList(
        memories.map(
          (item) =>
            `${item.fullName}: ${item.memoryMessage}${
              item.funnyRoast ? ` | Roast: ${item.funnyRoast}` : ""
            } | Approved: ${item.approved || "No"}`,
        ),
        "No messages yet.",
      )}
    </section>

    <section>
      <h3>Guest List</h3>
      ${renderSimpleList(
        guests.map((guest) => `${guest.publicDisplayName || getFirstName(guest.fullName)} - ${guest.attendanceStatus}`),
        "No public guests yet.",
      )}
    </section>
  `;
}

function metricCard(label, value) {
  return `
    <article class="metric-card">
      <strong>${escapeHtml(String(value))}</strong>
      <span>${escapeHtml(label)}</span>
    </article>
  `;
}

function renderSimpleList(items, emptyText) {
  if (!items.length) return `<p>${escapeHtml(emptyText)}</p>`;
  return `<ul class="admin-list">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderKeyValueList(data) {
  const entries = Object.entries(data);
  if (!entries.length) return "<p>No genre votes yet.</p>";
  return `<ul class="admin-list">${entries
    .map(([key, value]) => `<li>${escapeHtml(key)}: ${escapeHtml(String(value))}</li>`)
    .join("")}</ul>`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.addEventListener("DOMContentLoaded", () => {
  setupParticles();
  setupCountdown();
  setupRsvpForm();
  setupMusicForm();
  setupMemoryForm();
  setupAdmin();
  loadPublicData();

  qsa("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
      if (link.getAttribute("href") === "#admin") {
        document.body.classList.add("admin-mode");
      }
    });
  });
});
