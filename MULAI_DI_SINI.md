# START HERE — PORTOFOLIO PRIBADI IT DEVELOPER

Website ini adalah **profil seorang profesional IT**, bukan NanzTech software house. Nama, foto, pengalaman, proyek, sertifikat, dan kontak milik orang tersebut merupakan konten utama.

- Source code admin CMS + bilingual: folder `public`, `server`, `data/seed`.
- Panduan penggunaan: `README.md`.
- Prompt **untuk Claude Code / Codex**: `docs/PROMPT_KHUSUS_PORTOFOLIO_PRIBADI_CLAUDE_CODEX.md`.
- Backend saat ini: **Node.js + MySQL**, konfigurasi lokal dalam `.env`.
- Opsi lanjutan Laravel: `docs/PROMPT_MIGRASI_LARAVEL_MYSQL.md`.
- Form pengisian biodata: `docs/CHECKLIST_KONTEN_ASLI.md`.

## Perintah mulai

```bash
node --version            # minimum 20.20
npm install
# Aktifkan MySQL di Laragon, lalu:
npm run setup:local
npm start
```

Website: `http://127.0.0.1:3000` · Admin: `http://127.0.0.1:3000/admin`

Email admin lokal: `admin@localhost.test`. Password acak tersedia di **`storage/AKSES_LOKAL.txt`**. Setup ulang mempertahankan akun dan konten yang sudah tersedia.

Jika MySQL memiliki password atau port khusus, ubah `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD` di `.env`, lalu ulangi setup. Untuk admin dengan email sendiri: `npm run create-admin -- --email emailpemilik@domain.com`.

**JANGAN PUBLIKASIKAN SEBELUM MENGGANTI:** `Nama Lengkap Anda` / `Your Full Name`, email contoh, biodata contoh, kartu proyek demo, pengalaman contoh, dan sertifikasi placeholder. Setelah database MySQL telah diinisialisasi, data seed tidak otomatis ditimpa; gunakan `/admin` untuk mengedit.

Untuk proyek nyata, isi **peran pribadi**, bukan mengklaim hasil seluruh tim sebagai karya individu. Jangan mempublikasikan informasi rahasia dari instansi/klien.
