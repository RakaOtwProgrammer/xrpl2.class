XRPL2 — WEB APP KELAS

CARA MENJALANKAN
1. Ekstrak folder XRPL2-WebApp.
2. Buka index.html di browser, atau jalankan dengan Live Server di VS Code.
3. Login admin demo:
   Username: adminxrpl2
   Password: XRPL2Admin!

FILE
- index.html : struktur halaman
- style.css  : tampilan responsif, tema gelap/cerah, animasi bintang jatuh
- script.js  : interaksi, data contoh, login demo, penyimpanan localStorage

PENTING — SEBELUM DIPAKAI BERSAMA KELAS
- Ganti nama 35 murid, nama wali kelas, dan username Instagram di array `members` pada script.js.
- Ganti username/password demo pada bagian ADMIN_USERNAME dan ADMIN_PASSWORD.
- Data saat ini tersimpan di localStorage browser masing-masing. Artinya data tidak otomatis sinkron antarperangkat.
- Login admin ini hanya simulasi frontend. Jangan gunakan untuk melindungi data penting di website publik.
- Agar bisa dipakai seluruh kelas secara online, deploy frontend dan hubungkan backend/database + autentikasi sungguhan (misalnya Firebase/Supabase).
- Untuk absensi, masukkan URL Google Spreadsheet melalui Admin Panel > Absensi. Atur izin spreadsheet dengan hati-hati.
- File materi dapat diunggah ke hosting/penyimpanan online, lalu URL-nya dimasukkan dari Admin Panel > Materi.
- Foto anggota belum disediakan secara default; field `photo` dapat diisi URL gambar setelah mendapat izin anggota.

Fitur tersedia:
kata pembuka, notes, admin panel, jadwal piket, mata pelajaran, 35 murid + 1 wali kelas,
pembagian materi PDF/Word/PowerPoint/audio/video/link, tugas wajib dari guru, akun Instagram,
foto opsional, galeri Memories yang dapat diisi dari Admin Panel, tautan absensi spreadsheet,
tema gelap/cerah, dan animasi bintang jatuh. Foto Memories dikompres dan disimpan di browser
perangkat ini; foto tidak otomatis tersinkron ke perangkat lain.

==========================================================
FITUR TAMBAHAN (Fitur2.js, Fitur2.css, firebase-config.js, manifest.json, sw.js)
==========================================================
File baru: Fitur2.js, Fitur2.css, firebase-config.js, manifest.json, sw.js, icon-192.png, icon-512.png.
index.html hanya ditambah 4 baris (link Fitur2.css, manifest, apple-touch-icon, dan 2 script).

1. Info hari ini (Beranda): piket hari ini, deadline tugas terdekat, ulang tahun. Baris hari ini di tabel Piket disorot.
2. Hitung mundur tugas: "2 hari lagi / Besok / Hari ini! / Lewat N hari", warna berubah mendekati deadline.
3. Rekap absensi: tabel per bulan (Izin/Sakit/Alpha) + tombol Unduh CSV. Rekap mulai terisi sejak fitur ini dipasang.
4. Ulang tahun: Admin Panel > Ulang Tahun. Hanya tanggal dan bulan yang disimpan (tahun lahir tidak).
5. Kas kelas: bagian "Kas" (terbuka untuk semua) + Admin Panel > Kas untuk mencatat pemasukan/pengeluaran.
6. PWA: tombol "Pasang" muncul di browser yang mendukung; di iPhone pakai Share > Add to Home Screen.
   PWA hanya jalan lewat http/https (bukan file://). Jika mengubah daftar file di sw.js, naikkan nomor CACHE.
7. Sinkron online (opsional, Firebase Realtime Database lewat REST, tanpa SDK):
   a. Buat project di console.firebase.google.com > Build > Realtime Database > Create database.
   b. Salin URL database ke firebase-config.js (const XRPL2_DB_URL = "https://....firebasedatabase.app").
   c. Tab Rules, tempel aturan di bawah, lalu Publish.
   d. Login admin di perangkat yang datanya paling lengkap > Admin Panel > Sinkron > "Unggah semua data".
      (Jika server masih kosong, data perangkat pertama yang membuka portal otomatis diunggah.)
   Data yang disinkronkan: pengumuman, materi, tugas, piket, jadwal, foto Memories, kas, ulang tahun, absensi.
   Absensi disimpan per murid sehingga dua murid yang mengirim bersamaan tidak saling menimpa.
   Perangkat mengecek perubahan tiap 15 detik dan saat tab dibuka kembali. Kalau offline, perubahan dikirim ulang saat tersambung.
   Konflik untuk data selain absensi: yang terakhir menyimpan menang.

   Aturan database (WAJIB diperbarui jika memakai login siswa, karena ada data baru bernama "stu"):
   {
     "rules": {
       ".read": true,
       "data": { ".write": true },
       "meta": { ".write": true },
       "att": { "$date": { "$name": {
         ".write": true,
         ".validate": "newData.hasChildren(['name','status'])",
         "name": { ".validate": "newData.isString() && newData.val().length <= 60" },
         "status": { ".validate": "newData.isString() && newData.val().matches(/^(Izin|Sakit|Alpha)$/)" },
         "note": { ".validate": "newData.isString() && newData.val().length <= 120" },
         "$other": { ".validate": false }
       } } },
       "stu": { "$name": {
         ".write": true,
         ".validate": "newData.hasChildren(['name','count','best'])",
         "name": { ".validate": "newData.isString() && newData.val().length <= 60" },
         "salt": { ".validate": "newData.isString() && newData.val().length <= 64" },
         "hash": { ".validate": "newData.isString() && (newData.val().length == 0 || newData.val().length == 64)" },
         "count": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000" },
         "best": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100000" },
         "last": { ".validate": "newData.isString() && newData.val().length <= 10" },
         "$other": { ".validate": false }
       } }
     }
   }

   PENTING — KEAMANAN: login admin di portal ini hanya simulasi di sisi browser. Dengan aturan di atas,
   siapa pun yang tahu URL database bisa membaca dan menulis data. Itu cukup untuk kelas yang saling kenal,
   tetapi jangan simpan data sensitif, dan jangan bagikan URL database di tempat publik. Untuk perlindungan
   sungguhan, tambahkan autentikasi (Firebase Authentication atau Supabase) dan batasi aturan tulis untuk admin.
   Foto Memories memakan kuota dan bandwidth; pantau pemakaian di console Firebase.

8. Login siswa + streak login (Fitur2.js, tombol "👤 Siswa" di navbar):
   - Siswa memilih nama lalu membuat PIN 4-6 angka saat pertama kali. Setelah itu login dengan nama + PIN.
   - Streak naik 1 setiap hari siswa membuka portal dalam keadaan login. Sabtu dan Minggu tidak memutus streak
     (ubah SKIP_WEEKEND di Fitur2.js menjadi false jika tidak diinginkan). Hari libur nasional belum dihitung.
   - Di Beranda ada baris "Streak Login", dan di profil ada papan 5 streak tertinggi kelas.
   - Salah PIN 5 kali: dikunci 30 detik di perangkat itu. PIN disimpan sebagai hash + salt, bukan teks asli.
   - Lupa PIN: Admin Panel > tab Siswa > Reset PIN (streak tetap tersimpan). Admin juga bisa menghapus akun.
   - Tanpa sinkron online, akun dan streak hanya ada di browser masing-masing perangkat.
   - KETERBATASAN: ini identitas ringan, bukan keamanan sungguhan. Hash PIN terbaca oleh siapa pun yang tahu URL
     database, dan PIN pendek bisa ditebak. Nama yang belum punya PIN bisa diklaim siapa saja, jadi minta siswa
     membuat PIN segera setelah dibuka. Streak memakai jam perangkat sehingga bisa dicurangi. Gunakan hanya untuk
     fitur hiburan seperti streak, bukan untuk data penting.

9. Bingkai ikon berdasarkan streak (Fitur2.js + Fitur2.css):
   - Streak 10 hari: bingkai Besi. 30: Emas. 100: Emerald. 200: Diamond (berkilau). 356: Obsidian (ungu-hitam, berkilau).
   - Bingkai muncul di ikon kartu Anggota dan di profil siswa, memakai streak SAAT INI. Kalau streak putus, bingkai ikut turun.
   - Ubah batas hari / nama tingkat di array TIERS (bagian atas Fitur2.js). Warna ada di bagian "Bingkai tier streak" Fitur2.css.
   - Pratinjau semua bingkai ada di Admin Panel > Siswa dan di profil siswa (yang belum tercapai tampil redup).
   - Tombol bintang (mode hemat) juga mematikan animasi kilau bingkai; bingkainya tetap tampil.