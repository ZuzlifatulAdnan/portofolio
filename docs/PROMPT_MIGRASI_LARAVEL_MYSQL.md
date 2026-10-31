> **INSTRUKSI UTAMA:** Produk ini merupakan PORTOFOLIO PRIBADI SATU ORANG, bukan website perusahaan/software house/agency. Identitas utama adalah nama lengkap pemilik, bukan nama brand. Jangan mengarang pencapaian atau sertifikasi. Ikuti `docs/PROMPT_KHUSUS_PORTOFOLIO_PRIBADI_CLAUDE_CODEX.md` sebagai prioritas.

# PROMPT ALTERNATIF — Migrasi Ke Laravel + MySQL (Untuk VPS / cPanel)

> Pilih opsi ini bila ingin backend Laravel/PHP yang lebih mudah diintegrasikan dengan infrastruktur MySQL dan pola deployment existing. **Jangan jalankan prompt Node dan Laravel sekaligus pada satu branch**. Backup folder dan database starter sebelum migrasi. Hasil akhir wajib satu codebase yang konsisten.

```text
Anda adalah Senior Laravel Full-Stack Architect, AppSec Engineer, DBA, dan UI Motion Designer. Saya memiliki source Portfolio Pribadi IT CMS di repository yang sedang dibuka. Backend saat ini sudah Node.js + MySQL. Migrasikan framework backend ke Laravel + MySQL/MariaDB hanya jika prompt ini secara eksplisit diaktifkan, dengan tetap mempertahankan data, HTML/CSS/JS frontend dan semua animasi/tampilan Personal Portfolio yang sudah ada.

SOURCE OF TRUTH
- Baca README.md, docs/BLUEPRINT_CMS.md, data/seed/id.json, data/seed/en.json, data/seed/ui.json, public/index.html, public/css/styles.css, public/js/app.js, public/admin/* dan server/*.
- Jangan memulai desain dari nol. Source ini adalah referensi visual utama.
- Gunakan versi Laravel stable yang kompatibel dengan PHP & host saat implementasi (cek versi sebelum install). Gunakan MySQL/MariaDB, Laravel migrations/seeders, Eloquent, Form Requests, Policies, Gates, Services bila diperlukan, dan Blade + Alpine.js untuk frontend/admin. Tailwind CSS opsional bila tidak merusak CSS original.
- Auth wajib menggunakan sistem Laravel yang diaudit/dipelihara, bukan menciptakan cookie/session framework custom. Role editor/admin gunakan Spatie Laravel Permission jika lebih dari satu role dibutuhkan.

BANGUN FITUR
1. PUBLIC: route /id dan /en, language switch persistent, seluruh konten terjemahan, homepage premium animatif, keahlian, filter dan detail proyek dengan galeri media, pengalaman timeline, tech stack, BNSP certification + verified link, contact form, CV, dark/light mode.
2. ADMIN: route /admin hanya untuk user berhak; login/logout/forgot password (kalau mail aktif), dashboard analytics, CRUD & ordering profil/layanan/proyek/pengalaman/skill/sertifikasi/steps/media/SEO, inbox pesan, audit trail, settings.
3. CONTENT: entitas dan tabel translation terpisah per bahasa (lihat schema di docs/BLUEPRINT_CMS.md); unique entity_id+locale, slug unik, published_at, draft/published, soft delete opsional, preview sebelum publish, media per proyek. Perubahan admin harus langsung tersimpan ke MySQL dan tampil pada frontend.
4. MEDIA: Laravel Storage public disk sesuai kebijakan, `storage:link`, validasi MIME berbasis isi, size whitelist, tidak izinkan SVG/HTML/script upload, PDF sebagai attachment, foto optimize, alt text multilingual, cleanup aman.
5. SECURITY: Laravel auth, session regenerate, CSRF, password hashing, throttling, form request validation, route middleware, server-side authorization Policies, secure cookies HTTPS, rate limit kontak, honeypot, audit logs, sanitasi output, XSS/SQLi/IDOR protections, secure .env, no exposed data.
6. SEO: SSR Blade, meta title/description ID/EN, og:image, canonical, hreflang, localized sitemap, robots.txt, JSON-LD Person, noindex pada /admin.
7. DEPLOY: dapat berjalan di VPS Ubuntu/Nginx/PHP-FPM maupun cPanel PHP yang memenuhi requirement Laravel, document root wajib ke `public/` atau symlink aman, bukan menaruh file aplikasi di public_html. Sertakan composer install, npm build jika dipakai, migration, storage, queue/cron jika relevan, cache config/route/view, health check, backup/rollback.

MIGRASI DATA
- Buat migration dan seeder yang mengimpor data contoh dari kedua JSON seed sebagai DRAFT / demo, bukan klaim hasil pekerjaan nyata.
- Jangan menghapus proyek, sertifikat, atau konten user tanpa migrasi yang aman.
- Siapkan command Artisan satu kali untuk mengimpor JSON SQLite lama jika database telah dipakai, dengan dry-run, validasi, dan backup terlebih dahulu.
- Jangan membuat akun admin dengan password hard-coded. Buat command Artisan untuk setup user admin pertama dengan prompt dan password hashing.

DESAIN VISUAL (WAJIB DIPERTAHANKAN)
- Gunakan palet dark charcoal + accent lime, hero editor/terminal, card karya, partikel, scroll reveal, parallax, ticker, animations and reduced motion.
- Jangan mengganti ke panel template generik atau menghapus animasi. Dashboard admin harus premium, bersih, dan nyaman untuk mengelola konten.
- Responsive 320px hingga desktop besar, keyboard accessible, Core Web Vitals yang baik.

TESTING
- Feature tests: login/logout, admin-only routes, unauthorized CRUD, CSRF, permissions, CRUD bilingual, missing EN blocks publishing, upload spoofing, contact anti-spam, published vs draft visibility, media ownership, safe redirect, SEO routes.
- Browser test ID/EN, filter modal, responsive mobile, theme persistence, animated elements, and admin edit-to-public flow.
- Jalankan `php artisan test`, database migrations, build frontend bila dipakai. Perbaiki kesalahan sampai lolos.

ATURAN AGENT
- Mulai dengan audit struktur dan rencana perubahan ringkas, lalu langsung coding.
- Jangan membangun aplikasi Laravel baru di dalam `public/` atau mengubah root live tanpa rencana deployment.
- Buat commit/milestone logis; hindari membaca ulang file besar. Jangan membuat fitur palsu atau mengklaim tes yang tidak dijalankan.
- Output akhir: source Laravel siap deploy, ERD/migrations, README perintah setup lokal, panduan deploy VPS/cPanel, daftar fitur, status testing, dan batasan yang masih ada.

Sekarang audit repo, tentukan struktur Laravel yang aman, migrasikan desain dan konten yang sudah ada, implementasikan semua fitur utama, dan pastikan proyek dapat dijalankan secara nyata.
```
