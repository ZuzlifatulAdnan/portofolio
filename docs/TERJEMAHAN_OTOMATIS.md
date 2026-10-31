# Terjemahan otomatis ID ↔ EN

Integrasi dan tombol admin sudah tersedia. Layanan belum diaktifkan pada konfigurasi lokal karena belum ada API key atau server penerjemah. Teks tidak dikirim ke layanan mana pun selama `TRANSLATION_PROVIDER` kosong. Editing ID/EN manual tetap berfungsi.

## Cara menggunakan setelah layanan tersedia

1. Buka `/admin` dan pilih bahasa sumber, misalnya **ID**.
2. Edit dan simpan konten serta SEO yang ingin dipakai sebagai sumber.
3. Pilih **Sertakan SEO** jika judul/deskripsi/gambar sosial juga mengikuti bahasa sumber.
4. Klik **Terjemahkan ID → EN**. Arah **EN → ID** tersedia ketika EN menjadi bahasa sumber.
5. Periksa pratinjau. Hasil dapat dikoreksi langsung pada kolom terjemahan sebelum diterapkan.
6. Centang pernyataan penggantian konten bahasa tujuan, lalu klik **Terapkan Terjemahan**.

Operasi ini menerjemahkan **seluruh konten sumber tersimpan**, bukan hanya item yang sedang terbuka. Koleksi tujuan mengikuti koleksi sumber, termasuk susunan dan status draft/publikasinya. Konten bahasa sumber tetap disimpan. Bahasa tujuan yang sebelumnya diedit manual akan diganti hanya saat hasil diterapkan. Hasil tetap dapat diedit melalui editor biasa.

Terjemahan disimpan di MySQL. Pengunjung yang menekan ID/EN membaca konten tersimpan; browser pengunjung tidak memanggil layanan penerjemah. Teks antarmuka publik sudah memiliki kamus ID/EN bawaan.

## Pilihan 1: Google Cloud Translation Basic

Siapkan API key untuk Cloud Translation API di akun Google Cloud, lalu isi `.env` pada server:

```dotenv
TRANSLATION_PROVIDER=google
GOOGLE_TRANSLATE_API_KEY=isi_api_key_anda
LIBRETRANSLATE_URL=
LIBRETRANSLATE_API_KEY=
```

Restart server setelah mengubah konfigurasi. Integrasi memakai endpoint REST v2 resmi, format teks biasa, dan header `X-Goog-Api-Key`; key tidak dimasukkan ke URL atau dikirim ke browser admin. Konsumsi kuota dan biaya mengikuti akun layanan Anda.

Rujukan resmi: [Cloud Translation v2](https://docs.cloud.google.com/translate/docs/reference/rest/v2/translate), [bahasa yang didukung](https://docs.cloud.google.com/translate/docs/languages), dan [penggunaan API key melalui header](https://docs.cloud.google.com/docs/authentication/api-keys-use).

## Pilihan 2: LibreTranslate

Gunakan server LibreTranslate yang menyediakan model/pasangan bahasa **Indonesia (`id`) dan English (`en`)**. Contoh konfigurasi untuk server lokal yang sudah tersedia:

```dotenv
TRANSLATION_PROVIDER=libretranslate
GOOGLE_TRANSLATE_API_KEY=
LIBRETRANSLATE_URL=http://127.0.0.1:5000
LIBRETRANSLATE_API_KEY=
```

Isi key jika server tersebut mewajibkannya. Server jarak jauh harus menggunakan origin HTTPS; HTTP hanya diterima untuk localhost. Isi URL origin, tanpa path atau parameter. Integrasi memakai `POST /translate` dengan array teks. Lihat [API LibreTranslate](https://docs.libretranslate.com/api/operations/translate/). Instalasi server/model LibreTranslate belum dilakukan dalam perubahan ini.

## Data dan perlindungan

- Yang dikirim adalah field naratif yang perlu diterjemahkan: headline, hero, biografi, deskripsi layanan/proyek, kontribusi, pengalaman, deskripsi sertifikasi/proses kerja, dan metadata SEO jika dipilih.
- FAQ (pertanyaan/jawaban) serta testimoni (kutipan/peran) juga ikut diterjemahkan. Nama, organisasi, foto, izin publikasi, dan status testimoni dipertahankan.
- Field identitas, email, URL, path gambar/CV, nomor sertifikat, tahun, kode proyek, status publikasi, ikon, nama teknologi dalam daftar tags/items, serta warna tidak dikirim sebagai field terjemahan dan harus tetap mengikuti sumber.
- Isi naratif dapat menyebut nama atau informasi pribadi. Seluruh narasi sumber, termasuk proyek draft, diproses oleh layanan yang dikonfigurasi ketika tombol ditekan. Inbox pesan dan data akun/sesi tidak dikirim.
- Pratinjau belum menulis perubahan ke database. Jika konten sumber/tujuan atau SEO terkait berubah setelah pratinjau dibuat, penerapan ditolak dengan respons 409 agar versi baru tidak tertimpa.
- Penerapan konten dan SEO dilakukan dalam satu transaksi dan dicatat sebagai `translation.apply` pada riwayat aktivitas.
- Endpoint hanya untuk admin yang masuk; permintaan POST memerlukan CSRF dan origin yang sesuai. Konfigurasi provider hanya dapat diubah dari server, bukan dari parameter request.
- Tersedia batas 60.000 karakter unik per operasi, 10 permintaan pratinjau per akun per jam, maksimal dua proses bersamaan, batas ukuran respons, dan timeout. Teks berulang dikelompokkan untuk mengurangi permintaan.
- Jika konfigurasi belum tersedia, kuota habis, hasil rusak, atau provider gagal, aplikasi menampilkan kesalahan dan tidak mengganti konten. Hasil mesin tetap perlu diperiksa untuk istilah teknis, nama resmi sertifikasi, dan akurasi narasi.

## Pengujian

```bash
npm test
npm run test:browser
```

Pengujian memakai respons tiruan dan server LibreTranslate tiruan lokal pada database terpisah. Cakupannya meliputi kontrak request Google/LibreTranslate, perlindungan identitas, peninjauan/koreksi/penerapan, dua arah bahasa, CSRF, konfigurasi kosong, kegagalan provider, serta konflik perubahan. Tes ini tidak memakai API berbayar dan tidak membuktikan kualitas terjemahan dari layanan asli. Uji layanan asli dilakukan setelah konfigurasi milik Anda tersedia.
