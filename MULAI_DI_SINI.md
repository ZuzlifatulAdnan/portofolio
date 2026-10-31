# START HERE — PORTOFOLIO PRIBADI IT DEVELOPER

Website ini adalah **profil seorang profesional IT**, bukan NanzTech software house. Nama, foto, pengalaman, proyek, sertifikat, dan kontak milik orang tersebut merupakan konten utama.

- Source code admin CMS + bilingual: folder `public`, `server`, `data/seed`.
- Panduan penggunaan: `README.md`.
- Prompt **untuk Claude Code / Codex**: `docs/PROMPT_KHUSUS_PORTOFOLIO_PRIBADI_CLAUDE_CODEX.md`.
- Opsi lanjutan Laravel + MySQL: `docs/PROMPT_MIGRASI_LARAVEL_MYSQL.md`.
- Form pengisian biodata: `docs/CHECKLIST_KONTEN_ASLI.md`.

## Perintah mulai

```bash
node --version            # minimum 22.16
npm run create-admin -- --email emailpemilik@domain.com
npm start
```

Website: `http://127.0.0.1:3000` · Admin: `http://127.0.0.1:3000/admin`

**JANGAN PUBLIKASIKAN SEBELUM MENGGANTI:** `Nama Lengkap Anda` / `Your Full Name`, email contoh, biodata contoh, kartu proyek demo, pengalaman contoh, dan sertifikasi placeholder. Setelah database SQLite telah diinisialisasi, data seed tidak otomatis ditimpa; gunakan `/admin` untuk mengedit.

Untuk proyek nyata, isi **peran pribadi**, bukan mengklaim hasil seluruh tim sebagai karya individu. Jangan mempublikasikan informasi rahasia dari instansi/klien.
