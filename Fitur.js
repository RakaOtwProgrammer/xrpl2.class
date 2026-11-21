/* XRPL2 — fitur tambahan. Dimuat SETELAH script.js (memakai fungsi miliknya). */
const FITUR = {
  schedule: "xrpl2_schedule",
  attendance: "xrpl2_attendance",
  mine: "xrpl2_attendance_mine",
};
const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
let schedule = loadData(FITUR.schedule, []);

const toMin = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n) => String(n).padStart(2, "0");
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// ---------- Jam & pelajaran saat ini ----------
function renderClock() {
  const now = new Date();
  $("clockTime").textContent =
    `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  $("clockDate").textContent = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const mins = now.getHours() * 60 + now.getMinutes();
  const today = schedule
    .filter((s) => s.day === HARI[now.getDay()])
    .sort((a, b) => toMin(a.start) - toMin(b.start));
  const current = today.find(
    (s) => mins >= toMin(s.start) && mins < toMin(s.end),
  );
  const next = today.find((s) => toMin(s.start) > mins);
  const box = $("clockLesson");
  box.replaceChildren();

  if (current) {
    box.append(
      `Sedang berlangsung: ${current.name}`,
      createElement("small", "", `${current.start} – ${current.end}`),
    );
  } else if (next) {
    box.append(
      "Tidak ada pelajaran saat ini",
      createElement(
        "small",
        "",
        `Berikutnya: ${next.name} pukul ${next.start}`,
      ),
    );
  } else {
    box.append("Tidak ada pelajaran saat ini");
  }
}

// ---------- Jadwal (admin) ----------
function renderSchedule() {
  const list = $("adminSchedule");
  list?.replaceChildren();
  [...schedule]
    .sort(
      (a, b) =>
        HARI.indexOf(a.day) - HARI.indexOf(b.day) ||
        toMin(a.start) - toMin(b.start),
    )
    .forEach((s) =>
      list?.append(
        adminRow(s.name, `${s.day} · ${s.start} – ${s.end}`, () => {
          schedule = schedule.filter((x) => x.id !== s.id);
          saveData(FITUR.schedule, schedule);
          renderSchedule();
          renderClock();
        }),
      ),
    );
}

$("scheduleForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const start = $("schStart").value,
    end = $("schEnd").value;
  if (toMin(end) <= toMin(start))
    return showToast("Jam selesai harus setelah jam mulai.");
  schedule.push({
    id: Date.now(),
    day: $("schDay").value,
    start,
    end,
    name: $("schName").value.trim(),
  });
  saveData(FITUR.schedule, schedule);
  e.target.reset();
  renderSchedule();
  renderClock();
  showToast("Jadwal ditambahkan.");
});

// ---------- Absensi harian (reset otomatis pukul 00:00) ----------
// Hanya admin/petugas absensi yang dapat mengisi. Murid yang tidak tercantum = hadir.
const STUDENTS = members.filter((m) => m.role !== "Wali Kelas");

// ----- Label status (Izin / Sakit / Alpha) di belakang nama pada bagian Anggota -----
const _renderMembersAsli = renderMembers;
renderMembers = function (search = "") {
  _renderMembersAsli(search);
  const absent = getAttendance().absent;
  document.querySelectorAll("#memberGrid .member-card").forEach((card) => {
    const nameEl = card.querySelector("b");
    if (!nameEl) return;
    const rec = absent.find((a) => a.name === nameEl.textContent);
    if (!rec) return;
    card.classList.add(`absen-${rec.status}`);
    const row = createElement("div", "member-name-row");
    nameEl.replaceWith(row);
    row.append(
      nameEl,
      createElement("span", `member-status status-${rec.status}`, rec.status),
    );
  });
};

function getAttendance() {
  const data = loadData(FITUR.attendance, null);
  if (!data || data.date !== todayKey() || !Array.isArray(data.absent))
    return { date: todayKey(), absent: [] };
  return data;
}

function renderAttendance() {
  const data = getAttendance();
  const list = $("attendList");
  const adminList = $("adminAttendance");
  list?.replaceChildren();
  adminList?.replaceChildren();

  if (list && data.absent.length === 0)
    list.append(
      createElement("div", "empty-state", "Semua murid hadir hari ini."),
    );

  data.absent.forEach((a) => {
    if (list) {
      const row = createElement("div", "attend-item");
      const info = createElement("div");
      info.append(
        createElement("b", "", a.name),
        createElement("p", "", a.note || "Tanpa keterangan"),
      );
      row.append(
        info,
        createElement(
          "span",
          `badge badge-${a.status}`,
          a.status.toUpperCase(),
        ),
      );
      list.append(row);
    }
    adminList?.append(
      adminRow(`${a.name} — ${a.status}`, a.note || "Tanpa keterangan", () => {
        if (!isAdminLoggedIn())
          return showToast("Hanya admin yang dapat mengubah absensi.");
        const cur = getAttendance();
        cur.absent = cur.absent.filter((x) => x.name !== a.name);
        saveData(FITUR.attendance, cur);
        renderAttendance();
      }),
    );
  });

  updatePublicForm();
  renderMembers($("memberSearch")?.value || "");
  if ($("attendSummary"))
    $("attendSummary").textContent =
      `${STUDENTS.length - data.absent.length} HADIR · ${data.absent.length} TIDAK HADIR`;
  if ($("attendDateLabel"))
    $("attendDateLabel").textContent =
      `${new Date().toLocaleDateString("id-ID")} · reset otomatis pukul 00:00`;
}

// ----- Form publik: semua murid, 1 kali per hari per perangkat -----
const myLock = () => {
  const l = loadData(FITUR.mine, null);
  return l && l.date === todayKey() ? l : null;
};

function updatePublicForm() {
  const form = $("pubForm");
  if (!form) return;
  const lock = myLock();
  form
    .querySelectorAll("select,input,button")
    .forEach((el) => (el.disabled = Boolean(lock)));
  $("pubLock").textContent = lock
    ? `✓ Kamu sudah mengisi absensi hari ini (${lock.name}). Bisa diisi lagi besok.`
    : "";
}

if ($("pubName"))
  STUDENTS.forEach((m) => $("pubName").append(new Option(m.name, m.name)));

$("pubForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (myLock()) return showToast("Kamu sudah mengisi absensi hari ini.");
  const cur = getAttendance();
  const name = $("pubName").value;
  const status = $("pubStatus").value;
  if (cur.absent.some((x) => x.name === name))
    return showToast(`${name} sudah tercatat hari ini.`);
  if (!confirm(`Kirim ${name} — ${status}? Tidak bisa diubah lagi hari ini.`))
    return;
  cur.absent.push({ name, status, note: $("pubNote").value.trim() });
  saveData(FITUR.attendance, cur);
  saveData(FITUR.mine, { date: todayKey(), name });
  $("pubNote").value = "";
  renderAttendance();
  showToast("Absensi terkirim.");
});

if ($("attName"))
  STUDENTS.forEach((m) => $("attName").append(new Option(m.name, m.name)));

$("attendForm")?.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!isAdminLoggedIn())
    return showToast("Hanya admin yang dapat mengubah absensi.");
  const cur = getAttendance();
  const name = $("attName").value;
  cur.absent = cur.absent.filter((x) => x.name !== name); // satu murid = satu status
  cur.absent.push({
    name,
    status: $("attStatus").value,
    note: $("attNote").value.trim(),
  });
  saveData(FITUR.attendance, cur);
  $("attNote").value = "";
  renderAttendance();
  showToast("Absensi disimpan.");
});

$("attendReset")?.addEventListener("click", () => {
  if (!isAdminLoggedIn())
    return showToast("Hanya admin yang dapat mereset absensi.");
  if (!confirm("Reset semua absensi hari ini?")) return;
  saveData(FITUR.attendance, { date: todayKey(), absent: [] });
  renderAttendance();
  showToast("Absensi direset.");
});

let lastDay = todayKey();
setInterval(() => {
  renderClock();
  if (todayKey() !== lastDay) {
    lastDay = todayKey();
    renderAttendance();
  }
}, 1000);

renderSchedule();
renderClock();
renderAttendance();

// ---------- Memories: geser per halaman (maks. 8 foto per halaman) ----------
const MEM_PER_PAGE = 8;

function renderMemories() {
  const grid = $("memoriesGrid");
  const adminList = $("adminMemories");
  grid?.replaceChildren();
  adminList?.replaceChildren();
  $("memNav")?.remove();

  if (grid) {
    if (memories.length === 0) {
      grid.classList.remove("mem-slider");
      grid.append(
        createElement(
          "div",
          "empty-state",
          "Belum ada foto. Admin dapat menambahkan foto melalui panel admin.",
        ),
      );
    } else {
      grid.classList.add("mem-slider");
      for (let i = 0; i < memories.length; i += MEM_PER_PAGE) {
        const page = createElement("div", "mem-page");
        memories.slice(i, i + MEM_PER_PAGE).forEach((m) => {
          const card = createElement("figure", "memory-card");
          const img = document.createElement("img");
          img.src = m.image;
          img.alt = m.caption || "Foto Memories XRPL2";
          img.loading = "lazy";
          card.append(img, createElement("figcaption", "", m.caption));
          page.append(card);
        });
        grid.append(page);
      }

      const pages = Math.ceil(memories.length / MEM_PER_PAGE);
      if (pages > 1) {
        const nav = createElement("div", "mem-nav");
        nav.id = "memNav";
        const prev = createElement("button", "mem-arrow", "‹");
        const next = createElement("button", "mem-arrow", "›");
        prev.type = next.type = "button";
        prev.ariaLabel = "Halaman sebelumnya";
        next.ariaLabel = "Halaman berikutnya";
        const dots = createElement("div", "mem-dots");
        const goTo = (n) =>
          grid.scrollTo({ left: n * grid.clientWidth, behavior: "smooth" });
        const current = () => Math.round(grid.scrollLeft / grid.clientWidth);
        for (let p = 0; p < pages; p++) {
          const dot = createElement(
            "button",
            "mem-dot" + (p === 0 ? " active" : ""),
          );
          dot.type = "button";
          dot.ariaLabel = `Halaman ${p + 1}`;
          dot.addEventListener("click", () => goTo(p));
          dots.append(dot);
        }
        prev.addEventListener("click", () => goTo(Math.max(0, current() - 1)));
        next.addEventListener("click", () =>
          goTo(Math.min(pages - 1, current() + 1)),
        );
        grid.onscroll = () => {
          const n = current();
          dots
            .querySelectorAll(".mem-dot")
            .forEach((d, idx) => d.classList.toggle("active", idx === n));
        };
        nav.append(prev, dots, next);
        grid.after(nav);
      }
    }
  }

  memories.forEach((m) => {
    adminList?.append(
      adminRow(m.caption || m.fileName, m.fileName, () => {
        if (!persistMemories(memories.filter((x) => x.id !== m.id))) return;
        renderMemories();
        showToast("Foto berhasil dihapus dari Memories.");
      }),
    );
  });
}

renderMemories();

// ---------- Animasi navbar ----------
const navLinks = [...document.querySelectorAll("#mainNav a")];

navLinks.forEach((link) => {
  link.addEventListener("click", () => {
    link.classList.remove("pressed");
    void link.offsetWidth;
    link.classList.add("pressed");

    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;
    // Setelah halaman selesai bergulir, judul section "muncul" dengan animasi.
    setTimeout(() => {
      target.classList.remove("nav-focus");
      void target.offsetWidth;
      target.classList.add("nav-focus");
      setTimeout(() => target.classList.remove("nav-focus"), 900);
    }, 450);
  });
});

// Menu yang sedang dilihat ikut menyala saat scroll.
if ("IntersectionObserver" in window) {
  const spy = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting)
          navLinks.forEach((l) =>
            l.classList.toggle(
              "active",
              l.getAttribute("href") === "#" + e.target.id,
            ),
          );
      }),
    { rootMargin: "-45% 0px -50% 0px" },
  );
  navLinks.forEach((l) => {
    const s = document.querySelector(l.getAttribute("href"));
    if (s) spy.observe(s);
  });
}

// ---------- Bintang jatuh: slow-motion saat scroll ----------
(() => {
  if (!document.getAnimations) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const SLOW = 0.2; // kecepatan saat scroll (1 = normal, 0.2 = 5x lebih lambat)
  const EASE = 0.1; // makin kecil = perubahan kecepatan makin halus
  const IDLE_MS = 200; // jeda setelah scroll berhenti sebelum kembali normal

  let rate = 1,
    target = 1,
    raf = null,
    idleTimer;

  const starAnimations = () =>
    document
      .getAnimations()
      .filter(
        (a) =>
          a.animationName === "shootingStar" || a.animationName === "rayPulse",
      );

  function tick() {
    rate += (target - rate) * EASE;
    if (Math.abs(target - rate) < 0.01) rate = target;
    starAnimations().forEach((a) => a.updatePlaybackRate(rate));
    raf = rate === target ? null : requestAnimationFrame(tick);
  }

  function setTarget(value) {
    target = value;
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function onScrolling() {
    setTarget(SLOW);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setTarget(1), IDLE_MS);
  }

  ["scroll", "wheel", "touchmove"].forEach((evt) =>
    addEventListener(evt, onScrolling, { passive: true }),
  );
})();
