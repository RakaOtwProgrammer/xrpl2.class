/* XRPL2 — Fitur 2:
   sinkron online · rekap absensi · hitung mundur tugas · info hari ini (piket,
   deadline, ulang tahun) · kas kelas · PWA.
   Dimuat SETELAH script.js, Fitur.js, dan firebase-config.js. */
(() => {
  const K = {
    kas: "xrpl2_kas",
    bday: "xrpl2_birthdays",
    attHistory: "xrpl2_att_history",
    ts: "xrpl2_sync_ts",
    dirty: "xrpl2_sync_dirty",
    seeded: "xrpl2_sync_seeded",
    students: "xrpl2_students",
    session: "xrpl2_student_session",
    lock: "xrpl2_student_lock",
  };
  const DB = (typeof XRPL2_DB_URL === "string" ? XRPL2_DB_URL : "")
    .trim()
    .replace(/\/+$/, "");
  const SYNC_ON = DB.startsWith("https://");

  let kas = loadData(K.kas, []);
  let birthdays = loadData(K.bday, []);
  let attHistory = loadData(K.attHistory, {});
  let students = loadData(K.students, {}); // akun siswa: nama → {name,salt,hash,count,best,last}
  // Bingkai ikon berdasarkan streak saat ini (urut dari kecil ke besar).
  const TIERS = [
    { id: "iron", min: 10, name: "Besi" },
    { id: "gold", min: 30, name: "Emas" },
    { id: "emerald", min: 100, name: "Emerald" },
    { id: "diamond", min: 200, name: "Diamond" },
    { id: "void", min: 356, name: "Obsidian" },
  ];
  let lastTierSig = "";

  const rupiah = (n) => "Rp " + new Intl.NumberFormat("id-ID").format(n);
  const ymd = (d = new Date()) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfToday = () => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  };
  const daysUntil = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return Math.round((new Date(y, m - 1, d) - startOfToday()) / 86400000);
  };
  const relLabel = (n) =>
    n < 0
      ? `Lewat ${-n} hari`
      : n === 0
        ? "Hari ini!"
        : n === 1
          ? "Besok"
          : `${n} hari lagi`;
  const html = (tag, className, markup) => {
    const el = createElement(tag, className);
    el.innerHTML = markup; // hanya untuk template statis (tanpa data pengguna)
    return el;
  };
  const adminOnly = () => {
    if (isAdminLoggedIn()) return true;
    showToast("Hanya admin yang dapat mengubah ini.");
    return false;
  };

  // =====================================================================
  // 1. SINKRON ONLINE (Firebase Realtime Database lewat REST)
  // =====================================================================
  // Setiap kunci data disimpan sebagai teks JSON di  data/<kunci>,
  // dengan penanda waktu di  meta/<kunci>.  Absensi disimpan per murid
  // di  att/<tanggal>/<nama>  supaya dua murid yang mengirim bersamaan
  // tidak saling menimpa.
  const SYNC_KEYS = {
    [STORAGE.announcements]: (v) => {
      announcements = v;
      renderAnnouncements();
    },
    [STORAGE.materials]: (v) => {
      materials = v;
      renderMaterials();
    },
    [STORAGE.tasks]: (v) => {
      tasks = v;
      renderTasks();
    },
    [STORAGE.piket]: (v) => {
      piket = v;
      renderPiket();
      fillPiketInput();
      renderInfo();
    },
    [STORAGE.memories]: (v) => {
      memories = v;
      renderMemories();
    },
    [FITUR.schedule]: (v) => {
      schedule = v;
      renderSchedule();
      renderClock();
    },
    [K.kas]: (v) => {
      kas = v;
      renderKas();
    },
    [K.bday]: (v) => {
      birthdays = v;
      renderBirthdays();
      renderInfo();
      renderMembers($("memberSearch")?.value || "");
    },
  };

  const getTs = () => loadData(K.ts, {});
  const setTsKey = (key, ts) => {
    const t = getTs();
    t[key] = ts;
    localStorage.setItem(K.ts, JSON.stringify(t));
  };
  const getDirty = () => new Set(loadData(K.dirty, []));
  const setDirty = (set) =>
    localStorage.setItem(K.dirty, JSON.stringify([...set]));
  const markDirty = (token) => {
    const s = getDirty();
    s.add(token);
    setDirty(s);
  };
  const clearDirty = (token) => {
    const s = getDirty();
    s.delete(token);
    setDirty(s);
  };

  async function db(method, path, body) {
    const res = await fetch(`${DB}/${path}.json`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  let syncState = SYNC_ON ? "connecting" : "local";
  function setSync(state, extra = "") {
    syncState = state;
    const text = {
      local: "● Mode lokal — data hanya di browser ini",
      connecting: "● Menghubungkan ke server…",
      online: "● Tersinkron online",
      offline: "● Offline — perubahan dikirim saat tersambung",
    }[state];
    const line = $("syncLine");
    if (line) {
      line.textContent = text;
      line.dataset.state = state;
    }
    const adm = $("syncStatus");
    if (adm) adm.textContent = text + (extra ? ` (${extra})` : "");
  }

  async function pushKey(key) {
    const ts = Date.now();
    await db("PUT", `data/${key}`, JSON.stringify(loadData(key, null)));
    await db("PUT", `meta/${key}`, ts);
    setTsKey(key, ts);
    clearDirty(key);
  }

  const pushTimers = {};
  function queuePush(key) {
    if (!SYNC_ON) return;
    markDirty(key);
    clearTimeout(pushTimers[key]);
    pushTimers[key] = setTimeout(async () => {
      try {
        await pushKey(key);
        setSync("online");
      } catch {
        setSync("offline");
      }
    }, 400);
  }

  // ----- Absensi: kirim hanya selisihnya -----
  let attSnap = { date: todayKey(), map: {} };
  const encName = (n) => n.replace(/[.$#[\]/]/g, "_");
  const toMap = (list) =>
    Object.fromEntries(
      list.map((a) => [
        encName(a.name),
        { name: a.name, status: a.status, note: a.note || "" },
      ]),
    );

  async function pushAttendance(date, list) {
    const next = toMap(list);
    const prev = attSnap.date === date ? attSnap.map : {};
    const patch = {};
    Object.keys(next).forEach((k) => {
      if (JSON.stringify(next[k]) !== JSON.stringify(prev[k]))
        patch[k] = next[k];
    });
    Object.keys(prev).forEach((k) => {
      if (!(k in next)) patch[k] = null;
    });
    if (Object.keys(patch).length) await db("PATCH", `att/${date}`, patch);
    attSnap = { date, map: next };
  }

  function onAttendanceSaved(value) {
    if (!value || !value.date || !Array.isArray(value.absent)) return;
    if (value.absent.length) attHistory[value.date] = value.absent;
    else delete attHistory[value.date];
    localStorage.setItem(K.attHistory, JSON.stringify(attHistory));
    renderRekap();
    if (!SYNC_ON) return;
    const token = "att:" + value.date;
    markDirty(token);
    pushAttendance(value.date, value.absent)
      .then(() => {
        clearDirty(token);
        setSync("online");
      })
      .catch(() => setSync("offline"));
  }

  // ----- Tarik data dari server -----
  let pulling = false;
  async function pullAll(force = false) {
    if (!SYNC_ON || pulling) return;
    pulling = true;
    try {
      const meta = (await db("GET", "meta")) || {};
      const att = (await db("GET", "att")) || {};
      const stuRemote = (await db("GET", "stu")) || {};
      const dirty = getDirty();
      const ts = getTs();

      // Server masih kosong: unggah data lokal sebagai data awal.
      const serverEmpty =
        Object.keys(meta).length === 0 &&
        Object.keys(att).length === 0 &&
        Object.keys(stuRemote).length === 0;
      if (serverEmpty && !localStorage.getItem(K.seeded)) {
        await pushEverything();
        localStorage.setItem(K.seeded, "1");
        setSync("online", "data awal diunggah");
        return;
      }

      for (const key of Object.keys(SYNC_KEYS)) {
        const remoteTs = meta[key];
        if (!remoteTs || dirty.has(key)) continue;
        if (!force && (ts[key] || 0) >= remoteTs) continue;
        const raw = await db("GET", `data/${key}`);
        if (typeof raw !== "string") continue;
        let value;
        try {
          value = JSON.parse(raw);
        } catch {
          continue;
        }
        if (value === null || typeof value !== "object") continue;
        try {
          localStorage.setItem(key, raw);
        } catch {
          showToast(
            "Penyimpanan browser penuh; sebagian data tidak diperbarui.",
          );
          continue;
        }
        setTsKey(key, remoteTs);
        SYNC_KEYS[key](value);
      }

      // Absensi & rekap
      const seeded = Boolean(localStorage.getItem(K.seeded));
      const merged = {};
      Object.keys(att).forEach((date) => {
        merged[date] = Object.values(att[date] || {}).filter(
          (a) => a && a.name && a.status,
        );
      });
      Object.keys(attHistory).forEach((date) => {
        const token = "att:" + date;
        if (dirty.has(token)) merged[date] = attHistory[date];
        else if (!(date in merged) && !seeded) {
          merged[date] = attHistory[date]; // riwayat lama sebelum sinkron aktif
          pushAttendance(date, attHistory[date]).catch(() => {});
        }
      });
      attHistory = merged;
      localStorage.setItem(K.attHistory, JSON.stringify(attHistory));
      localStorage.setItem(K.seeded, "1");

      const today = todayKey();
      if (!dirty.has("att:" + today)) {
        const remoteToday = merged[today] || [];
        attSnap = { date: today, map: toMap(remoteToday) };
        const local = getAttendance();
        if (
          JSON.stringify(toMap(local.absent)) !== JSON.stringify(attSnap.map)
        ) {
          localStorage.setItem(
            FITUR.attendance,
            JSON.stringify({ date: today, absent: remoteToday }),
          );
          renderAttendance();
        }
      }
      mergeStudents(stuRemote, dirty, seeded);
      renderRekap();
      setSync("online");
      checkInNow();
    } catch {
      setSync("offline");
    } finally {
      pulling = false;
    }
  }

  async function pushEverything() {
    for (const key of Object.keys(SYNC_KEYS)) {
      if (localStorage.getItem(key) !== null) await pushKey(key);
    }
    for (const date of Object.keys(attHistory)) {
      attSnap = { date: "", map: {} };
      await pushAttendance(date, attHistory[date]);
    }
    for (const n of Object.values(students))
      await pushStudentEnc(encName(n.name));
    attSnap = { date: todayKey(), map: toMap(getAttendance().absent) };
  }

  // ----- Pembungkus fungsi milik script.js / Fitur.js -----
  const _saveData = saveData;
  saveData = function (key, value) {
    _saveData(key, value);
    if (key === FITUR.attendance) onAttendanceSaved(value);
    else if (SYNC_KEYS[key]) queuePush(key);
  };
  const _persistMemories = persistMemories;
  persistMemories = function (next) {
    const ok = _persistMemories(next);
    if (ok) queuePush(STORAGE.memories);
    return ok;
  };

  // =====================================================================
  // 2. REKAP ABSENSI
  // =====================================================================
  // Seed: catat absensi hari ini yang sudah ada sebelum rekap aktif.
  (() => {
    const cur = getAttendance();
    if (cur.absent.length && !attHistory[cur.date]) {
      attHistory[cur.date] = cur.absent;
      localStorage.setItem(K.attHistory, JSON.stringify(attHistory));
    }
    attSnap = { date: cur.date, map: toMap(cur.absent) };
  })();

  const rekapPanel = html(
    "div",
    "panel rekap-panel",
    `<div class="table-top"><h3>Rekap Absensi</h3><span class="tiny-label" id="rekapInfo"></span></div>
     <div class="rekap-tools">
       <input type="month" id="rekapMonth" aria-label="Pilih bulan" />
       <button class="btn btn-outline btn-small" id="rekapCsv" type="button">Unduh CSV</button>
     </div>
     <div class="table-wrap"><table>
       <thead><tr><th>Nama</th><th>Izin</th><th>Sakit</th><th>Alpha</th><th>Total</th></tr></thead>
       <tbody id="rekapBody"></tbody>
     </table></div>
     <p class="muted small">Hanya murid yang tidak hadir yang tercatat; hari tanpa catatan dianggap hadir semua.
     Rekap mulai terisi sejak fitur ini aktif.</p>`,
  );
  document.querySelector("#absensi .panel")?.after(rekapPanel);
  $("rekapMonth").value = ymd().slice(0, 7);

  function monthRecords() {
    const month = $("rekapMonth").value || ymd().slice(0, 7);
    const dates = Object.keys(attHistory)
      .filter((d) => d.startsWith(month))
      .sort();
    return { month, dates };
  }

  function renderRekap() {
    const body = $("rekapBody");
    if (!body) return;
    body.replaceChildren();
    const { dates } = monthRecords();
    const stats = {};
    dates.forEach((d) =>
      attHistory[d].forEach((a) => {
        stats[a.name] ||= { Izin: 0, Sakit: 0, Alpha: 0 };
        if (a.status in stats[a.name]) stats[a.name][a.status]++;
      }),
    );
    const rows = Object.entries(stats)
      .map(([name, s]) => ({ name, ...s, total: s.Izin + s.Sakit + s.Alpha }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    $("rekapInfo").textContent = `${dates.length} HARI TERCATAT`;
    if (!rows.length) {
      const tr = document.createElement("tr");
      const td = createElement(
        "td",
        "",
        "Tidak ada murid yang absen pada bulan ini.",
      );
      td.colSpan = 5;
      tr.append(td);
      body.append(tr);
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.append(
        createElement("td", "", r.name),
        createElement("td", "rekap-izin", String(r.Izin)),
        createElement("td", "rekap-sakit", String(r.Sakit)),
        createElement("td", "rekap-alpha", String(r.Alpha)),
        createElement("td", "", String(r.total)),
      );
      body.append(tr);
    });
  }

  const csvCell = (v) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // cegah rumus Excel
    return `"${s.replace(/"/g, '""')}"`;
  };

  $("rekapMonth").addEventListener("change", renderRekap);
  $("rekapCsv").addEventListener("click", () => {
    const { month, dates } = monthRecords();
    const lines = [
      ["Tanggal", "Nama", "Status", "Keterangan"].map(csvCell).join(","),
    ];
    dates.forEach((d) =>
      attHistory[d].forEach((a) =>
        lines.push([d, a.name, a.status, a.note || ""].map(csvCell).join(",")),
      ),
    );
    if (lines.length === 1)
      return showToast("Belum ada data absensi bulan ini.");
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `absensi-xrpl2-${month}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  // =====================================================================
  // 3. HITUNG MUNDUR TUGAS
  // =====================================================================
  function decorateTasks() {
    const cards = document.querySelectorAll("#taskList .task-item");
    tasks.forEach((t, i) => {
      const el = cards[i]?.querySelector(".task-deadline");
      if (!el || !/^\d{4}-\d{2}-\d{2}$/.test(t.deadline || "")) return;
      const n = daysUntil(t.deadline);
      el.textContent = `Deadline: ${t.deadline} · ${relLabel(n)}`;
      el.dataset.urgency =
        n < 0 ? "late" : n <= 1 ? "hot" : n <= 3 ? "soon" : "ok";
    });
  }
  const _renderTasks = renderTasks;
  renderTasks = function () {
    _renderTasks();
    decorateTasks();
    renderInfo();
  };

  // =====================================================================
  // 4. INFO HARI INI: piket · deadline · ulang tahun
  // =====================================================================
  const infoCard = html(
    "div",
    "info-card",
    `<div class="info-row"><span class="info-ico">🧹</span><div><small>PIKET HARI INI</small><b id="infoPiket">…</b></div></div>
     <div class="info-row"><span class="info-ico">📝</span><div><small>DEADLINE TERDEKAT</small><b id="infoTask">…</b></div></div>
     <div class="info-row"><span class="info-ico">🔥</span><div><small>STREAK LOGIN</small><b id="infoStreak">…</b></div></div>
     <div class="info-row" id="infoBdayRow" hidden><span class="info-ico">🎂</span><div><small>ULANG TAHUN</small><b id="infoBday"></b></div></div>
     <div class="sync-line" id="syncLine"></div>`,
  );
  document.querySelector(".clock-card")?.after(infoCard);

  const nextBirthday = (md) => {
    const [m, d] = md.split("-").map(Number);
    const now = startOfToday();
    let t = new Date(now.getFullYear(), m - 1, d);
    if (t < now) t = new Date(now.getFullYear() + 1, m - 1, d);
    return Math.round((t - now) / 86400000);
  };

  function renderInfo() {
    if (!$("infoPiket")) return;
    const day = HARI[new Date().getDay()];
    $("infoPiket").textContent =
      day === "Sabtu" || day === "Minggu"
        ? `Libur akhir pekan (${day})`
        : `${day}: ${(piket[day] || []).join(", ") || "Belum diatur"}`;

    const upcoming = tasks
      .filter(
        (t) =>
          /^\d{4}-\d{2}-\d{2}$/.test(t.deadline || "") &&
          daysUntil(t.deadline) >= 0,
      )
      .sort((a, b) => daysUntil(a.deadline) - daysUntil(b.deadline))[0];
    $("infoTask").textContent = upcoming
      ? `${upcoming.title} (${upcoming.subject}) · ${relLabel(daysUntil(upcoming.deadline))}`
      : "Tidak ada deadline mendatang";

    const row = $("infoBdayRow");
    const list = birthdays
      .map((b) => ({ ...b, n: nextBirthday(b.md) }))
      .sort((a, b) => a.n - b.n);
    const todayNames = list.filter((b) => b.n === 0).map((b) => b.name);
    const next = list.find((b) => b.n > 0 && b.n <= 30);
    row.hidden = !todayNames.length && !next;
    $("infoBday").textContent = todayNames.length
      ? `Hari ini: ${todayNames.join(", ")} 🎉`
      : next
        ? `${next.name} · ${relLabel(next.n)}`
        : "";
    if ($("infoStreak")) $("infoStreak").textContent = streakInfoText();
    setSync(syncState);
  }

  // Tandai hari ini di tabel piket.
  const _renderPiket = renderPiket;
  renderPiket = function () {
    _renderPiket();
    const day = HARI[new Date().getDay()];
    document.querySelectorAll("#piketTable tr").forEach((tr) => {
      tr.classList.toggle(
        "piket-today",
        tr.firstElementChild?.textContent === day,
      );
    });
    renderInfo();
  };

  // =====================================================================
  // 5. ULANG TAHUN (hanya tanggal & bulan yang disimpan)
  // =====================================================================
  const todayBirthdayNames = () =>
    new Set(
      birthdays.filter((b) => nextBirthday(b.md) === 0).map((b) => b.name),
    );

  const _renderMembers = renderMembers;
  renderMembers = function (search = "") {
    _renderMembers(search);
    decorateTiers();
    const names = todayBirthdayNames();
    if (!names.size) return;
    document
      .querySelectorAll("#memberGrid .member-card, #teacherRow .member-card")
      .forEach((card) => {
        const nameEl = card.querySelector("b");
        if (nameEl && names.has(nameEl.textContent)) {
          card.classList.add("birthday");
          card.append(createElement("span", "bday-badge", "🎂"));
        }
      });
  };

  // =====================================================================
  // 6. KAS KELAS
  // =====================================================================
  const kasSection = html(
    "section",
    "section",
    `<div class="section-heading"><div><span class="eyebrow">CLASS FUND</span><h2>Kas <span>Kelas</span></h2></div>
       <p>Pemasukan dan pengeluaran kas XRPL2, terbuka untuk semua anggota.</p></div>
     <div class="panel">
       <div class="kas-summary">
         <div><small>SALDO</small><strong id="kasSaldo">Rp 0</strong></div>
         <div class="kas-in"><small>TOTAL MASUK</small><strong id="kasIn">Rp 0</strong></div>
         <div class="kas-out"><small>TOTAL KELUAR</small><strong id="kasOut">Rp 0</strong></div>
       </div>
       <div class="table-top"><h3>Riwayat Transaksi</h3><span class="tiny-label" id="kasCount"></span></div>
       <div class="kas-list" id="kasList"></div>
       <button class="btn btn-outline btn-small" id="kasMore" type="button" hidden></button>
     </div>`,
  );
  kasSection.id = "kas";
  document.querySelector("main footer")?.before(kasSection);
  const navKas = createElement("a", "", "Kas");
  navKas.href = "#kas";
  $("mainNav")?.append(navKas);

  // Sorot menu "Kas" saat bagian Kas sedang dilihat.
  if ("IntersectionObserver" in window) {
    const kasSpy = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            navKas.classList.toggle("active", e.target.id === "kas");
            if (e.target.id === "kas")
              document
                .querySelectorAll("#mainNav a.active")
                .forEach((l) => l !== navKas && l.classList.remove("active"));
          }
        }),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    document
      .querySelectorAll("main section[id]")
      .forEach((s) => kasSpy.observe(s));
  }

  let kasShowAll = false;
  const KAS_LIMIT = 15;

  function renderKas() {
    const list = $("kasList");
    if (!list) return;
    list.replaceChildren();
    const sorted = [...kas].sort(
      (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
    );
    const masuk = kas
      .filter((k) => k.type === "masuk")
      .reduce((s, k) => s + k.amount, 0);
    const keluar = kas
      .filter((k) => k.type === "keluar")
      .reduce((s, k) => s + k.amount, 0);
    $("kasIn").textContent = rupiah(masuk);
    $("kasOut").textContent = rupiah(keluar);
    $("kasSaldo").textContent = rupiah(masuk - keluar);
    $("kasSaldo").dataset.negative = masuk - keluar < 0;
    $("kasCount").textContent = `${kas.length} TRANSAKSI`;

    if (!sorted.length) {
      list.append(
        createElement("div", "empty-state", "Belum ada transaksi kas."),
      );
    }
    (kasShowAll ? sorted : sorted.slice(0, KAS_LIMIT)).forEach((k) => {
      const row = createElement("div", `kas-item kas-${k.type}`);
      const info = createElement("div");
      info.append(
        createElement("b", "", k.note),
        createElement("p", "", k.date),
      );
      row.append(
        info,
        createElement(
          "span",
          "kas-amount",
          (k.type === "masuk" ? "+ " : "− ") + rupiah(k.amount),
        ),
      );
      list.append(row);
    });
    const more = $("kasMore");
    more.hidden = sorted.length <= KAS_LIMIT;
    more.textContent = kasShowAll
      ? "Tampilkan lebih sedikit"
      : `Tampilkan semua (${sorted.length})`;

    // daftar di panel admin
    const adminList = $("adminKas");
    if (adminList) {
      adminList.replaceChildren();
      sorted.forEach((k) =>
        adminList.append(
          adminRow(
            `${k.type === "masuk" ? "+" : "−"} ${rupiah(k.amount)}`,
            `${k.date} · ${k.note}`,
            () => {
              if (!adminOnly()) return;
              kas = kas.filter((x) => x.id !== k.id);
              saveData(K.kas, kas);
              renderKas();
              showToast("Transaksi dihapus.");
            },
          ),
        ),
      );
    }
  }
  $("kasMore").addEventListener("click", () => {
    kasShowAll = !kasShowAll;
    renderKas();
  });

  // =====================================================================
  // Tab admin baru: Kas · Ulang Tahun · Sinkron
  // =====================================================================
  function addAdminTab(id, label, content) {
    const btn = createElement("button", "admin-tab", label);
    btn.type = "button";
    btn.dataset.tab = id;
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".admin-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".admin-content")
        .forEach((c) => c.classList.add("hidden"));
      btn.classList.add("active");
      content.classList.remove("hidden");
    });
    document.querySelector(".admin-tabs")?.append(btn);
    content.id = id;
    content.classList.add("admin-content", "hidden");
    document.querySelector(".admin-bottom")?.before(content);
  }

  // --- Kas ---
  const kasTab = html(
    "div",
    "",
    `<h3>Kas Kelas</h3>
     <form id="kasForm">
       <label>Jenis<select id="kasType"><option value="masuk">Pemasukan</option><option value="keluar">Pengeluaran</option></select></label>
       <label>Jumlah (Rp)<input id="kasAmount" type="number" min="1" max="100000000" step="1" required /></label>
       <label>Keterangan<input id="kasNote" maxlength="80" required placeholder="Contoh: kas minggu ke-3 / beli spidol" /></label>
       <label>Tanggal<input id="kasDate" type="date" required /></label>
       <button class="btn btn-primary" type="submit">Simpan Transaksi</button>
     </form>
     <div id="adminKas"></div>`,
  );
  addAdminTab("kasTab", "Kas", kasTab);
  $("kasDate").value = ymd();
  $("kasForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!adminOnly()) return;
    const amount = Math.round(Number($("kasAmount").value));
    const note = $("kasNote").value.trim();
    const date = $("kasDate").value;
    if (!(amount > 0) || !note || !date)
      return showToast("Lengkapi data transaksi.");
    kas.push({ id: Date.now(), date, type: $("kasType").value, amount, note });
    saveData(K.kas, kas);
    $("kasAmount").value = "";
    $("kasNote").value = "";
    renderKas();
    showToast("Transaksi kas disimpan.");
  });

  // --- Ulang tahun ---
  const bdayTab = html(
    "div",
    "",
    `<h3>Ulang Tahun</h3>
     <p class="muted small">Hanya tanggal dan bulan yang disimpan (tahun lahir tidak disimpan).</p>
     <form id="bdayForm">
       <label>Nama<select id="bdayName"></select></label>
       <label>Tanggal lahir<input id="bdayDate" type="date" required /></label>
       <button class="btn btn-primary" type="submit">Simpan</button>
     </form>
     <div id="adminBday"></div>`,
  );
  addAdminTab("bdayTab", "Ulang Tahun", bdayTab);
  members.forEach((m) => $("bdayName").append(new Option(m.name, m.name)));

  function renderBirthdays() {
    const box = $("adminBday");
    if (!box) return;
    box.replaceChildren();
    [...birthdays]
      .sort((a, b) => nextBirthday(a.md) - nextBirthday(b.md))
      .forEach((b) => {
        const [m, d] = b.md.split("-").map(Number);
        const label = new Date(2000, m - 1, d).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
        });
        box.append(
          adminRow(b.name, label, () => {
            if (!adminOnly()) return;
            birthdays = birthdays.filter((x) => x.name !== b.name);
            saveData(K.bday, birthdays);
            renderBirthdays();
            renderInfo();
            renderMembers($("memberSearch")?.value || "");
          }),
        );
      });
  }
  $("bdayForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!adminOnly()) return;
    const value = $("bdayDate").value; // YYYY-MM-DD → simpan MM-DD saja
    if (!value) return showToast("Pilih tanggal lahir.");
    const name = $("bdayName").value;
    birthdays = birthdays.filter((b) => b.name !== name);
    birthdays.push({ id: Date.now(), name, md: value.slice(5) });
    saveData(K.bday, birthdays);
    $("bdayDate").value = "";
    renderBirthdays();
    renderInfo();
    renderMembers($("memberSearch")?.value || "");
    showToast("Ulang tahun disimpan.");
  });

  // --- Sinkron ---
  const syncTab = html(
    "div",
    "",
    `<h3>Sinkron Online</h3>
     <p id="syncStatus" class="muted"></p>
     <p class="muted small" id="syncHelp"></p>
     <div class="sync-actions">
       <button class="btn btn-primary btn-small" id="syncPush" type="button">Unggah semua data di perangkat ini</button>
       <button class="btn btn-outline btn-small" id="syncPull" type="button">Ambil ulang dari server</button>
     </div>`,
  );
  addAdminTab("syncTab", "Sinkron", syncTab);
  $("syncHelp").textContent = SYNC_ON
    ? "Unggah = timpa data server dengan data di perangkat ini. Ambil ulang = timpa data perangkat ini dengan data server."
    : "Sinkron belum aktif. Isi XRPL2_DB_URL di firebase-config.js (lihat README).";
  $("syncPush").addEventListener("click", async () => {
    if (!adminOnly()) return;
    if (!SYNC_ON)
      return showToast("Sinkron belum diatur di firebase-config.js.");
    if (!confirm("Timpa data di server dengan data di perangkat ini?")) return;
    try {
      await pushEverything();
      setSync("online", "terunggah");
      showToast("Data berhasil diunggah.");
    } catch {
      setSync("offline");
      showToast("Gagal mengunggah. Cek koneksi dan aturan database.");
    }
  });
  $("syncPull").addEventListener("click", async () => {
    if (!adminOnly()) return;
    if (!SYNC_ON)
      return showToast("Sinkron belum diatur di firebase-config.js.");
    if (!confirm("Timpa data di perangkat ini dengan data dari server?"))
      return;
    setDirty(new Set());
    await pullAll(true);
    showToast(
      syncState === "online"
        ? "Data diperbarui dari server."
        : "Gagal mengambil data.",
    );
  });

  const adminNote = document.querySelector(".admin-bottom .tiny");
  if (adminNote && SYNC_ON)
    adminNote.textContent = "Perubahan disinkronkan ke server.";

  // =====================================================================
  // 7. PWA
  // =====================================================================
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  const installBtn = createElement("button", "btn btn-outline", "Pasang");
  installBtn.id = "installBtn";
  installBtn.type = "button";
  installBtn.hidden = true;
  document.querySelector(".top-actions")?.prepend(installBtn);
  let installEvent = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener("click", async () => {
    if (!installEvent) return;
    installEvent.prompt();
    await installEvent.userChoice.catch(() => {});
    installEvent = null;
    installBtn.hidden = true;
  });
  window.addEventListener("appinstalled", () => (installBtn.hidden = true));

  // =====================================================================
  // 8. LOGIN SISWA (nama + PIN) + STREAK LOGIN
  // =====================================================================
  // Catatan keamanan: ini identitas ringan untuk kelas, bukan pengaman kuat.
  // PIN disimpan sebagai hash (SHA-256 + salt), tetapi karena datanya terbaca
  // oleh semua orang yang tahu URL database, PIN pendek tetap bisa ditebak.
  // Streak dihitung dari jam perangkat, jadi bisa dipalsukan oleh yang mau curang.
  const SKIP_WEEKEND = true; // Sabtu & Minggu tidak memutus streak
  const PIN_RE = /^\d{4,6}$/;
  const HASH_ROUNDS = 4000;
  const MAX_FAILS = 5; // salah PIN sebanyak ini → kunci sementara
  const LOCK_MS = 30000;

  // ----- SHA-256 murni JS (jalan di http/https/file, tanpa crypto.subtle) -----
  const SHA_K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
    0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
    0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
    0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
    0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
    0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);
  function sha256Bytes(bytes) {
    const len = bytes.length;
    const total = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor((len * 8) / 4294967296));
    dv.setUint32(total - 4, (len * 8) >>> 0);
    let h0 = 0x6a09e667,
      h1 = 0xbb67ae85,
      h2 = 0x3c6ef372,
      h3 = 0xa54ff53a;
    let h4 = 0x510e527f,
      h5 = 0x9b05688c,
      h6 = 0x1f83d9ab,
      h7 = 0x5be0cd19;
    const w = new Uint32Array(64);
    for (let o = 0; o < total; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15],
          b = w[i - 2];
        const s0 =
          ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 =
          ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      let a = h0,
        b = h1,
        c = h2,
        d = h3,
        e = h4,
        f = h5,
        g = h6,
        h = h7;
      for (let i = 0; i < 64; i++) {
        const S1 =
          ((e >>> 6) | (e << 26)) ^
          ((e >>> 11) | (e << 21)) ^
          ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + SHA_K[i] + w[i]) | 0;
        const S0 =
          ((a >>> 2) | (a << 30)) ^
          ((a >>> 13) | (a << 19)) ^
          ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      h0 = (h0 + a) | 0;
      h1 = (h1 + b) | 0;
      h2 = (h2 + c) | 0;
      h3 = (h3 + d) | 0;
      h4 = (h4 + e) | 0;
      h5 = (h5 + f) | 0;
      h6 = (h6 + g) | 0;
      h7 = (h7 + h) | 0;
    }
    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    [h0, h1, h2, h3, h4, h5, h6, h7].forEach((v, i) => odv.setUint32(i * 4, v));
    return out;
  }
  const toHex = (bytes) =>
    Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const utf8 = new TextEncoder();
  function hashPin(pin, salt, name) {
    const saltBytes = utf8.encode(salt);
    let d = sha256Bytes(utf8.encode(`${salt}:${name}:${pin}`));
    for (let i = 0; i < HASH_ROUNDS; i++) {
      const x = new Uint8Array(32 + saltBytes.length);
      x.set(d);
      x.set(saltBytes, 32);
      d = sha256Bytes(x);
    }
    return toHex(d);
  }
  const randomSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

  // ----- Bingkai tier streak -----
  const tierOf = (streak) =>
    [...TIERS].reverse().find((t) => streak >= t.min) || null;
  const nextTier = (streak) => TIERS.find((t) => streak < t.min) || null;

  function ringWrap(child, tier, extra = "") {
    const wrap = createElement(
      "span",
      `avatar-ring tier-${tier.id}${extra ? " " + extra : ""}`,
    );
    wrap.title = `Bingkai ${tier.name} (streak ${tier.min}+ hari)`;
    child.classList.add("ring-child");
    wrap.append(createElement("span", "ring-bg"), child);
    if (tier.id === "diamond" || tier.id === "void")
      ["a", "b", "c"].forEach((s) =>
        wrap.append(createElement("span", `ring-spark s-${s}`, "✦")),
      );
    return wrap;
  }

  // Pasang bingkai di ikon kartu anggota (hanya siswa yang punya akun & streak ≥ 10).
  function decorateTiers() {
    document.querySelectorAll("#memberGrid .member-card").forEach((card) => {
      const nameEl = card.querySelector("b");
      const rec = nameEl && students[nameEl.textContent];
      const tier = tierOf(currentStreak(rec));
      const avatar = card.querySelector(".avatar");
      if (!tier || !avatar || avatar.closest(".avatar-ring")) return;
      const marker = document.createComment("");
      avatar.before(marker);
      marker.replaceWith(ringWrap(avatar, tier));
    });
  }
  const tierSignature = () =>
    Object.values(students)
      .map((n) => `${n.name}:${(tierOf(currentStreak(n)) || {}).id || "-"}`)
      .sort()
      .join("|");

  // Deretan contoh bingkai: dipakai di profil siswa & pratinjau admin.
  function tierLegend(cur, initial = "A", showAll = false) {
    const box = createElement("div", "tier-legend");
    TIERS.forEach((t) => {
      const item = createElement(
        "div",
        "tier-item" + (showAll || cur >= t.min ? "" : " locked"),
      );
      item.append(
        ringWrap(createElement("div", "avatar mini", initial), t, "mini"),
        createElement("b", "", t.name),
        createElement("small", "", `${t.min} hari`),
      );
      box.append(item);
    });
    return box;
  }

  // ----- Hitungan streak -----
  const parseYmd = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const dayDiff = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 86400000);
  function continuesStreak(last, today) {
    const diff = dayDiff(last, today);
    if (diff === 1) return true;
    if (diff < 1 || !SKIP_WEEKEND) return false;
    for (let i = 1; i < diff; i++) {
      const d = parseYmd(last);
      d.setDate(d.getDate() + i);
      if (d.getDay() !== 0 && d.getDay() !== 6) return false;
    }
    return true;
  }
  function applyCheckIn(node, today) {
    if (node.last === today) return false;
    if (node.last && dayDiff(node.last, today) < 0) return false; // jam mundur: abaikan
    node.count =
      node.last && continuesStreak(node.last, today)
        ? (node.count || 0) + 1
        : 1;
    node.best = Math.max(node.best || 0, node.count);
    node.last = today;
    return true;
  }
  function currentStreak(node) {
    if (!node || !node.last || !node.count) return 0;
    const today = todayKey();
    return dayDiff(node.last, today) <= 0 || continuesStreak(node.last, today)
      ? node.count
      : 0;
  }

  // ----- Penyimpanan akun & sesi -----
  function getSession() {
    return loadData(K.session, null);
  }
  function setSession(name) {
    localStorage.setItem(K.session, JSON.stringify({ name }));
  }
  function clearSession() {
    localStorage.removeItem(K.session);
  }
  function persistStudents() {
    localStorage.setItem(K.students, JSON.stringify(students));
  }
  async function pushStudentEnc(enc) {
    const node = Object.values(students).find((n) => encName(n.name) === enc);
    await db("PUT", `stu/${encodeURIComponent(enc)}`, node || null);
  }
  function syncStudent(name) {
    if (!SYNC_ON) return;
    const enc = encName(name);
    const token = "stu:" + enc;
    markDirty(token);
    pushStudentEnc(enc)
      .then(() => {
        clearDirty(token);
        setSync("online");
      })
      .catch(() => setSync("offline"));
  }
  function saveStudent(node) {
    students[node.name] = node;
    persistStudents();
    syncStudent(node.name);
  }
  function deleteStudent(name) {
    delete students[name];
    persistStudents();
    syncStudent(name);
  }
  async function refreshStudent(name) {
    if (!SYNC_ON) return;
    const enc = encName(name);
    if (getDirty().has("stu:" + enc)) return; // perubahan lokal belum terkirim
    const remote = await db("GET", `stu/${encodeURIComponent(enc)}`);
    if (remote && remote.name) students[remote.name] = remote;
    else delete students[name];
    persistStudents();
  }
  // Dipanggil setelah menarik data dari server.
  function mergeStudents(remoteMap, dirty, seeded) {
    const merged = {};
    Object.values(remoteMap || {}).forEach((n) => {
      if (n && n.name) merged[n.name] = n;
    });
    Object.values(students).forEach((local) => {
      const enc = encName(local.name);
      if (dirty.has("stu:" + enc) || (!seeded && !(local.name in merged))) {
        merged[local.name] = local;
        if (!dirty.has("stu:" + enc)) syncStudent(local.name);
      }
    });
    dirty.forEach((t) => {
      if (!t.startsWith("stu:")) return;
      const enc = t.slice(4);
      const hasLocal = Object.values(students).some(
        (n) => encName(n.name) === enc,
      );
      if (!hasLocal)
        Object.keys(merged).forEach((k) => {
          if (encName(k) === enc) delete merged[k]; // penghapusan yang belum terkirim
        });
    });
    students = merged;
    persistStudents();
  }

  function checkInNow() {
    const s = getSession();
    if (!s) return renderStudentUI();
    const node = students[s.name];
    if (!node || !node.hash) {
      clearSession(); // akun dihapus / PIN direset dari perangkat lain
      return renderStudentUI();
    }
    if (applyCheckIn(node, todayKey())) {
      saveStudent(node);
      showToast(`🔥 Streak ${node.count} hari berturut-turut!`);
    }
    renderStudentUI();
  }

  function streakInfoText() {
    const s = getSession();
    const node = s && students[s.name];
    if (!node) return "Login siswa untuk mulai streak";
    const cur = currentStreak(node);
    return cur > 0
      ? `🔥 ${cur} hari berturut-turut · terbaik ${node.best || cur}`
      : `Belum ada streak · terbaik ${node.best || 0}`;
  }

  function leaderboard() {
    return Object.values(students)
      .map((n) => ({ name: n.name, cur: currentStreak(n), best: n.best || 0 }))
      .filter((n) => n.cur > 0)
      .sort(
        (a, b) =>
          b.cur - a.cur || b.best - a.best || a.name.localeCompare(b.name),
      )
      .slice(0, 5);
  }

  // ----- Modal login siswa -----
  const stuModal = html(
    "div",
    "modal-backdrop",
    `<div class="modal"><button class="modal-close" type="button" aria-label="Tutup">×</button><div id="stuBody"></div></div>`,
  );
  stuModal.id = "studentModal";
  document.body.append(stuModal);
  stuModal
    .querySelector(".modal-close")
    .addEventListener("click", () => closeModal("studentModal"));
  stuModal.addEventListener("click", (e) => {
    if (e.target === stuModal) closeModal("studentModal");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal("studentModal");
  });

  let stuView = "login";
  const setErr = (msg) => {
    const el = $("stuError");
    if (el) el.textContent = msg || "";
  };
  const setBusy = (busy) =>
    document
      .querySelectorAll("#stuBody button")
      .forEach((b) => (b.disabled = busy));
  function nameSelect(selected) {
    const sel = document.createElement("select");
    sel.id = "stuName";
    STUDENTS.forEach((m) => sel.append(new Option(m.name, m.name)));
    if (selected) sel.value = selected;
    return sel;
  }

  function viewLogin(prefill = "", message = "") {
    stuView = "login";
    $("stuBody").innerHTML = `<span class="eyebrow">SISWA</span>
      <h2>Login <span>Siswa</span></h2>
      <p class="muted">Masuk dengan nama dan PIN untuk mencatat streak login harianmu.</p>
      <form id="stuForm" autocomplete="off">
        <label>Nama<span id="stuNameSlot"></span></label>
        <label>PIN (4–6 angka)<input id="stuPin" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required placeholder="••••" /></label>
        <p class="form-error" id="stuError"></p>
        <button class="btn btn-primary full-width" type="submit">Masuk →</button>
        <button class="btn btn-outline full-width" type="button" id="stuToCreate">Belum punya PIN? Buat PIN</button>
      </form>
      <p class="stu-note">Lupa PIN? Minta admin mereset; streak-mu tetap tersimpan.</p>`;
    $("stuNameSlot").append(nameSelect(prefill));
    setErr(message);
    $("stuForm").addEventListener("submit", handleLogin);
    $("stuToCreate").addEventListener("click", () =>
      viewCreate($("stuName").value),
    );
  }

  function viewCreate(prefill = "", message = "") {
    stuView = "create";
    $("stuBody").innerHTML = `<span class="eyebrow">AKUN BARU</span>
      <h2>Buat <span>PIN</span></h2>
      <p class="muted">Pilih namamu, lalu buat PIN 4–6 angka yang mudah kamu ingat.</p>
      <form id="stuForm" autocomplete="off">
        <label>Nama<span id="stuNameSlot"></span></label>
        <label>PIN (4–6 angka)<input id="stuPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required placeholder="••••" /></label>
        <label>Ulangi PIN<input id="stuPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required placeholder="••••" /></label>
        <p class="form-error" id="stuError"></p>
        <button class="btn btn-primary full-width" type="submit">Buat PIN &amp; Masuk →</button>
        <button class="btn btn-outline full-width" type="button" id="stuToLogin">Sudah punya PIN? Login</button>
      </form>
      <p class="stu-note">Jangan pakai PIN yang sama dengan kartu ATM, HP, atau akun lain. Pastikan itu namamu sendiri, karena nama yang sudah dipakai orang lain tidak bisa dibuat ulang.</p>`;
    $("stuNameSlot").append(nameSelect(prefill));
    setErr(message);
    $("stuForm").addEventListener("submit", handleCreate);
    $("stuToLogin").addEventListener("click", () =>
      viewLogin($("stuName").value),
    );
  }

  function viewChangePin() {
    stuView = "change";
    $("stuBody").innerHTML = `<span class="eyebrow">KEAMANAN</span>
      <h2>Ganti <span>PIN</span></h2>
      <form id="stuForm" autocomplete="off">
        <label>PIN lama<input id="stuPinOld" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password" required /></label>
        <label>PIN baru (4–6 angka)<input id="stuPin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required /></label>
        <label>Ulangi PIN baru<input id="stuPin2" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password" required /></label>
        <p class="form-error" id="stuError"></p>
        <button class="btn btn-primary full-width" type="submit">Simpan PIN</button>
        <button class="btn btn-outline full-width" type="button" id="stuBack">Batal</button>
      </form>`;
    $("stuForm").addEventListener("submit", handleChangePin);
    $("stuBack").addEventListener("click", viewProfile);
  }

  function viewProfile() {
    const s = getSession();
    const node = s && students[s.name];
    if (!node) return viewLogin();
    stuView = "profile";
    const cur = currentStreak(node);
    const body = $("stuBody");
    body.replaceChildren();

    body.append(createElement("span", "eyebrow", "HALO"));
    body.append(createElement("h2", "stu-name", node.name));

    const hero = createElement("div", "streak-hero" + (cur ? "" : " cold"));
    const tier = tierOf(cur);
    const upcoming = nextTier(cur);
    const flameBox = createElement("div", "streak-flame", "🔥");
    const flame = tier ? ringWrap(flameBox, tier) : flameBox;
    const info = createElement("div");
    const num = createElement("div", "streak-num", String(cur));
    num.append(
      createElement("small", "", cur === 1 ? " hari" : " hari berturut-turut"),
    );
    info.append(
      num,
      createElement(
        "div",
        "streak-label",
        `Terbaik: ${node.best || cur} hari` +
          (node.last
            ? ` · Login terakhir: ${parseYmd(node.last).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`
            : ""),
      ),
    );
    info.append(
      createElement(
        "div",
        "tier-line" + (tier ? ` tier-text-${tier.id}` : ""),
        (tier ? `Bingkai ${tier.name}` : "Belum ada bingkai") +
          (upcoming
            ? ` · ${upcoming.min - cur} hari lagi ke ${upcoming.name}`
            : " · tingkat tertinggi!"),
      ),
    );
    hero.append(flame, info);
    body.append(hero);
    body.append(
      createElement(
        "p",
        "stu-note",
        SKIP_WEEKEND
          ? "Streak naik tiap hari kamu membuka portal dalam keadaan login. Sabtu dan Minggu tidak memutus streak."
          : "Streak naik tiap hari kamu membuka portal dalam keadaan login. Melewatkan satu hari memutus streak.",
      ),
    );

    body.append(createElement("h3", "lb-title", "Bingkai streak"));
    body.append(tierLegend(cur, node.name.charAt(0).toUpperCase()));

    body.append(createElement("h3", "lb-title", "Streak tertinggi di kelas"));
    const board = leaderboard();
    if (!board.length) {
      body.append(createElement("p", "stu-note", "Belum ada streak aktif."));
    } else {
      const list = createElement("ol", "lb-list");
      board.forEach((r, i) => {
        const rt = tierOf(r.cur);
        const li = createElement(
          "li",
          "lb-row" +
            (r.name === node.name ? " me" : "") +
            (rt ? ` lb-${rt.id}` : ""),
        );
        li.append(
          createElement("span", "lb-rank", String(i + 1)),
          createElement("span", "lb-name", r.name),
          createElement("span", "lb-val", `🔥 ${r.cur}`),
        );
        list.append(li);
      });
      body.append(list);
    }

    const actions = createElement("div", "stu-actions");
    const change = createElement("button", "btn btn-outline", "Ganti PIN");
    const out = createElement("button", "btn btn-outline", "Keluar");
    change.type = out.type = "button";
    change.addEventListener("click", viewChangePin);
    out.addEventListener("click", () => {
      clearSession();
      renderStudentUI();
      viewLogin();
      showToast("Kamu sudah keluar.");
    });
    actions.append(change, out);
    body.append(actions);
  }

  // ----- Aksi form -----
  async function handleLogin(e) {
    e.preventDefault();
    const name = $("stuName").value;
    const pin = $("stuPin").value.trim();
    const lock = loadData(K.lock, { fails: 0, until: 0 });
    if (lock.until > Date.now())
      return setErr(
        `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil((lock.until - Date.now()) / 1000)} detik.`,
      );
    if (!PIN_RE.test(pin)) return setErr("PIN harus 4–6 angka.");
    setBusy(true);
    try {
      await refreshStudent(name);
    } catch {
      if (!students[name]) {
        setBusy(false);
        return setErr("Tidak bisa tersambung ke server. Coba lagi.");
      }
    }
    const node = students[name];
    if (!node || !node.hash) {
      setBusy(false);
      return viewCreate(name, "Kamu belum punya PIN. Buat PIN dulu.");
    }
    if (hashPin(pin, node.salt, name) !== node.hash) {
      const fails = (lock.fails || 0) + 1;
      const locked = fails >= MAX_FAILS;
      localStorage.setItem(
        K.lock,
        JSON.stringify({
          fails: locked ? 0 : fails,
          until: locked ? Date.now() + LOCK_MS : 0,
        }),
      );
      setBusy(false);
      return setErr(
        locked
          ? `Salah ${MAX_FAILS} kali. Tunggu ${LOCK_MS / 1000} detik.`
          : `PIN salah (${fails}/${MAX_FAILS}).`,
      );
    }
    localStorage.removeItem(K.lock);
    setSession(name);
    checkInNow();
    viewProfile();
    showToast(`Halo, ${name}!`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    const name = $("stuName").value;
    const pin = $("stuPin").value.trim();
    if (!PIN_RE.test(pin)) return setErr("PIN harus 4–6 angka.");
    if (pin !== $("stuPin2").value.trim())
      return setErr("Kedua PIN tidak sama.");
    setBusy(true);
    try {
      await refreshStudent(name);
    } catch {
      setBusy(false);
      return setErr("Tidak bisa tersambung ke server. Coba lagi.");
    }
    const existing = students[name];
    if (existing && existing.hash) {
      setBusy(false);
      return viewLogin(
        name,
        `${name} sudah punya PIN. Masukkan PIN-nya, atau minta admin mereset jika lupa.`,
      );
    }
    const salt = randomSalt();
    saveStudent({
      name,
      salt,
      hash: hashPin(pin, salt, name),
      count: existing ? existing.count || 0 : 0,
      best: existing ? existing.best || 0 : 0,
      last: existing ? existing.last || "" : "",
    });
    setSession(name);
    checkInNow();
    viewProfile();
    showToast(`Akun ${name} dibuat.`);
  }

  async function handleChangePin(e) {
    e.preventDefault();
    const s = getSession();
    const node = s && students[s.name];
    if (!node) return viewLogin();
    const oldPin = $("stuPinOld").value.trim();
    const pin = $("stuPin").value.trim();
    if (hashPin(oldPin, node.salt, node.name) !== node.hash)
      return setErr("PIN lama salah.");
    if (!PIN_RE.test(pin)) return setErr("PIN baru harus 4–6 angka.");
    if (pin !== $("stuPin2").value.trim())
      return setErr("Kedua PIN baru tidak sama.");
    node.salt = randomSalt();
    node.hash = hashPin(pin, node.salt, node.name);
    saveStudent(node);
    viewProfile();
    showToast("PIN diganti.");
  }

  // ----- Tombol di navbar + tampilan -----
  const stuBtn = createElement("button", "btn btn-outline");
  stuBtn.id = "studentBtn";
  stuBtn.type = "button";
  ($("loginOpen") || document.querySelector(".top-actions"))?.before(stuBtn);
  stuBtn.addEventListener("click", () => {
    if (getSession()) viewProfile();
    else viewLogin();
    openModal("studentModal");
  });

  function renderStudentUI() {
    const s = getSession();
    const node = s && students[s.name];
    stuBtn.replaceChildren(
      createElement("span", "", node ? "🔥" : "👤"),
      createElement(
        "span",
        node ? "" : "stu-label",
        node ? ` ${currentStreak(node)}` : " Siswa",
      ),
    );
    stuBtn.title = node ? `${node.name} — klik untuk profil` : "Login siswa";
    if ($("infoStreak")) $("infoStreak").textContent = streakInfoText();
    const sig = tierSignature();
    if (sig !== lastTierSig) {
      lastTierSig = sig;
      renderMembers($("memberSearch")?.value || "");
    }
    if (stuModal.classList.contains("show") && stuView === "profile")
      viewProfile();
    renderAdminStudents();
  }

  // ----- Tab admin: Siswa -----
  const stuTab = html(
    "div",
    "",
    `<h3>Akun Siswa</h3>
     <p class="muted small">Siswa membuat PIN sendiri saat pertama login. Gunakan "Reset PIN" jika ada yang lupa; streak tetap tersimpan.</p>
     <h3 class="lb-title">Pratinjau bingkai streak</h3>
     <div id="tierPreview"></div>
     <h3 class="lb-title">Daftar akun</h3>
     <div id="adminStudents"></div>`,
  );
  addAdminTab("stuTab", "Siswa", stuTab);
  $("tierPreview").append(tierLegend(0, "A", true));

  function renderAdminStudents() {
    const box = $("adminStudents");
    if (!box) return;
    box.replaceChildren();
    const list = Object.values(students).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    if (!list.length)
      box.append(
        createElement(
          "div",
          "empty-state",
          "Belum ada siswa yang membuat akun.",
        ),
      );
    list.forEach((n) => {
      const row = adminRow(
        n.name,
        `Streak ${currentStreak(n)} hari · terbaik ${n.best || 0} · ${n.hash ? "PIN aktif" : "PIN direset"}`,
        () => {
          if (!adminOnly()) return;
          if (!confirm(`Hapus akun ${n.name}? Streak ikut terhapus.`)) return;
          deleteStudent(n.name);
          renderStudentUI();
          showToast("Akun dihapus.");
        },
      );
      const reset = createElement(
        "button",
        "btn btn-outline btn-small",
        "Reset PIN",
      );
      reset.type = "button";
      reset.addEventListener("click", () => {
        if (!adminOnly()) return;
        if (!confirm(`Reset PIN ${n.name}? Dia perlu membuat PIN baru.`))
          return;
        n.salt = "";
        n.hash = "";
        saveStudent(n);
        renderStudentUI();
        showToast("PIN direset.");
      });
      row.insertBefore(reset, row.lastElementChild);
      box.append(row);
    });
  }

  // =====================================================================
  // Tombol bintang: matikan animasi bintang agar ringan (anti lag)
  // =====================================================================
  const STAR_KEY = "xrpl2_stars";
  const starBtn = createElement("button", "icon-btn star-toggle", "✦");
  starBtn.type = "button";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const savedStars = localStorage.getItem(STAR_KEY);
  let starsOn = savedStars ? savedStars === "on" : !reduced;

  function applyStars() {
    document.body.classList.toggle("stars-off", !starsOn);
    starBtn.classList.toggle("off", !starsOn);
    starBtn.setAttribute("aria-pressed", String(starsOn));
    const label = starsOn ? "Matikan bintang (mode hemat)" : "Nyalakan bintang";
    starBtn.setAttribute("aria-label", label);
    starBtn.title = label;
  }
  starBtn.addEventListener("click", () => {
    starsOn = !starsOn;
    try {
      localStorage.setItem(STAR_KEY, starsOn ? "on" : "off");
    } catch {}
    applyStars();
    showToast(
      starsOn ? "Bintang dinyalakan." : "Bintang dimatikan (mode hemat).",
    );
  });
  ($("themeToggle") || document.querySelector(".top-actions"))?.before(starBtn);
  applyStars();

  // =====================================================================
  // Mulai
  // =====================================================================
  renderKas();
  renderBirthdays();
  renderRekap();
  renderStudentUI();
  if (!SYNC_ON) checkInNow(); // dengan sinkron aktif, check-in menunggu data server
  decorateTasks();
  renderPiket();
  renderMembers($("memberSearch")?.value || "");
  setSync(syncState);

  // Perbarui hitung mundur & info saat lewat tengah malam.
  let lastDate = ymd();
  setInterval(() => {
    if (ymd() !== lastDate) {
      lastDate = ymd();
      decorateTasks();
      renderInfo();
      renderPiket();
      renderMembers($("memberSearch")?.value || "");
      if (!SYNC_ON || syncState === "online") checkInNow();
    }
  }, 30000);

  if (SYNC_ON) {
    // kirim ulang perubahan yang belum terkirim (misalnya karena offline)
    const retryDirty = () => {
      getDirty().forEach((token) => {
        if (token.startsWith("att:")) {
          const date = token.slice(4);
          pushAttendance(date, attHistory[date] || [])
            .then(() => clearDirty(token))
            .catch(() => {});
        } else if (token.startsWith("stu:")) {
          pushStudentEnc(token.slice(4))
            .then(() => clearDirty(token))
            .catch(() => {});
        } else if (SYNC_KEYS[token]) {
          pushKey(token).catch(() => {});
        }
      });
    };
    retryDirty();
    pullAll();
    setInterval(() => {
      retryDirty();
      pullAll();
    }, 15000);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) pullAll();
    });
    window.addEventListener("online", () => {
      retryDirty();
      pullAll();
    });
  }
})();
