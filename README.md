> **VERSI PERSONAL v3:** Nama lengkap orang menjadi identitas utama di header, hero, title, footer; bukan NanzTech/perusahaan. Isi nama, pengalaman, dan sertifikasi dari dashboard. Baca `docs/PROMPT_KHUSUS_PORTOFOLIO_PRIBADI_CLAUDE_CODEX.md` untuk pengembangan dengan agent.

# Portofolio Pribadi IT Developer — Bilingual + Admin CMS

Website **portofolio pribadi satu orang IT developer (bukan website perusahaan/agency)**, premium dengan desain original tetap dipertahankan, **Indonesia / English**, login admin, **database SQLite**, pengelolaan konten/proyek/sertifikasi, unggah dokumen, dan inbox pesan. Backend memakai **Node.js tanpa paket pihak ketiga**; tidak perlu menjalankan `npm install`. Frontend mempertahankan animasi JavaScript/CSS dari desain sebelumnya.

> **Konten awal adalah ilustrasi dan placeholder**. Jangan menyatakan proyek berhasil dikerjakan, hasil terukur, atau kepemilikan sertifikasi BNSP sebelum bukti dan izin publikasi tersedia.

## Sudah berfungsi dalam paket ini

- Website publik responsif, mode gelap/terang, animasi hero, particle canvas, reveal-on-scroll, modal detail proyek, filter, tombol ID/EN.
- Terjemahan konten ID/EN dan label antarmuka. Bahasa dipilih dari `?lang=id|en` lalu disimpan di `localStorage`.
- Admin di `/admin` dengan **login nyata**, password `scrypt`, sesi database, cookie `HttpOnly` + `SameSite=Strict`, proteksi CSRF, rate limit login.
- Admin **editor terpisah per bahasa** untuk profil, media sosial, layanan, proyek, pengalaman, teknologi, sertifikasi, dan proses kerja.
- Upload gambar JPG/PNG/WebP dan PDF, batas 5 MB gambar / 7 MB PDF, verifikasi tanda tangan file; media yang diunggah dapat dipakai di proyek, CV, dan sertifikat.
- Form pesan publik: disimpan dalam database saat server hidup; admin bisa menandai dibaca/hapus. Bila dibuka sebagai situs statis, form kembali menggunakan `mailto:`.
- SQLite otomatis dibuat pertama kali, isi awal dari `data/seed/id.json` dan `data/seed/en.json`.
- Test API dasar dengan `npm test`.

## Kebutuhan

- Node.js **minimal 22.16** (kode telah diuji pada Node.js 22.16). Fitur `node:sqlite` pada versi tersebut masih diberi tanda **experimental**; cek kompatibilitas jika memakai versi lain.
- VPS Linux/Windows/macOS untuk menjalankan proses Node yang terus aktif. **Shared hosting statis biasa tidak dapat menjalankan admin/database ini**.
- Untuk produksi: reverse proxy Nginx/Apache dengan HTTPS dan `APP_ORIGIN` yang tepat, backup, serta review keamanan sebelum publikasi.

## Menjalankan di laptop / VPS (pengembangan lokal)

```bash
# 1. Ekstrak ZIP, masuk ke folder proyek
cd portofolio-pribadi-it-cms

# 2. Buat admin dengan email milik Anda sendiri
npm run create-admin -- --email emailanda@example.com
# Anda akan diminta mengetik password (disembunyikan), minimal 12 karakter.

# 3. Jalankan server
npm start
```

Buka **http://127.0.0.1:3000/** untuk publik dan **http://127.0.0.1:3000/admin** untuk masuk. Tidak ada kredensial contoh atau password default.

Menjalankan pengujian:

```bash
npm test
```

## Variabel lingkungan

Aplikasi ini **tidak otomatis membaca file `.env`** (sengaja tanpa dependensi). Gunakan `export` pada terminal atau `Environment=` / `EnvironmentFile=` pada systemd:

| Variabel | Contoh | Keterangan |
|---|---|---|
| `HOST` | `127.0.0.1` | Untuk VPS di belakang reverse proxy, tetap localhost |
| `PORT` | `3000` | Port backend |
| `NODE_ENV` | `production` | Mengaktifkan `Secure` pada cookie dan HSTS, **wajib HTTPS** |
| `APP_ORIGIN` | `https://portfolio.example.com` | Origin yang diizinkan pada permintaan mutasi |
| `DATA_DIR` | `/var/lib/personal-it-portfolio` | Lokasi file database, berada di luar document root |
| `ADMIN_PASSWORD` | **jangan ditaruh permanen** | Hanya opsi non-interaktif untuk `create-admin`; lebih aman prompt interaktif |

Lihat `docs/DEPLOYMENT_VPS.md`.

## Cara menggunakan admin

1. Buka `/admin`, login menggunakan email dan password hasil `create-admin`.
2. Pilih tab konten, misalnya **Proyek Portofolio**.
3. Pilih bahasa **ID** atau **EN**. Edit semua field dan klik **Simpan Perubahan**. Jangan lupa mengedit bahasa lainnya.
4. Untuk gambar, klik **Unggah** pada field foto/screenshot/sertifikat; path akan masuk otomatis ke field. Klik **Simpan Perubahan** setelah mengunggah.
5. Buka **Lihat Website** untuk melihat perubahan publik.
6. Buka **Pesan Masuk** untuk melihat pesan dari formulir publik.

### Cara menambah proyek

Buka tab **Proyek Portofolio → + Tambah**, isi judul, kategori, tantangan, solusi, kontribusi, hasil, screenshot, dan URL yang boleh dipublikasikan. Gunakan keterangan **Draft / Contoh** selama informasi belum terverifikasi. Lengkapi juga bahasa EN.

### File penting

```text
portofolio-pribadi-it-cms/
├── public/
│   ├── index.html                   # Halaman publik
│   ├── css/styles.css               # Desain/animasi asli
│   ├── js/app.js                     # Tampilan, bilingual, animasi, form
│   ├── js/content.js                 # Fallback konten demo ID & EN
│   ├── admin/index.html             # UI login & dashboard
│   ├── admin/admin.css
│   ├── admin/admin.js                # Editor konten dan inbox
│   └── assets/uploads/              # Berkas hasil unggah
├── server/
│   ├── index.js                      # Server HTTP dan endpoint API
│   ├── db.js                         # Skema SQLite, session, content, audit
│   └── validate.js                   # Validasi input
├── data/seed/id.json                 # Data awal Indonesia
├── data/seed/en.json                 # Data awal English
├── data/seed/ui.json                 # Terjemahan interface bawaan
├── scripts/create-admin.js          # Setup admin tanpa password default
├── tests/app.test.js                 # Test autentikasi, CRUD, inbox, i18n
└── docs/                             # Spesifikasi, prompt AI, deployment
```

**Perhatian:** Setelah database dibuat, mengubah JSON pada `data/seed` tidak otomatis menimpa data produksi. Ubah konten menggunakan dashboard, atau lakukan migrasi data secara eksplisit. Jangan hapus SQLite produksi hanya demi mengganti seed.

## Batasan versi ini & rencana pengembangan

Ini adalah **CMS starter fungsional**, bukan produk yang sudah diaudit keamanan secara menyeluruh untuk produksi publik. Belum ada multi-user RBAC, 2FA, reset password, draft/publish workflow terpisah, galeri multi-foto per proyek, pengelolaan media delete, pelacakan versi per field, SMTP notification, advanced SEO server-rendered, atau panel multilingual completeness. Pembatasan spam kontak masih memori proses dan perlu dibuat persistent atau ditambah captcha di produksi.

Untuk proyek produksi yang lebih besar (mis. VPS/cPanel dengan MySQL), gunakan prompt dalam `docs/PROMPT_MIGRASI_LARAVEL_MYSQL.md` dan spesifikasi `docs/BLUEPRINT_CMS.md`. Untuk melanjutkan Node.js, gunakan `docs/PROMPT_AGENT_CLAUDE_CODEX.md`.

## Lisensi/konten

Website ini dibuat untuk penyesuaian portofolio milik pemilik proyek. Pastikan semua logo klien, screenshot, skema jaringan, dan berkas sertifikat telah memperoleh izin publikasi. Hindari mengekspos data pegawai/instansi, IP privat, NIK, token, dan dokumen rahasia.

### Pengaturan tampilan proyek (`visibility`)

Di editor Proyek, pilih **`draft`** (tidak ditampilkan di publik), **`demo`** (contoh studi kasus yang terlihat dengan label demo), atau **`published`** (terlihat di publik). Field `status` adalah teks label yang ditampilkan, bukan otorisasi publikasi. Sebelum mengubah ke `published`, periksa data proyek dan izin publikasinya pada **kedua bahasa**. Ini kontrol visibilitas dasar, belum sistem approval atau jadwal publikasi.
