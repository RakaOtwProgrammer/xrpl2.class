/* XRPL2 — CLASS PORTAL (versi perbaikan) */

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "xrpl2admin";
// Catatan: mengganti username/password di atas otomatis me-logout semua sesi admin
// yang tersimpan (setelah file script.js baru di-upload).

const STORAGE = {
  theme: "xrpl2_theme",
  notes: "xrpl2_notes",
  announcements: "xrpl2_announcements",
  materials: "xrpl2_materials",
  tasks: "xrpl2_tasks",
  piket: "xrpl2_piket",
  memories: "xrpl2_memories",
  spreadsheet: "xrpl2_spreadsheet",
  session: "xrpl2_admin_session",
};

const $ = (id) => document.getElementById(id);

function loadData(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch {
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    showToast("Gagal menyimpan data di browser ini.");
  }
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showToast(message) {
  const toast = $("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}

// Mengizinkan http/https dan alamat file relatif (assets/materi.pdf).
function safeUrl(value) {
  if (!value) return "";
  const trimmed = value.trim();

  if (!/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(trimmed) && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : "";
  } catch {
    return "";
  }
}

function createLink(url, text) {
  const link = createElement("a", "btn btn-outline btn-small", text);
  const validUrl = safeUrl(url);

  if (validUrl) {
    link.href = validUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  } else {
    link.href = "#";
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showToast("Tautan tidak valid.");
    });
  }
  return link;
}

// ---------- Data awal ----------

let announcements = loadData(STORAGE.announcements, []);
let materials = loadData(STORAGE.materials, []);
let tasks = loadData(STORAGE.tasks, []);
let memories = loadData(STORAGE.memories, []);
let spreadsheet = loadData(STORAGE.spreadsheet, "");

let piket = loadData(STORAGE.piket, {
  Senin: ["Petugas 1", "Petugas 2"],
  Selasa: ["Petugas 3", "Petugas 4"],
  Rabu: ["Petugas 5", "Petugas 6"],
  Kamis: ["Petugas 7", "Petugas 8"],
  Jumat: ["Petugas 9", "Petugas 10"],
});

const subjects = [
  "Pendidikan Agama",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Matematika",
  "Bahasa Inggris",
  "Informatika",
  "Dasar-Dasar PPLG",
  "IPAS",
  "PJOK",
  "Sejarah",
  "Seni Budaya",
  "Bahasa Daerah",
];

// ====== DAFTAR MURID (35 orang) ======
// Ganti "Nama Murid XX" dengan nama asli. Role boleh diubah:
// Ketua Kelas, Wakil Ketua, Sekretaris, Bendahara, atau Anggota.
const studentNames = [
  { name: "Abdillah Aqil Hafidz", role: "Anggota" },
  { name: "Amir Al Hasby Hasibuan", role: "Anggota" },
  { name: "Anas Tasya Nafisa", role: "Bendahara" },
  { name: "Atsila Nazhiifa", role: "anggota" },
  { name: "Aulia Khayrah Ardi", role: "Anggota" },
  { name: "Azka Nazifah", role: "Anggota" },
  { name: "Azura Syaky", role: "Anggota" },
  { name: "Azzahra Syafina", role: "W. Sekretaris" },
  { name: "Cahnaya", role: "Sekretaris" },
  { name: "Citra Cahya Wulamdari", role: "Anggota" },
  { name: "Damar Safaras Sitorus", role: "Ketua Kelas" },
  { name: "Diki Pratama", role: "Anggota" },
  { name: "Fawwaz Habibi Siregar", role: "W. Ketua kelas" },
  { name: "Fitri Andiyani", role: "Anggota" },
  { name: "Hermansyah Yura Putra", role: "Anggota" },
  { name: "Ihsan Aditya Zadin", role: "Anggota" },
  { name: "Juni Afika BR. Sihombing", role: "Anggota" },
  { name: "Juwi Ukhti Ramadhani", role: "Anggota" },
  { name: "Khairani Hisanah", role: "W. Bendahara" },
  { name: "Lilis Nirwana", role: "Anggota" },
  { name: "Maya anggraini", role: "Anggota" },
  { name: "MHD Azmi", role: "Anggota" },
  { name: "MHD Arafah", role: "Anggota" },
  { name: "Namisha Zahira", role: "Anggota" },
  { name: "Naufal Afqory", role: "Anggota" },
  { name: "Nur Ainun", role: "Anggota" },
  { name: "Nurul Asyfa", role: "Anggota" },
  { name: "Putri cilvia Anggariny", role: "Anggota" },
  { name: "Rahmat aria", role: "Anggota" },
  { name: "Rakha rasendria", role: "Anggota" },
  { name: "Ririn arianti", role: "Anggota" },
  { name: "Shafana Khoiriah", role: "Anggota" },
  { name: "Syakila", role: "Anggota" },
  { name: "Teuku Raffy Ruamsyah", role: "Anggota" },
  { name: "Vita anggraini", role: "Anggota" },
];

const members = [{ name: "Rhina Lubis", role: "Wali Kelas" }, ...studentNames];

// ---------- Tema (CSS memakai body.light) ----------

function applyTheme(theme) {
  const isLight = theme === "light";
  document.body.classList.toggle("light", isLight);
  const button = $("themeToggle");
  if (button) button.textContent = isLight ? "☾" : "☀";
}

applyTheme(localStorage.getItem(STORAGE.theme) || "dark");

$("themeToggle")?.addEventListener("click", () => {
  const next = document.body.classList.contains("light") ? "dark" : "light";
  localStorage.setItem(STORAGE.theme, next);
  applyTheme(next);
});

// ---------- Menu mobile (CSS memakai nav.open) ----------

const mainNav = $("mainNav");

$("menuToggle")?.addEventListener("click", () => {
  mainNav?.classList.toggle("open");
});

mainNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => mainNav.classList.remove("open"));
});

// ---------- Catatan ----------

const noteInput = $("noteInput");
if (noteInput) noteInput.value = localStorage.getItem(STORAGE.notes) || "";

$("saveNote")?.addEventListener("click", () => {
  localStorage.setItem(STORAGE.notes, noteInput?.value || "");
  if ($("noteStatus"))
    $("noteStatus").textContent = "✓ Catatan berhasil disimpan.";
  showToast("Notes berhasil disimpan!");
});

// ---------- Helper daftar admin ----------

function adminRow(title, subtitle, onRemove) {
  const row = createElement("div", "admin-item");
  const text = createElement("div");
  text.append(
    createElement("strong", "", title),
    createElement("p", "", subtitle),
  );

  const remove = createElement("button", "btn btn-outline btn-small", "Hapus");
  remove.type = "button";
  remove.addEventListener("click", onRemove);

  row.append(text, remove);
  return row;
}

// ---------- Pengumuman ----------

function renderAnnouncements() {
  const list = $("announcementList");
  const adminList = $("adminAnnouncements");
  list?.replaceChildren();
  adminList?.replaceChildren();

  if (announcements.length === 0 && list) {
    list.append(
      createElement("div", "empty-state", "Belum ada pengumuman dari admin."),
    );
  }

  announcements.forEach((item) => {
    list?.append(
      (() => {
        const card = createElement("article", "announcement-item");
        card.append(
          createElement("b", "", item.title),
          createElement("p", "", item.body),
          createElement("small", "", item.date || ""),
        );
        return card;
      })(),
    );

    adminList?.append(
      adminRow(item.title, item.body, () => {
        announcements = announcements.filter((a) => a.id !== item.id);
        saveData(STORAGE.announcements, announcements);
        renderAnnouncements();
        showToast("Pengumuman dihapus.");
      }),
    );
  });
}

$("announcementForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("announceTitle").value.trim();
  const body = $("announceBody").value.trim();

  if (!title || !body) return showToast("Lengkapi judul dan isi pengumuman.");

  announcements.unshift({
    id: Date.now(),
    title,
    body,
    date: new Date().toLocaleDateString("id-ID"),
  });
  saveData(STORAGE.announcements, announcements);
  event.target.reset();
  renderAnnouncements();
  showToast("Pengumuman berhasil dipublikasikan.");
});

// ---------- Piket ----------

function renderPiket() {
  const table = $("piketTable");
  if (!table) return;
  table.replaceChildren();

  ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].forEach((day) => {
    const row = document.createElement("tr");
    const statusCell = document.createElement("td");
    statusCell.append(createElement("span", "status-chip", "Terjadwal"));

    row.append(
      createElement("td", "", day),
      createElement("td", "", (piket[day] || []).join(", ") || "Belum diatur"),
      statusCell,
    );
    table.append(row);
  });

  renderAdminPiket();
}

// Daftar jadwal piket di panel admin (dibuat otomatis di bawah form).
function renderAdminPiket() {
  const form = $("piketForm");
  if (!form) return;

  let box = $("adminPiket");
  if (!box) {
    box = createElement("div");
    box.id = "adminPiket";
    form.after(box);
  }
  box.replaceChildren();

  ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"].forEach((day) => {
    const names = (piket[day] || []).join(", ") || "Belum diatur";
    box.append(
      adminRow(day, names, () => {
        piket[day] = [];
        saveData(STORAGE.piket, piket);
        renderPiket();
        showToast(`Jadwal piket ${day} dikosongkan.`);
      }),
    );
  });
}

// Saat hari dipilih, isi kolom nama dengan jadwal yang sudah ada.
function fillPiketInput() {
  const day = $("piketDay")?.value;
  if ($("piketNames")) $("piketNames").value = (piket[day] || []).join(", ");
}

$("piketDay")?.addEventListener("change", fillPiketInput);

$("piketForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const day = $("piketDay").value;
  const names = $("piketNames")
    .value.split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length === 0) return showToast("Masukkan nama petugas piket.");

  piket[day] = names;
  saveData(STORAGE.piket, piket);
  renderPiket();
  showToast(`Jadwal piket ${day} berhasil disimpan.`);
});

fillPiketInput();

// ---------- Mata pelajaran ----------

function renderSubjects() {
  const grid = $("subjectGrid");
  if (!grid) return;
  grid.replaceChildren();

  subjects.forEach((subject) => {
    const card = createElement("article", "subject-card");
    card.append(
      createElement("span", "subject-icon", "◈"),
      createElement("h3", "", subject),
      createElement("p", "", "Materi pembelajaran XRPL2"),
    );
    grid.append(card);
  });
}

// ---------- Anggota ----------

function memberCard(member) {
  const isTeacher = member.role === "Wali Kelas";
  const card = createElement(
    "article",
    "member-card" + (isTeacher ? " teacher" : ""),
  );
  const initials = isTeacher
    ? "WK"
    : member.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

  card.append(
    createElement("div", "avatar", initials),
    createElement("b", "", member.name),
    createElement("small", "muted", member.role),
  );
  return card;
}

function renderMembers(search = "") {
  const grid = $("memberGrid");
  const count = $("memberCount");
  if (!grid) return;

  // Baris khusus wali kelas: di paling atas, sendirian (dibuat otomatis).
  let teacherRow = $("teacherRow");
  if (!teacherRow) {
    teacherRow = createElement("div", "teacher-row");
    teacherRow.id = "teacherRow";
    grid.before(teacherRow);
  }

  teacherRow.replaceChildren();
  grid.replaceChildren();

  const query = search.trim().toLowerCase();
  const filtered = members.filter((m) => m.name.toLowerCase().includes(query));
  const teachers = filtered.filter((m) => m.role === "Wali Kelas");
  const students = filtered.filter((m) => m.role !== "Wali Kelas");

  // Penghitung hanya menghitung murid (wali kelas tidak ikut dihitung).
  if (count) count.textContent = `${students.length} MURID`;

  teachers.forEach((teacher) => teacherRow.append(memberCard(teacher)));

  if (filtered.length === 0) {
    grid.append(createElement("div", "empty-state", "Nama tidak ditemukan."));
    return;
  }

  students.forEach((student) => grid.append(memberCard(student)));
}

$("memberSearch")?.addEventListener("input", (event) => {
  renderMembers(event.target.value);
});

// ---------- Memories ----------

function persistMemories(nextMemories) {
  try {
    localStorage.setItem(STORAGE.memories, JSON.stringify(nextMemories));
    memories = nextMemories;
    return true;
  } catch {
    showToast(
      "Penyimpanan browser penuh. Hapus beberapa foto atau pilih gambar yang lebih kecil.",
    );
    return false;
  }
}

function renderMemories() {
  const grid = $("memoriesGrid");
  const adminList = $("adminMemories");
  grid?.replaceChildren();
  adminList?.replaceChildren();

  if (memories.length === 0 && grid) {
    grid.append(
      createElement(
        "div",
        "empty-state",
        "Belum ada foto. Admin dapat menambahkan foto melalui panel admin.",
      ),
    );
  }

  memories.forEach((memory) => {
    if (grid) {
      const card = createElement("figure", "memory-card");
      const image = document.createElement("img");
      image.src = memory.image;
      image.alt = memory.caption || "Foto Memories XRPL2";
      image.loading = "lazy";
      card.append(image, createElement("figcaption", "", memory.caption));
      grid.append(card);
    }

    adminList?.append(
      adminRow(memory.caption || memory.fileName, memory.fileName, () => {
        const nextMemories = memories.filter((item) => item.id !== memory.id);
        if (!persistMemories(nextMemories)) return;
        renderMemories();
        showToast("Foto berhasil dihapus dari Memories.");
      }),
    );
  });
}

function compressMemoryImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error(`Gagal membaca gambar ${file.name}.`));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () =>
        reject(new Error(`Format gambar ${file.name} tidak dapat dibuka.`));
      image.onload = () => {
        const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Browser tidak mendukung pemrosesan gambar."));
          return;
        }

        try {
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          let dataUrl = canvas.toDataURL("image/webp", 0.78);
          if (!dataUrl.startsWith("data:image/webp")) {
            dataUrl = canvas.toDataURL("image/jpeg", 0.78);
          }
          resolve(dataUrl);
        } catch {
          reject(new Error(`Gagal memproses gambar ${file.name}.`));
        }
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

$("memoriesForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const files = Array.from($("memoryImages").files || []);
  const caption = $("memoryCaption").value.trim();

  if (files.length === 0) return showToast("Pilih minimal satu gambar.");
  if (files.length > 10)
    return showToast("Maksimal 10 gambar dapat ditambahkan sekaligus.");

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  const invalidFile = files.find(
    (file) => !allowedTypes.includes(file.type) || file.size > 10 * 1024 * 1024,
  );
  if (invalidFile) {
    return showToast(
      `${invalidFile.name}: gunakan JPG, PNG, atau WebP maksimal 10 MB.`,
    );
  }

  try {
    const addedMemories = [];
    for (const [index, file] of files.entries()) {
      addedMemories.push({
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
        caption: caption || file.name.replace(/\.[^.]+$/, ""),
        fileName: file.name,
        image: await compressMemoryImage(file),
      });
    }

    if (!persistMemories([...addedMemories, ...memories])) return;
    event.target.reset();
    renderMemories();
    showToast("Foto berhasil ditambahkan ke Memories.");
  } catch (error) {
    showToast(
      error instanceof Error ? error.message : "Gagal memproses gambar.",
    );
  }
});

// ---------- Materi ----------

let activeMaterialFilter = "all";

function renderMaterials() {
  const list = $("materialList");
  const adminList = $("adminMaterials");
  list?.replaceChildren();
  adminList?.replaceChildren();

  const filtered = materials.filter(
    (item) =>
      activeMaterialFilter === "all" || item.type === activeMaterialFilter,
  );

  if (filtered.length === 0 && list) {
    list.append(
      createElement("div", "empty-state", "Belum ada materi tersedia."),
    );
  }

  filtered.forEach((item) => {
    if (list) {
      const card = createElement("article", "resource-item");
      const info = createElement("div", "resource-info");
      info.append(
        createElement("b", "", item.title),
        createElement("small", "", item.type),
      );
      card.append(
        createElement("div", "file-icon", item.type.slice(0, 3)),
        info,
        createLink(item.url, "Buka Materi ↗"),
      );
      list.append(card);
    }
  });

  // Daftar admin selalu menampilkan semua materi (tidak terpengaruh filter).
  materials.forEach((item) => {
    adminList?.append(
      adminRow(item.title, item.type, () => {
        materials = materials.filter((m) => m.id !== item.id);
        saveData(STORAGE.materials, materials);
        renderMaterials();
        showToast("Materi berhasil dihapus.");
      }),
    );
  });
}

$("materialFilters")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;

  activeMaterialFilter = button.dataset.filter;
  $("materialFilters")
    .querySelectorAll(".filter")
    .forEach((f) => f.classList.remove("active"));
  button.classList.add("active");
  renderMaterials();
});

$("materialForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("materialTitle").value.trim();
  const type = $("materialType").value;
  const url = $("materialUrl").value.trim();

  if (!title || !url) return showToast("Lengkapi data materi.");
  if (!safeUrl(url))
    return showToast("Gunakan URL http/https atau alamat file relatif.");

  materials.unshift({ id: Date.now(), title, type, url });
  saveData(STORAGE.materials, materials);
  event.target.reset();
  renderMaterials();
  showToast("Materi berhasil ditambahkan.");
});

// ---------- Tugas ----------

function renderTasks() {
  const list = $("taskList");
  const adminList = $("adminTasks");
  list?.replaceChildren();
  adminList?.replaceChildren();

  if (tasks.length === 0 && list) {
    list.append(
      createElement("div", "empty-state", "Belum ada tugas yang dibagikan."),
    );
  }

  tasks.forEach((item) => {
    if (list) {
      const card = createElement("article", "task-item");
      const info = createElement("div", "task-info");
      info.append(
        createElement("small", "", item.subject),
        createElement("b", "", item.title),
        createElement("p", "", item.description),
        createElement(
          "div",
          "task-deadline",
          item.deadline
            ? `Deadline: ${item.deadline}`
            : "Deadline belum ditentukan",
        ),
      );
      card.append(createElement("div", "file-icon", "✎"), info);
      if (item.url) card.append(createLink(item.url, "Buka Lampiran ↗"));
      list.append(card);
    }

    adminList?.append(
      adminRow(item.title, item.subject, () => {
        tasks = tasks.filter((t) => t.id !== item.id);
        saveData(STORAGE.tasks, tasks);
        renderTasks();
        showToast("Tugas berhasil dihapus.");
      }),
    );
  });
}

$("taskForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = $("taskTitle").value.trim();
  const subject = $("taskSubject").value.trim();
  const deadline = $("taskDeadline").value;
  const description = $("taskDescription").value.trim();
  const url = $("taskUrl").value.trim();

  if (!title || !subject || !description) {
    return showToast("Lengkapi data tugas terlebih dahulu.");
  }
  if (url && !safeUrl(url)) return showToast("Tautan lampiran tidak valid.");

  tasks.unshift({ id: Date.now(), title, subject, deadline, description, url });
  saveData(STORAGE.tasks, tasks);
  event.target.reset();
  renderTasks();
  showToast("Tugas berhasil dipublikasikan.");
});

// ---------- Spreadsheet absensi ----------

function renderSpreadsheet() {
  const link = $("sheetLink");
  const status = $("sheetStatus");
  if (!link || !status) return;

  const validUrl = safeUrl(spreadsheet);

  if (validUrl) {
    link.href = validUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.classList.remove("disabled-link");
    status.textContent = "LINK ABSENSI TERSEDIA";
  } else {
    link.href = "#";
    link.classList.add("disabled-link");
    status.textContent = "LINK BELUM DIATUR";
  }

  if ($("sheetUrl")) $("sheetUrl").value = spreadsheet || "";
}

$("sheetForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const url = $("sheetUrl").value.trim();

  if (!url || !safeUrl(url))
    return showToast("Masukkan URL spreadsheet yang valid.");

  spreadsheet = url;
  saveData(STORAGE.spreadsheet, spreadsheet);
  renderSpreadsheet();
  showToast("Link absensi berhasil disimpan.");
});

// ---------- Modal (CSS memakai .modal-backdrop.show) ----------

function openModal(id) {
  $(id)?.classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  $(id)?.classList.remove("show");
  if (!document.querySelector(".modal-backdrop.show")) {
    document.body.style.overflow = "";
  }
}

// Sesi admin: setelah login, tidak perlu mengisi username & password lagi
// selama 30 hari di browser ini (sampai menekan Logout).
const SESSION_DAYS = 30;

// Kunci sesi diturunkan dari username + password. Saat password diganti,
// kuncinya berubah sehingga semua sesi lama otomatis tidak berlaku lagi.
function sessionKey() {
  const text = `${ADMIN_USERNAME}:${ADMIN_PASSWORD}`;
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) >>> 0;
  }
  return String(hash);
}

function isAdminLoggedIn() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE.session));
    const valid =
      session && session.expires > Date.now() && session.key === sessionKey();

    if (!valid && session !== null) localStorage.removeItem(STORAGE.session);
    return Boolean(valid);
  } catch {
    localStorage.removeItem(STORAGE.session);
    return false;
  }
}

function setAdminSession(on) {
  if (on) {
    localStorage.setItem(
      STORAGE.session,
      JSON.stringify({
        expires: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
        key: sessionKey(),
      }),
    );
  } else {
    localStorage.removeItem(STORAGE.session);
  }
  updateLoginButton();
}

function updateLoginButton() {
  const button = $("loginOpen");
  if (button)
    button.textContent = isAdminLoggedIn() ? "Panel Admin" : "Login Admin";
}

$("loginOpen")?.addEventListener("click", () => {
  openModal(isAdminLoggedIn() ? "adminModal" : "loginModal");
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => closeModal(button.dataset.close));
});

document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
  backdrop.addEventListener("click", (event) => {
    // Panel admin tidak ditutup saat area kosong diklik (hanya lewat tombol × / Esc).
    if (event.target === backdrop && backdrop.id !== "adminModal")
      closeModal(backdrop.id);
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeModal("loginModal");
    closeModal("adminModal");
  }
});

// ---------- LOGIN FIREWALL ----------

const LOGIN_FIREWALL = {
  attempts: "xrpl2_failed_attempts",
  lock: "xrpl2_login_lock",
  maxAttempts: 5,
  lockDuration: 5 * 60 * 1000, // 5 menit
};

let loginCountdownInterval = null;

function getFailedAttempts() {
  return Number(localStorage.getItem(LOGIN_FIREWALL.attempts)) || 0;
}

function getLockTime() {
  return Number(localStorage.getItem(LOGIN_FIREWALL.lock)) || 0;
}

function isLoginLocked() {
  return Date.now() < getLockTime();
}

function updateLoginFirewall() {
  const button = $("loginForm")?.querySelector(
    'button[type="submit"], button:not([type]), input[type="submit"]',
  );

  const error = $("loginError");

  if (!button) return;

  const remaining = getLockTime() - Date.now();

  if (remaining > 0) {
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    button.disabled = true;
    button.textContent = `Tunggu ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    if (error) {
      error.textContent = `Terlalu banyak percobaan login. Coba lagi dalam ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.`;
    }

    return;
  }

  // Penguncian sudah berakhir
  if (getLockTime() > 0) {
    localStorage.removeItem(LOGIN_FIREWALL.lock);
    localStorage.removeItem(LOGIN_FIREWALL.attempts);
  }

  button.disabled = false;
  button.textContent = "Login";
}

function startLoginCountdown() {
  updateLoginFirewall();

  if (loginCountdownInterval) {
    clearInterval(loginCountdownInterval);
  }

  loginCountdownInterval = setInterval(() => {
    updateLoginFirewall();

    if (!isLoginLocked()) {
      clearInterval(loginCountdownInterval);
      loginCountdownInterval = null;
    }
  }, 1000);
}

function recordFailedLogin() {
  let attempts = getFailedAttempts() + 1;

  if (attempts >= LOGIN_FIREWALL.maxAttempts) {
    localStorage.setItem(
      LOGIN_FIREWALL.lock,
      String(Date.now() + LOGIN_FIREWALL.lockDuration),
    );

    localStorage.removeItem(LOGIN_FIREWALL.attempts);

    showToast("Login dikunci selama 5 menit!");

    startLoginCountdown();
    return;
  }

  localStorage.setItem(LOGIN_FIREWALL.attempts, String(attempts));

  const remaining = LOGIN_FIREWALL.maxAttempts - attempts;

  $("loginError").textContent =
    `Username atau password salah. Sisa percobaan: ${remaining} kali.`;
}

// Jalankan pemeriksaan saat halaman dibuka
startLoginCountdown();

$("loginForm")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const username = $("adminUser").value.trim();
  const password = $("adminPass").value;
  const error = $("loginError");

  // Cek apakah login sedang dikunci
  if (isLoginLocked()) {
    updateLoginFirewall();
    return;
  }

  // Login berhasil
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    error.textContent = "";

    localStorage.removeItem(LOGIN_FIREWALL.attempts);
    localStorage.removeItem(LOGIN_FIREWALL.lock);

    event.target.reset();

    updateLoginFirewall();

    closeModal("loginModal");
    openModal("adminModal");

    setAdminSession(true);

    showToast("Login admin berhasil.");
  } else {
    // Login gagal
    recordFailedLogin();
  }
});

$("logoutBtn")?.addEventListener("click", () => {
  closeModal("adminModal");
  setAdminSession(false);
  showToast("Kamu telah logout.");
});

// ---------- Tab admin ----------

document.querySelectorAll(".admin-tab").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".admin-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".admin-content")
      .forEach((c) => c.classList.add("hidden"));
    button.classList.add("active");
    $(button.dataset.tab)?.classList.remove("hidden");
  });
});

// ---------- Animasi scroll ----------

function initScrollAnimation() {
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("visible");
        observer.unobserve(el);
        // Lepas class setelah animasi agar efek hover tidak terganggu.
        setTimeout(() => el.classList.remove("reveal", "visible"), 800);
      });
    },
    { threshold: 0.12 },
  );

  document
    .querySelectorAll(
      ".section-heading, .panel, .subject-card, .member-card, .attendance-card",
    )
    .forEach((el) => {
      el.classList.add("reveal");
      observer.observe(el);
    });
}

// ---------- Tahun footer ----------

const footerYear = document.querySelector("footer p span");
if (footerYear) footerYear.textContent = `© ${new Date().getFullYear()} XRPL2`;

// ---------- Jalankan ----------

function initXRPL2() {
  renderAnnouncements();
  renderPiket();
  renderSubjects();
  renderMembers();
  renderMemories();
  renderMaterials();
  renderTasks();
  renderSpreadsheet();
  initScrollAnimation();
  updateLoginButton();
}

initXRPL2();
