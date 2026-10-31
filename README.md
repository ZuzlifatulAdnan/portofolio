> **VERSI PERSONAL v3:** Nama lengkap orang menjadi identitas utama di header, hero, title, footer; bukan NanzTech/perusahaan. Isi nama, pengalaman, dan sertifikasi dari dashboard. Baca `docs/PROMPT_KHUSUS_PORTOFOLIO_PRIBADI_CLAUDE_CODEX.md` untuk pengembangan dengan agent.

# Portofolio Pribadi IT Developer — Bilingual + Admin CMS

Website **portofolio pribadi satu orang IT developer (bukan website perusahaan/agency)**, **Indonesia / English**, login admin, **database MySQL**, pengelolaan konten/proyek/sertifikasi, unggah dokumen, dan inbox pesan. Backend memakai **Node.js**, `mysql2`, dan `dotenv`. Frontend mempertahankan desain dan animasi JavaScript/CSS yang sudah ada. Konfigurasi bawaan ditujukan untuk pengembangan lokal.

> **Konten awal adalah ilustrasi dan placeholder**. Jangan menyatakan proyek berhasil dikerjakan, hasil terukur, atau kepemilikan sertifikasi BNSP sebelum bukti dan izin publikasi tersedia.

## Sudah berfungsi dalam paket ini

- Website publik responsif, mode gelap/terang, animasi hero, particle canvas, reveal-on-scroll, modal detail proyek, filter, tombol ID/EN.
- Terjemahan konten ID/EN dan label antarmuka. Bahasa dipilih dari `?lang=id|en` lalu disimpan di `localStorage`.
- Admin di `/admin` dengan password `scrypt` asinkron, cookie `HttpOnly` + `SameSite=Strict`, proteksi CSRF/origin, dan pembatasan login persisten. Sesi berakhir setelah 30 menit tidak aktif atau maksimal 12 jam.
- Admin **editor terpisah per bahasa** untuk profil, media sosial, layanan, proyek, pengalaman, teknologi, sertifikasi, dan proses kerja.
- Upload JPG/PNG/WebP (maksimal 5 MB) diperiksa dengan decoder, ditulis ulang, dan dibuang metadata-nya. PDF (maksimal 7 MB/100 halaman) diperiksa dan fitur aktif umum ditolak; unduhan memakai attachment dan sandbox.
- Form pesan publik: disimpan dalam database saat server hidup; admin bisa menandai dibaca/hapus. Bila dibuka sebagai situs statis, form kembali menggunakan `mailto:`.
- Tabel MySQL otomatis disiapkan, isi awal dari `data/seed/id.json` dan `data/seed/en.json`. Setup ulang tidak menimpa konten yang sudah disimpan.
- Test API dasar dengan `npm test`.
- Pengaturan **SEO & Mesin Pencari**: metadata ID/EN, gambar sosial, domain canonical, hreflang, Google Search Console, robots.txt, sitemap.xml, serta HTML konten dari server.
- Pengaturan **Warna & Tampilan**: palet dan warna tema gelap/terang, font, sudut kartu, tema awal, animasi, pratinjau, dan validasi kontras.
- Splash loading personal dengan nama/inisial profil, warna tema, animasi indikator, dan tombol lewati. Bisa dimatikan di **Warna & Tampilan**, menghormati reduced motion, dan tidak menghalangi HTML ketika JavaScript gagal/nonaktif.
- Logo teknologi lokal pada toolkit dan label teknologi yang dikenali. Istilah umum memakai ikon kategori; logo tidak memerlukan CDN eksternal.
- **FAQ** dengan accordion yang dapat dipakai menggunakan keyboard dan tanpa JavaScript, serta pengelolaan ID/EN di admin.
- **Testimoni** dengan status draft/published dan izin publikasi. Tidak ada testimoni pelanggan buatan dalam data awal.
- Pengaturan **Keamanan**: MFA autentikator dengan QR, kode pemulihan sekali pakai, ganti password, daftar/pencabutan sesi, dan riwayat aktivitas. Proyek draft tidak dikirim ke API/HTML publik.
- Panduan **Google Search Console** di pengaturan SEO: domain dan token dapat diisi sendiri, impor tag HTML, status konfigurasi, tautan verifikasi resmi, serta sitemap. Verifikasi kepemilikan dilakukan di akun Google.
- Integrasi **terjemahan otomatis ID ↔ EN** dengan pratinjau, koreksi, dan penerapan terpisah. Mendukung Google Cloud Translation atau LibreTranslate. Belum aktif sebelum layanan dikonfigurasi; lihat [panduan terjemahan](docs/TERJEMAHAN_OTOMATIS.md).

## Kebutuhan

- Node.js **minimal 20.20**, npm, dan **MySQL 8.0+**. Konfigurasi lokal telah diuji dengan Node.js 20.20.2 dan MySQL 8.4.3 dari Laragon di Windows.
- Jalankan MySQL melalui Laragon, XAMPP, atau instalasi MySQL sendiri. **Shared hosting statis biasa tidak dapat menjalankan admin/database ini**.
- Untuk produksi: reverse proxy Nginx/Apache dengan HTTPS dan `APP_ORIGIN` yang tepat, backup, serta review keamanan sebelum publikasi.

## Menjalankan secara lokal

Aktifkan **MySQL** di Laragon terlebih dahulu. Apache tidak diperlukan karena website dilayani oleh Node.js.

```bash
# 1. Masuk ke folder proyek dan instal dependensi
cd portofolio-pribadi-it-cms
npm install

# 2. Setup database dan akun admin lokal
npm run setup:local
# .env dibuat dari .env.example jika belum ada.
# Bawaan: MySQL 127.0.0.1:3306, user root, password kosong, database portfolio_cms.
# Jika akun MySQL berbeda, sesuaikan .env lalu jalankan setup:local lagi.
# Kredensial admin acak tersimpan di storage/AKSES_LOKAL.txt.

# 3. Jalankan server
npm start
```

Buka **http://127.0.0.1:3000/** untuk publik dan **http://127.0.0.1:3000/admin** untuk masuk. Akun lokal pertama memakai email `admin@localhost.test` dengan password acak; lihat `storage/AKSES_LOKAL.txt`. Setup ulang mempertahankan akun yang sudah ada. File akses berada di luar folder publik dan diabaikan Git.

Untuk mengembangkan dengan server yang otomatis memuat ulang, gunakan `npm run dev`. Untuk membuat admin dengan email pribadi dan password pilihan sendiri:

```bash
npm run db:setup
npm run create-admin -- --email emailanda@example.com
# Password dimasukkan melalui prompt tersembunyi, minimal 15 karakter.
```

`setup:local` hanya berjalan jika server dan database berada di localhost dan `NODE_ENV` bukan `production`. Database bernama `DB_NAME` dibuat jika belum ada; akun MySQL harus memiliki izin membuat database tersebut. Jika database disediakan administrator, aplikasi cukup membutuhkan izin pada database yang dipilih untuk membuat tabel, membaca, dan menyimpan data.

Menjalankan pengujian (MySQL harus aktif):

```bash
npm test
```

Tes membuat database acak `portfolio_cms_test_*`, menguji autentikasi, proteksi CSRF, pembatasan login, konten bilingual, unggahan, dan inbox, lalu menghapus database uji. Konten `portfolio_cms` tidak dipakai untuk tes. Isi `TEST_DB_USER` dan `TEST_DB_PASSWORD` pada `.env` dengan akun lokal yang memiliki izin membuat/menghapus database uji.

Pengujian browser desktop/mobile: `npm run test:browser`. Pada Windows, tes memakai Microsoft Edge yang terpasang. Pada platform lain, pasang Chromium pengujian dengan `npx playwright install chromium`, atau isi `PLAYWRIGHT_BROWSER_PATH`. Hasil tangkapan layar tersedia di `storage/review/`. Tes memakai database terpisah dan tidak mengubah pengaturan website lokal.

## Variabel lingkungan

Aplikasi **otomatis membaca `.env`** di folder proyek. Variabel yang sudah disetel pada terminal/service diutamakan. `.env` tidak boleh disimpan di `public/` atau dimasukkan ke Git.

| Variabel | Contoh | Keterangan |
|---|---|---|
| `HOST` | `127.0.0.1` | Bawaan hanya menerima koneksi lokal |
| `PORT` | `3000` | Port backend |
| `NODE_ENV` | `development` | Untuk HTTP lokal; `production` mengaktifkan cookie Secure dan HSTS, wajib HTTPS |
| `APP_ORIGIN` | kosong | Lokal mengikuti origin request; produksi isi `https://domainanda.id` |
| `TRUST_PROXY` | kosong | X-Forwarded-For diabaikan. Isi `loopback` hanya untuk reverse proxy tepercaya pada komputer yang sama |
| `DB_HOST` | `127.0.0.1` | Host MySQL |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_NAME` | `portfolio_cms` | Nama database, hanya huruf/angka/underscore |
| `DB_USER` | `root` | Akun MySQL lokal; gunakan akun khusus saat produksi |
| `DB_PASSWORD` | kosong | Sesuaikan password akun MySQL |
| `TEST_DB_USER` | `root` | Akun MySQL khusus pengujian; membutuhkan izin CREATE/DROP DATABASE |
| `TEST_DB_PASSWORD` | kosong | Password akun pengujian |
| `ADMIN_PASSWORD` | **jangan ditaruh permanen** | Hanya opsi non-interaktif untuk `create-admin`; lebih aman prompt interaktif |
| `MFA_ENCRYPTION_KEY` | kosong saat lokal | Wajib produksi: 32 byte acak base64. Lokal membuat kunci privat `storage/mfa.key` saat setup MFA; backup kunci tersebut |

Lihat `docs/DEPLOYMENT_VPS.md`.

## Cara menggunakan admin

1. Buka `/admin`, login menggunakan email dan password hasil `create-admin`.
2. Pilih tab konten, misalnya **Proyek Portofolio**.
3. Pilih bahasa **ID** atau **EN**. Edit semua field dan klik **Simpan Perubahan**. Jangan lupa mengedit bahasa lainnya.
4. Untuk gambar, klik **Unggah** pada field foto/screenshot/sertifikat; path akan masuk otomatis ke field. Klik **Simpan Perubahan** setelah mengunggah.
5. Buka **Lihat Website** untuk melihat perubahan publik.
6. Buka **Pesan Masuk** untuk melihat pesan dari formulir publik.
7. Buka **SEO & Mesin Pencari**, atur judul/deskripsi untuk ID dan EN, serta unggah gambar sosial. Biarkan indeks nonaktif selama lokal.
8. Buka **Warna & Tampilan**, pilih palet atau warna sendiri, lalu simpan. Tema yang sudah dipilih pengunjung tetap dihormati.
9. Buka **Keamanan** untuk mengaktifkan MFA dengan autentikator, mengganti password, mencabut sesi lain, dan memeriksa aktivitas. Simpan kode pemulihan. Setelah ganti password, gunakan password baru; file akses awal tidak diperbarui otomatis.
10. Untuk menerjemahkan seluruh konten tersimpan, gunakan **Terjemahkan ID → EN** atau **EN → ID**, periksa hasilnya, lalu terapkan. Nama, URL, kode teknis, dan status publikasi dipertahankan. Tombol belum aktif sampai layanan terjemahan tersedia.
11. Buka **FAQ** untuk menambah atau mengubah pertanyaan/jawaban. Pilih `published` agar tampil, atau `draft` untuk menyimpannya secara privat.
12. Buka **Testimoni**, isi nama dan kutipan asli, lalu tandai izin publikasi jika sudah diterima. Testimoni hanya bisa dipublikasikan setelah izin dilengkapi. Isi kedua bahasa atau gunakan integrasi terjemahan yang sudah dikonfigurasi.

Penggunaan logo, FAQ, dan testimoni: [panduan konten tambahan](docs/FAQ_TESTIMONI_DAN_TECH.md).

Panduan rinci dan batas perlindungan: [Keamanan, SEO, dan tampilan](docs/KEAMANAN_DAN_SEO.md).

Aktivasi autentikator, pemulihan akun, kunci enkripsi, serta verifikasi Google: [MFA dan Search Console](docs/MFA_DAN_SEARCH_CONSOLE.md).

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
│   ├── db.js                         # Pool MySQL, session, content, audit
│   ├── config.js                     # Loader .env dan konfigurasi koneksi
│   ├── schema.sql                    # Skema MySQL/InnoDB dan pengaturan website
│   └── validate.js                   # Validasi input
├── data/seed/id.json                 # Data awal Indonesia
├── data/seed/en.json                 # Data awal English
├── data/seed/ui.json                 # Terjemahan interface bawaan
├── scripts/setup-local.js           # Setup lokal dan akses admin acak
├── scripts/setup-db.js              # Setup database, tabel, dan seed MySQL
├── scripts/create-admin.js          # Admin dengan email/password pilihan sendiri
├── tests/app.test.js                 # Test autentikasi, CRUD, inbox, i18n
└── docs/                             # Spesifikasi, prompt AI, deployment
```

**Perhatian:** Setelah database dibuat, mengubah JSON pada `data/seed` tidak otomatis menimpa data yang sudah disimpan. Ubah konten menggunakan dashboard. Skema database tersedia di `server/schema.sql`. Migrasi kode ini tidak mengimpor berkas SQLite lama; jika memiliki salinan database lama, pertahankan berkasnya dan lakukan impor terpisah.

## Batasan versi ini & rencana pengembangan

Penguatan ini diuji melalui tes otomatis dan browser, tetapi belum merupakan audit penetrasi independen. Belum ada passkey/WebAuthn, pemulihan password melalui email, RBAC multi-user, approval publikasi, antivirus/CDR eksternal, captcha, atau proteksi DDoS pada jaringan. SEO disajikan dari server dan pembatasan login/kontak tersimpan di MySQL. Mode produksi memerlukan APP_ORIGIN HTTPS, akun MySQL khusus dengan password, dan MFA_ENCRYPTION_KEY.

Backend sekarang memakai **Node.js + MySQL**. Dokumen `docs/PROMPT_MIGRASI_LARAVEL_MYSQL.md` adalah opsi pengembangan lanjutan ke Laravel, tidak diperlukan untuk menjalankan versi lokal ini. Untuk melanjutkan Node.js, gunakan `docs/PROMPT_AGENT_CLAUDE_CODEX.md`.

## Pemecahan masalah lokal

- **MySQL tidak dapat dihubungi:** aktifkan MySQL di Laragon, lalu periksa `DB_HOST` dan `DB_PORT`.
- **Akses MySQL ditolak:** sesuaikan `DB_USER` dan `DB_PASSWORD` di `.env`.
- **Database belum tersedia:** jalankan `npm run db:setup`.
- **Port 3000 sedang dipakai:** ubah `PORT` di `.env`, lalu jalankan ulang server.
- **Login gagal di HTTP lokal:** gunakan `NODE_ENV=development`. Untuk memakai `localhost` dan `127.0.0.1`, biarkan `APP_ORIGIN` kosong dan login melalui alamat yang sama.

Dokumentasi pustaka: [MySQL2](https://sidorares.github.io/node-mysql2/docs) dan [MySQL](https://dev.mysql.com/doc/refman/8.4/en/).

## Lisensi/konten

Website ini dibuat untuk penyesuaian portofolio milik pemilik proyek. Pastikan semua logo klien, screenshot, skema jaringan, dan berkas sertifikat telah memperoleh izin publikasi. Hindari mengekspos data pegawai/instansi, IP privat, NIK, token, dan dokumen rahasia.

### Pengaturan tampilan proyek (`visibility`)

Di editor Proyek, pilih **`draft`** (tidak ditampilkan di publik), **`demo`** (contoh studi kasus yang terlihat dengan label demo), atau **`published`** (terlihat di publik). Field `status` adalah teks label yang ditampilkan, bukan otorisasi publikasi. Sebelum mengubah ke `published`, periksa data proyek dan izin publikasinya pada **kedua bahasa**. Ini kontrol visibilitas dasar, belum sistem approval atau jadwal publikasi.
