# Blueprint Portofolio IT Developer — Bilingual CMS

## Tujuan produk

Membangun profil profesional dengan desain visual premium yang memperlihatkan **pengalaman, karya aktual, kemampuan teknis, sertifikasi, dan kanal kontak**. Situs harus **editable via dashboard admin**, bilingual Indonesia–English, responsif, aman, cepat, dan tidak mengubah gaya visual orisinal.

## Target pengguna

- **Pengunjung umum / rekruter / calon klien**: mencari profil dan bukti proyek, memeriksa sertifikasi, menyampaikan permintaan kerja sama.
- **Administrator**: mengelola seluruh konten, melihat pesan masuk, mengunggah media, memublikasikan informasi terverifikasi.
- **Editor (fase pengembangan)**: mengubah draft tanpa akses manajemen akun atau konfigurasi kritis.

## Navigasi situs publik

Beranda → Keahlian/Layanan → Portofolio (filter Web, Mobile, Network, IT Support) → Detail Proyek → Tentang Saya → Pengalaman & Teknologi → Sertifikasi & Bukti → Proses Kerja → Kontak.

### Fitur publik

1. Homepage animasi hero, indikator ketersediaan, CTA proyek, tema gelap/terang.
2. **Bahasa ID/EN** untuk seluruh konten tampak (navigation, hero, studi kasus, modal, CTA, form, SEO). Pilihan tersimpan; URL dapat dibagikan.
3. Proyek: filter, detail tantangan–solusi–peran–hasil, teknologi, periode, screenshot, tautan demo/repo sesuai izin.
4. Pengalaman: instansi/perusahaan jika boleh dipublikasikan, posisi, periode, deskripsi, capaian terukur dengan bukti.
5. Sertifikasi: lembaga (mis. BNSP), skema, tahun, masa berlaku, dokumen/URL validasi; jangan mengklaim sertifikat yang belum diverifikasi.
6. Tech stack: backend, frontend, mobile, networking, server, security, workflow.
7. Contact: form tervalidasi, anti-spam, penyimpanan aman dan pengelolaan pesan.
8. SEO: title dan description per locale, OpenGraph, JSON-LD Person, canonical, hreflang, sitemap, robots, lazy loading gambar.
9. UX: responsive 320px–4K, accessible keyboard navigation, prefers-reduced-motion, performa animasi stabil.

## Navigasi admin

Dashboard → Profil ID/EN → Layanan → Proyek → Pengalaman → Skill/Tech Stack → Sertifikasi → Proses Kerja → Media Library → Inbox Pesan → Pengaturan SEO → Pengguna dan Role → Audit Log.

### Kemampuan admin yang penting

- Login/logout nyata dan session timeouts; password kuat; opsi 2FA.
- CRUD semua bagian konten; field terjemahan ID/EN berdampingan atau tab.
- Tambah, urutkan, arsipkan, jadwalkan, draft/publish, dan preview perubahan.
- Upload gambar PDF terkontrol, penyusunan alt text, ukuran kompresi, galeri multi-bukti.
- Inbox pesan dan notifikasi email; proteksi spam.
- SEO fields bilingual (meta title, description, share image, slug SEO).
- Audit trail, backup/restore, pengelolaan keamanan.

## Implementasi yang tersedia di paket saat ini

**Node.js (built-in HTTP) + SQLite** dengan dua record `content` berisi JSON data locale, serta tabel admin/sesi/media/pesan/audit. Hasil bisa langsung dilihat saat menjalankan `npm start`. Data konten publik diambil dari endpoint backend; bila dibuka statis, konten demo ID/EN tersedia dari `public/js/content.js`.

### Database SQLite saat ini

- `admins(id, email UNIQUE, password_hash, name, role, created_at)`
- `sessions(token_hash PK, admin_id FK, csrf_token, created_at, expires_at)`
- `content(locale PK [id/en], payload JSON-string, updated_at)`
- `login_attempts(lookup_key PK, tries, first_at, blocked_until)`
- `messages(id, name, email, topic, message, locale, status, created_at)`
- `media(id, filename, original_name, content_type, size_bytes, created_at)`
- `audit_log(id, admin_id, operation, detail, created_at)`

### Rancangan database untuk versi Laravel + MySQL (fase migrasi)

Agar query, revisi, dan terjemahan lebih rapi, migrasi ke model normalisasi:

```text
users (id, name, email, password, is_active, last_login_at, timestamps)
roles / permissions (Spatie Permission — opsional multi-admin)
site_settings (id, key unique, value JSON, timestamps)
profiles (id, avatar_media_id?, cv_media_id?, email, phone?, github?, linkedin?, ...)
profile_translations (id, profile_id, locale, headline, hero_title, hero_subtitle, bio, about_quote, availability_text)
services (id, icon, accent, position, is_published, timestamps)
service_translations (id, service_id, locale, title, description, category_label)
projects (id, slug unique, category, status, position, year, published_at, cover_media_id?, timestamps, deleted_at)
project_translations (id, project_id, locale, title, subtitle, challenge, solution, role, result, meta_title?, meta_description?)
project_technologies (project_id, technology_id)
project_media (project_id, media_id, caption?, sort_order)
experiences (id, organization?, role?, start_date?, end_date?, is_current, sort_order, visibility, timestamps)
experience_translations (id, experience_id, locale, title, description, achievements JSON)
technologies (id, name, slug unique, category, icon?, sort_order)
certifications (id, issuer, credential_id?, issued_on?, expires_on?, media_id?, verify_url?, position, is_published)
certification_translations (id, certification_id, locale, title, description)
workflow_steps (id, position)
workflow_step_translations (id, workflow_step_id, locale, title, description)
media (id, disk, path, mime, size, width?, height?, alt_text_id?, alt_text_en?, visibility, timestamps)
contact_messages (id, name, email, subject, message, locale, status, created_at)
audit_logs (id, user_id, action, entity_type, entity_id, before JSON?, after JSON?, created_at)
seo_pages (id, route, locale, title, description, og_image_id?, robots?, canonical?, unique(route,locale))
```

Setiap tabel `*_translations` harus UNIQUE pada `(entity_id, locale)`. Field `status/published_at/is_published` mencegah placeholder tersaji sebagai portofolio hasil nyata. Gunakan tabel atau enum status yang tervalidasi.

## Alur utama

**Admin mempublikasikan proyek:** login → Proyek → Tambah → Isi ID dan EN → Upload gambar → Masukkan peran/teknologi/hasil asli → Preview → Publish → Halaman publik otomatis memperbarui galeri dan detail → Admin bisa arsipkan.

**Pengunjung menghubungi:** buka form → validasi + anti-spam → simpan pesan secara aman → status unread di admin → admin memproses dan menandai read → hapus setelah retensi data yang disepakati.

**Admin sertifikasi BNSP:** unggah dokumen yang boleh ditampilkan → isi lembaga, skema, nomor publik (jika pantas), tanggal, URL verifikasi → preview → publish. Pastikan data pribadi yang tidak perlu ditampilkan telah ditutup.

## UI & animasi

- **Pertahankan identitas desain**: latar gelap teknikal, aksen hijau-lime, kartu project dengan ilustrasi, terminal/editor hero, aura/glow, typography modern.
- Motion: entrance stagger, scroll reveal, hover tilt ringan, pointer glow, animated grids, page transitions, filtering transitions, smooth modal. Perhatikan reduced-motion dan kinerja mobile.
- Jangan memakai animasi masif yang memblokir input, menguras baterai, atau menurunkan Core Web Vitals.
- Dashboard admin premium, terstruktur, cepat untuk update konten, dan nyaman di layar tablet/HP.

## Definisi selesai

Pengunjung bisa beralih dua bahasa tanpa konten campur; admin dapat login dan melakukan CRUD dari database; foto, sertifikat, dan karya nyata muncul pada halaman publik; pesan masuk tersimpan; keamanan route diuji; responsif; metadata SEO per bahasa; tests lolos; panduan VPS/cPanel tersedia; semua placeholder diberi penanda yang jujur.
