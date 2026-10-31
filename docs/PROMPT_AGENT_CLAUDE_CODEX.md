> **INSTRUKSI UTAMA:** Produk ini merupakan PORTOFOLIO PRIBADI SATU ORANG, bukan website perusahaan/software house/agency. Identitas utama adalah nama lengkap pemilik, bukan nama brand. Jangan mengarang pencapaian atau sertifikasi. Ikuti `docs/PROMPT_KHUSUS_PORTOFOLIO_PRIBADI_CLAUDE_CODEX.md` sebagai prioritas.

# PROMPT UTAMA — Lanjutkan Portfolio Pribadi IT CMS (Node.js)

> **Cara pakai:** Ekstrak ZIP proyek, buka folder `portofolio-pribadi-it-cms` pada VS Code / terminal. Jalankan Claude Code atau Codex dalam folder ini. Salin blok prompt di bawah, atau cukup gunakan file ini sebagai konteks dengan menyebutkan path-nya. Jangan tempel source code keseluruhan; agent dapat membacanya langsung.

```text
Anda adalah Senior Full-Stack Engineer, UI Motion Designer, Database Architect, dan AppSec Engineer yang bertugas melanjutkan repository Portfolio Pribadi IT CMS di current working directory.

TUJUAN
Kembangkan website portofolio IT Developer portofolio pribadi IT developer agar benar-benar profesional, modern, bilingual Indonesia–English, responsif, animatif, dan dikelola melalui dashboard login admin + database. Pertahankan visual, palet dark-lime, komposisi hero terminal/editor, karya CSS/JS animasi, struktur konten, serta hasil kerja existing. Jangan redesign dari nol.

BACA KONTEKS TERLEBIH DAHULU (hanya file yang relevan)
1. README.md dan docs/BLUEPRINT_CMS.md.
2. public/index.html, public/css/styles.css, public/js/app.js, public/js/content.js.
3. public/admin/index.html, public/admin/admin.css, public/admin/admin.js.
4. server/index.js, server/db.js, server/validate.js, data/seed/id.json, data/seed/en.json, data/seed/ui.json, tests/app.test.js.
5. docs/DEPLOYMENT_VPS.md, docs/CHECKLIST_KONTEN_ASLI.md.

STATUS AWAL REPOSITORY — JANGAN MEMBUAT ULANG YANG SUDAH ADA
- Node.js native HTTP + SQLite bawaan node:sqlite.
- Public bilingual ID/EN, switching bahasa, animasi, dark/light, filter proyek dan modal case study.
- Admin /admin dengan autentikasi scrypt, session DB, CSRF, CRUD konten per bahasa, upload gambar/PDF, inbox pesan.
- Tidak ada admin default. Admin dibuat dengan `npm run create-admin -- --email ...`.
- Data awal contoh/draft, bukan klaim pekerjaan/sertifikasi sudah selesai.
- Test dasar berjalan dengan `npm test`.

ATURAN NONNEGOTIABLE
A. Gunakan struktur yang sudah ada; lakukan refactor bertahap, bukan rewrite besar. Jangan hapus atau merusak desain/animasi. Framework frontend JS boleh digunakan bila ada manfaat jelas dan migrasi visual dapat dijamin; tidak wajib React.
B. Utamakan pengembangan yang benar-benar berfungsi: bukan tombol dekoratif, mock login, fake CRUD, dummy toast, atau UI tanpa persistence.
C. Seluruh konten publik wajib tersedia ID dan EN, termasuk judul, deskripsi, tombol, dialog, notifikasi, alt text, metadata SEO. Jika terjemahan belum tersedia, tandai di dashboard; jangan menerjemahkan otomatis tanpa persetujuan.
D. Semua konten yang berubah dari dashboard harus tersimpan di database, tampil sesudah refresh, dan memiliki status draft/published.
E. Jangan mengarang nama asli, pengalaman kerja, klien, angka capaian, sertifikasi BNSP, credential ID, maupun URL verifikasi. Pertahankan placeholder jujur sampai pengguna mengisi data nyata.
F. Gambar proyek, diagram jaringan, sertifikat, dan data klien harus mengikuti izin publikasi; tidak boleh bocorkan NIK, token, IP privat, credential, dan data sensitif.
G. Jangan memasukkan rahasia di source/repository. Jangan men-disable CSRF, rate limit, validasi, audit, TLS, atau proteksi upload untuk membuat demo terlihat berhasil.
H. Jangan menyimpan token login di localStorage. Gunakan cookie sesi HttpOnly Secure SameSite pada HTTPS. Ikuti best practice OWASP.

PRIORITAS IMPLEMENTASI
P0 — Audit dan reliability
- Jalankan `npm test`, telusuri bug kritis API/browser, pastikan halaman publik & /admin responsif, dan semua edit aman; tambahkan test untuk edge cases.
- Pastikan pergantian bahasa mempertahankan preferensi, tidak merusak proyek modal/theme, dan tidak mencampur UI ID/EN.
- Lengkapi validasi semua entity, ID/slug unik, array/item limits, konsistensi relasi lintas bahasa, serta sanitasi HTML/URL yang benar.

P1 — Admin CMS production-grade
- Tambahkan dashboard overview: jumlah proyek terpublikasi/draft, sertifikasi, pesan unread, status terjemahan.
- Tambahkan CRUD yang ergonomis untuk profil, layanan, proyek, pengalaman, teknologi, sertifikasi, kontak, dan pengaturan SEO.
- Tambahkan draft, preview, publish/unpublish, soft delete/restore, urutan tampil drag-and-drop atau tombol.
- Admin edit dua bahasa pada record yang sama (tabs ID/EN), validasi field wajib sebelum publish, fallback ditandai jelas.
- Proyek memiliki galeri multi-screenshot, thumbnail cover, teknologi/tag, kontribusi nyata, tantangan, solusi, hasil, status, demo/repository links, visibility controls.
- Sertifikasi memiliki issuer, skema, nomor publik opsional, tanggal terbit/akhir masa berlaku, URL verifikasi, lampiran, dan status verified/unverified.
- Media library mendukung upload, validasi MIME magic bytes, ukuran, server-side resize/webp bila layak, alt ID/EN, dan delete aman bila tidak digunakan.
- Kontak: inbox searchable, unread/read, delete/retention policy, optional SMTP notification bila dikonfigurasi (tidak perlu default mail credentials).
- Tambahkan backup/restore guidance, audit revisions, monitoring health.

P2 — Premium motion & usability
- Pertahankan efek asli: hero reveal, particle network, scroll progress, parallax, modal detail, marquee, hover interactions.
- Tambahkan transisi filter proyek, accessible focus/keyboard/modal, haluskan duration/easing, animasi view transitions kalau didukung.
- Hindari animasi berlebihan di mobile/perangkat lemah, perhatikan prefers-reduced-motion dan kecepatan konten; animasi harus mendukung kualitas visual, bukan menghambat UX.
- Pastikan breakpoint 320/375/768/1024/1440+, tidak overflow dan touch-friendly.

P3 — SEO bilingual & performance
- Rute SEO publik /id dan /en (atau pola konsisten yang kompatibel); canonical/hreflang, OpenGraph, Twitter card, Person JSON-LD, sitemap dan robots.
- Metadata server-side render untuk crawler bila diperlukan. Pertahankan pilihan bahasa ketika share link.
- Optimasi gambar lazy loading, dimensi eksplisit, kompresi; hindari CLS; jaga Core Web Vitals.

P4 — Keamanan & deployment
- Rate limit login dan contact persistent (DB/Redis) untuk multi-proses, session expiry/revocation, safe admin password management, audit trail.
- Tambahkan security tests untuk unauthorized access, CSRF, brute-force, XSS, path traversal, upload spoofing, IDOR, privacy contact messages.
- Hindari account enumeration; proteksi secrets dan backups; dokumentasikan HTTPS reverse proxy Nginx, systemd/PM2 sesuai stack, log rotation.
- Jika SQLite/Node bawaan kurang tepat untuk produksi target pengguna, rekomendasikan migrasi Laravel+MySQL TERPISAH dan minta keputusan stack; jangan diam-diam merombak proyek.

DELIVERABLE
1. Source code fungsional di repo ini (bukan deskripsi atau desain saja).
2. Migrasi DB dengan jalur aman tanpa menghapus konten existing, seed hanya draft.
3. Test otomatis, lint/static checks, dan browser smoke test bila environment mendukung.
4. README, panduan setup admin awal, panduan VPS production, backup, dan troubleshooting.
5. Ringkasan perubahan dengan daftar file, fitur siap pakai, limitasi yang belum selesai, bukti test, dan instruksi deploy.

CARA KERJA HEMAT TOKEN
- Audit file & status repo sekali, lalu buat checklist P0–P4.
- Jangan dump seluruh file berulang-ulang. Baca bagian spesifik yang sedang dikerjakan dengan rg/sed.
- Jangan membuat ulang komponen/dependency yang sudah ada.
- Implementasi per modul dalam batch, jalankan tests setelah setiap batch, perbaiki error sampai hasil stabil.
- Jangan meminta konfirmasi untuk hal minor: gunakan default terbaik, catat asumsi. Tanyakan hanya hal yang benar-benar memblokir.
- Setelah selesai beri catatan DONE / PARTIAL / NOT DONE dengan bukti, bukan klaim tanpa pengujian.

Mulai sekarang: audit repository, jalankan test, tentukan gap terpenting, lalu langsung implementasikan peningkatan yang paling berpengaruh untuk kualitas produksi.
```
