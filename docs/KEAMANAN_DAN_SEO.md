# Pengaturan keamanan, SEO, dan tampilan

Versi ini tetap berjalan secara lokal dengan Node.js dan MySQL. Pengaturan baru disimpan di `site_settings`. Konten profil yang sudah ada dipertahankan. Sebelum perubahan, database lokal dicadangkan di `storage/portfolio-before-security.sql`; berkas tersebut privat dan diabaikan Git.

## SEO & Mesin Pencari

Masuk ke `/admin`, pilih **SEO & Mesin Pencari**. Isi judul halaman, deskripsi, gambar sosial PNG/JPG/WebP, dan deskripsi gambar untuk masing-masing bahasa ID dan EN. Judul kosong memakai nama profil; deskripsi kosong memakai deskripsi hero. Token Google Search Console diisi dengan nilai `content`, tanpa tag HTML.

URL utama adalah origin seperti `https://namaanda.id`, tanpa subfolder atau parameter. Biarkan kosong untuk lokal. Aktifkan **Izinkan mesin pencari mengindeks website** setelah domain HTTPS dan konten asli siap. Mode lokal mulai dengan `noindex` dan `robots.txt` yang melarang crawling. Menyimpan pengaturan tidak memublikasikan website atau mendaftarkannya ke Google.

Server menghasilkan metadata HTML, Open Graph, Twitter card, canonical, alternate/hreflang ID/EN/x-default, dan data terstruktur `Person`. Konten profil dan koleksi juga tersedia sebelum JavaScript berjalan. URL canonical memakai domain tersimpan, sehingga tidak mengikuti Host header dari pengunjung. `/sitemap.xml` hanya memuat URL publik saat indeks diaktifkan. `/admin`, API, dan health diberi header `noindex`.

Pendekatan HTML dari server mengurangi ketergantungan pada rendering JavaScript. Rujukan: [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) dan [versi bahasa/hreflang](https://developers.google.com/search/docs/specialty/international/localized-versions). Metadata dan sitemap membantu mesin pencari memahami halaman; tidak menjamin peringkat atau waktu indeks.

## Warna & Tampilan

Pilih **Warna & Tampilan**. Tersedia palet Lime, Ocean, Blue, dan Amber, serta warna aksen/sekunder terpisah untuk tema gelap dan terang. Pratinjau memperlihatkan perubahan sebelum disimpan. Backend memvalidasi format warna dan kontras aksen minimal 4.5:1 terhadap latar tema; warna sekunder minimal 3:1.

Tema awal dapat berupa gelap, terang, atau mengikuti perangkat. Pengunjung yang sudah memilih tema tetap memakai preferensi browser mereka. Font tersedia dalam gaya sans serif, serif, atau monospace. Sudut kartu/tombol dan animasi bisa diubah. Preferensi perangkat `prefers-reduced-motion` tetap dihormati. Aplikasi menghasilkan CSS dari nilai yang diizinkan; tidak menyediakan input JavaScript/CSS mentah.

Pilihan **Tampilkan splash loading** mengaktifkan intro pada kunjungan halaman publik. Nama dan inisial mengikuti profil; warna mengikuti tema tersimpan. Intro menunggu aplikasi siap, dengan tampilan singkat sekitar 700 ms lalu memudar. Tombol **Langsung masuk / Skip intro** atau Escape dapat melewatinya. Batas maksimum 3 detik mencegah intro menahan halaman jika skrip utama gagal. Intro dilewati saat JavaScript nonaktif, animasi website dimatikan, perangkat meminta reduced motion, atau tautan langsung membuka detail proyek. Tidak ada persentase loading buatan dan tidak perlu menunggu gambar di bawah halaman.

## Keamanan akun dan permintaan

- Password baru minimal 15 karakter, disimpan dengan scrypt asinkron (`N=32768`, `r=8`, `p=3`). Hash lama tetap dapat diverifikasi dan ditingkatkan setelah login berhasil.
- Login dibatasi per akun (8/15 menit) dan IP (30/15 menit). Kontak dibatasi per IP dan email (8/jam). Batas disimpan di MySQL, sehingga restart server tidak meresetnya. Respons 429 menyertakan `Retry-After`.
- Alamat IP diambil dari socket. Header `X-Forwarded-For` diabaikan, kecuali `TRUST_PROXY=loopback` dan koneksi berasal dari reverse proxy lokal tepercaya.
- Sesi berlaku maksimal 12 jam dengan batas tidak aktif 30 menit. Cookie memakai HttpOnly, SameSite=Strict, dan Secure dengan awalan `__Host-` pada mode produksi.
- Semua mutasi admin memerlukan sesi, peran admin, token CSRF, dan origin yang sesuai. Permintaan JSON dibatasi ukuran dan bentuknya. Host yang tidak diizinkan ditolak untuk mengurangi risiko DNS rebinding dan manipulasi origin.
- Ganti password memerlukan password saat ini dan mencabut semua sesi. Pencabutan sesi lain mempertahankan sesi yang sedang dipakai. Riwayat aktivitas hanya menampilkan aktivitas akun tersebut, tanpa password atau token sesi.
- Data proyek berstatus `draft` dihapus dari respons publik dan bootstrap HTML, bukan hanya disembunyikan lewat CSS/JavaScript.
- FAQ draft serta testimoni draft/tanpa izin publikasi juga tidak dikirim ke publik. Publikasi testimoni memerlukan nama, kutipan, dan penandaan izin yang lengkap.
- Query memakai parameter. URL, path media, struktur konten, warna, serta pengaturan diperiksa di backend. Data admin di-escape saat dimasukkan ke HTML/JSON. Berkas privat dan target symlink di luar folder publik tidak disajikan.
- Header CSP, anti framing, nosniff, kebijakan referer/origin, batas header, timeout, dan batas permintaan per koneksi diterapkan. Kesalahan server publik tidak memuat SQL atau konfigurasi internal.

Pola autentikasi mengikuti panduan [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). `Keamanan` di admin menampilkan sesi aktif, perubahan password, pencabutan sesi lain, dan 100 aktivitas akun terbaru.

MFA TOTP dapat diaktifkan melalui QR dan konfirmasi kode dari perangkat pemilik. Secret terenkripsi AES-256-GCM, kode pemulihan hanya tersimpan sebagai hash dan berlaku sekali, tantangan login dibatasi, dan kode yang sudah dipakai ditolak. Password saja tidak membuat sesi penuh ketika MFA aktif. Perubahan MFA mencabut sesi lain; ganti password memerlukan faktor kedua dan mencabut seluruh sesi. Lihat [MFA dan Search Console](MFA_DAN_SEARCH_CONSOLE.md) untuk aktivasi, backup kunci, pemulihan akun, dan verifikasi Google.

## Unggahan

Gambar harus benar-benar dapat didekode sebagai PNG/JPEG/WebP, maksimal 5 MB dan 25 juta piksel. Server menulis ulang gambar untuk membuang metadata dan data tambahan, serta menolak gambar animasi/multi halaman. Nama penyimpanan berupa UUID, bukan nama berkas pengguna.

PDF maksimal 7 MB/100 halaman, harus dapat diparse, tidak terenkripsi, dan tidak memiliki fitur aktif umum seperti JavaScript, OpenAction, action otomatis, formulir, atau berkas tertanam. PDF disajikan sebagai unduhan dengan CSP sandbox dan noindex. Ini pemeriksaan aplikasi, belum pemindaian antivirus atau CDR eksternal. Rujukan: [OWASP File Upload](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Pengujian

```bash
npm test
npm run test:browser
```

Tes memakai database acak `portfolio_cms_test_*` yang dibersihkan setelah selesai. Cakupannya antara lain kebocoran draft, escaping SEO, CSRF/origin, Host palsu, tipe JSON, pembatasan yang bertahan setelah restart, sesi/password, unggahan gambar palsu/PDF aktif, dan pengaturan yang tersimpan. Tes browser memeriksa penyimpanan SEO/palet/password, metadata setelah JavaScript berjalan, HTML tanpa JavaScript, lebar ponsel 375px, dan kesalahan JavaScript. Tangkapan layar disimpan di `storage/review/`.

## Sebelum publikasi berikutnya

Mode produksi memerlukan `NODE_ENV=production`, `APP_ORIGIN` HTTPS, `MFA_ENCRYPTION_KEY` 32 byte base64, serta `DB_USER` khusus dengan `DB_PASSWORD` terisi; root ditolak. Siapkan database dengan izin yang hanya berlaku pada database portofolio dan jalankan migrasi menggunakan akun yang sesuai. Server tetap perlu reverse proxy HTTPS, runtime yang masih didukung, pembaruan dependensi, backup MySQL/media/kunci MFA, dan pembatasan jaringan. Lihat `DEPLOYMENT_VPS.md`.

Penguatan ini belum mencakup pentest independen, passkey/WebAuthn, antivirus, pemulihan password email, atau proteksi DDoS jaringan. TOTP belum tahan phishing. Akun lokal Laragon tetap dipakai selama pengembangan. File `storage/AKSES_LOKAL.txt` berisi akses awal; sesudah password diubah dari admin, file itu tidak mencerminkan password baru.
