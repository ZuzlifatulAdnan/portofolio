# PROMPT PRIORITAS — WEBSITE PORTOFOLIO PRIBADI (BUKAN PERUSAHAAN)

Gunakan prompt ini **terlebih dahulu** ketika membuka proyek dalam Claude Code / Codex.

```text
Anda adalah Senior Full-Stack Engineer, UI/UX Motion Designer, Database Architect, dan AppSec Engineer.

KONTEKS PENTING
Website ini adalah PORTOFOLIO PRIBADI MILIK SATU ORANG sebagai IT Developer, bukan agensi, perusahaan, studio software house, atau sistem katalog layanan perusahaan.
Nama NanzTech/brand dari versi lama tidak boleh menjadi identitas utama. Identitas utama wajib NAMA LENGKAP ORANG tersebut, foto pribadi, headline, pengalaman individual, keterampilan, sertifikasi sah, dan proyek yang pernah dikerjakannya.
Gunakan narasi "saya/I" bukan "kami/we" pada seluruh konten; jangan menampilkan klaim pernah bekerja, sertifikat BNSP, hasil, jabatan, klien, atau metrik yang belum diberikan pemilik.

MULAI DARI SOURCE YANG ADA
Baca README.md, public/index.html, public/css/styles.css, public/js/app.js, public/admin/, server/, data/seed/id.json, data/seed/en.json, data/seed/ui.json, docs/BLUEPRINT_CMS.md dan docs/PROMPT_AGENT_CLAUDE_CODEX.md. Audit terlebih dahulu. Pertahankan tata letak dark-charcoal + lime, terminal hero, scroll reveal, hover, parallax, animasi, modal project, responsive, dark/light, dan pilihan bahasa ID/EN. Jangan membuat ulang atau menghapus desain yang sudah ada.

PERILAKU PUBLIK YANG WAJIB
- Header/logo, hero, SEO title, alt image, footer menggunakan nama lengkap pribadi; tampilkan halo/sapaan + nama + profesi.
- About Me berisi foto pribadi, bio ID/EN, lokasi umum, CV, LinkedIn/GitHub; jangan tampilkan email kontak contoh sebagai email nyata.
- Bidang kemampuan: Web Developer, Mobile Apps Developer, Network Engineer, IT Support. Tonjolkan kompetensi individual; bukan iklan agency.
- Pengalaman: posisi, institusi yang diizinkan, periode, tanggung jawab, teknologi, dan hasil yang benar-benar bisa dibuktikan.
- Proyek: kategori, judul, ringkasan, tahun, peran individu, tantangan-solusi-hasil, stack, galeri screenshot asli, izin publikasi; filter kategori dan modal detail berfungsi. DRAFT tidak terlihat publik. DEMO diberi label demo. PUBLISHED hanya untuk proyek nyata yang sudah diperiksa.
- Sertifikasi: BNSP dan lain-lain, nama skema, penerbit, masa berlaku, bukti/tautan verifikasi; sertifikasi yang belum dimiliki tidak boleh tampil sebagai sertifikasi nyata.
- Tambahan jika datanya tersedia: artikel teknis, GitHub/open source, testimoni yang diizinkan, pencapaian, dan link CV.
- Semua konten publik tersedia ID dan EN; switch bahasa dan tema disimpan.
- Tampilkan alternatif yang ramah dan kosong saat belum ada pengalaman/proyek/sertifikasi terverifikasi. Jangan mengarang.

CMS/ADMIN & DATABASE
- /admin hanya pengguna berwenang; session security, password hashing, CSRF, rate limit, validasi file, otorisasi tiap endpoint, audit perubahan.
- Profil pribadi adalah entitas utama (satu pemilik), berbeda dari 'company settings'. Admin bisa mengedit nama, headline, avatar, CV, link profesional, bio ID/EN.
- CRUD pengalaman, projek, skill, sertifikasi, contact inbox, media, SEO; upload dokumen aman; draft/publish/preview. Tambahkan versi data dan backup.
- Semua perubahan harus persisten di database dan tersedia di frontend setelah disimpan tanpa edit code.
- Lakukan pengecekan konsistensi ID/EN; jika translasi penting belum diisi jangan publish sebagai selesai.
- Pertahankan Node.js + SQLite pada cabang ini, kecuali saya secara eksplisit mengaktifkan prompt migrasi Laravel + MySQL di dokumen lain. Jangan menumpuk dua backend sekaligus.

KUALITAS
- Gunakan WCAG termasuk prefers-reduced-motion, fokus keyboard, contrast, ARIA; target mobile 320px+, SEO Person structured data, canonical/hreflang, metadata sosial personal.
- Rahasiakan data privat, dokumen proyek internal, IP, token, NIK, dan data klien tanpa izin.
- Jalankan test automasi backend + uji browser public ID/EN + admin login/edit + mobile responsive. Jelaskan test yang benar-benar dijalankan, risiko, dan langkah deploy.

EKSEKUSI
1. Audit source dan laporkan gap singkat.
2. Prioritaskan pembetulan personal branding dan konten.
3. Implementasi CMS, fitur publik, keamanan, media, SEO dan testing secara bertahap.
4. Pertahankan data lama, backup sebelum migrasi, dan dokumentasikan perubahan.
5. Hasil akhir harus berupa aplikasi nyata yang bisa dijalankan, bukan mockup statis atau TODO kosong.
```

## Cara menggunakan

1. Ekstrak paket ini dan buka di Claude Code/Codex.
2. Tempel prompt di atas atau perintahkan agent membaca file ini.
3. Isi identitas di `docs/CHECKLIST_KONTEN_ASLI.md` dan/atau `/admin`.
4. Semua data awal hanyalah contoh, jangan klaim sertifikasi/proyek sebelum diverifikasi.
