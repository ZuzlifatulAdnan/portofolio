# MFA dan Google Search Console

Kedua fitur tersedia di admin lokal. Domain, token Google, dan aktivasi autentikator diisi sendiri oleh pemilik melalui pengaturan. Akun lokal tidak diaktifkan MFA secara otomatis: aktivasi harus dikonfirmasi dengan kode dari perangkat pemilik.

## Google Search Console

1. Buka **SEO & Mesin Pencari**. Isi **URL utama website**, misalnya `https://namaanda.id`, lalu simpan. Biarkan URL kosong dan indeks nonaktif selama pengembangan lokal.
2. Masuk ke Google Search Console dengan akun Google sendiri. Tambahkan properti **URL-prefix** dengan URL yang sama, termasuk HTTPS dan pilihan `www`.
3. Pilih metode **Tag HTML**. Salin nilai `content` ke **Token verifikasi Google Search Console**. Alternatifnya, tempel tag lengkap pada kartu Google Search Console, klik **Ambil token dari tag**, lalu **Simpan Pengaturan**.
4. Setelah domain melayani website ini secara publik melalui HTTPS, klik **Verifikasi** di Google Search Console. Tag tersedia pada HTML dari server, termasuk ketika JavaScript dinonaktifkan.
5. Kirim URL `https://namaanda.id/sitemap.xml` melalui menu **Sitemaps** di Google. Aktifkan pengindeksan di admin jika konten siap dipublikasikan, lalu simpan.

Kartu admin memeriksa konfigurasi tersimpan, bukan kepemilikan akun Google atau apakah URL benar-benar dapat diakses. Status “tag terpasang” tidak berarti Google sudah memverifikasi domain. Verifikasi kepemilikan, pengiriman sitemap, dan laporan indeks tetap dikerjakan di Google Search Console. Fitur ini tidak memerlukan API key Google Cloud Translation ataupun OAuth.

Properti **Domain** memerlukan record TXT DNS dari Google; tag HTML tidak dapat memverifikasinya. Kelola record tersebut pada penyedia DNS. Verifikasi DNS bisa disiapkan sebelum website dipublikasikan. Jangan menghapus bukti verifikasi setelah berhasil.

Referensi resmi: [verifikasi kepemilikan](https://support.google.com/webmasters/answer/9008080), [jenis properti](https://support.google.com/webmasters/answer/34592), dan [pengelolaan sitemap](https://support.google.com/webmasters/answer/7451001).

## Aktivasi MFA

1. Buka **Keamanan → Autentikasi dua faktor (MFA)**. Masukkan password akun dan pilih **Mulai setup MFA**.
2. Pindai QR pada Google Authenticator, Microsoft Authenticator, atau aplikasi TOTP lain. Kunci manual tersedia bila QR tidak dapat dipindai. QR dibuat lokal oleh server; secret tidak dikirim ke layanan QR pihak ketiga.
3. Konfirmasi password dan kode enam digit. Setup berlaku sepuluh menit dan terikat pada sesi yang memulainya. MFA baru aktif sesudah kode benar.
4. Simpan sepuluh kode pemulihan secara privat, misalnya di password manager. Daftar hanya ditampilkan setelah aktivasi atau pembuatan ulang. Setiap kode hanya boleh dipakai satu kali. Jangan membagikan QR, kunci setup, atau kode pemulihan.
5. Login selanjutnya meminta password, kemudian kode autentikator. Jika perangkat tidak tersedia, gunakan **Gunakan kode pemulihan**.

Kode TOTP berganti setiap 30 detik. Aplikasi menerima selisih satu periode untuk mengakomodasi jam perangkat; aktifkan sinkronisasi waktu pada server dan perangkat. Kode yang sudah dipakai tidak dapat dipakai kembali. Jika baru login atau aktivasi, tunggu kode berikutnya sebelum mengubah pengaturan sensitif, atau gunakan kode pemulihan.

Mengaktifkan/menonaktifkan MFA atau membuat ulang kode pemulihan mencabut sesi lain dan mengganti sesi saat ini. Mengganti password mencabut seluruh sesi dan memerlukan faktor kedua ketika MFA aktif. Membuat ulang kode pemulihan membatalkan seluruh kode lama. Mengganti perangkat dilakukan dengan menonaktifkan MFA menggunakan password dan faktor kedua, lalu melakukan setup baru.

## Penyimpanan dan perlindungan

- Secret TOTP dienkripsi dengan AES-256-GCM. Kode pemulihan acak disimpan sebagai hash, bukan teks asli. Faktor tidak ditulis ke riwayat aktivitas.
- Login tahap password hanya menghasilkan tantangan MFA selama lima menit; akses konten admin baru diberikan setelah faktor kedua benar. Tantangan terikat pada IP dan user agent.
- Percobaan dibatasi di MySQL: per tantangan lima dalam lima menit, per akun sepuluh dalam lima belas menit, dan per IP dua puluh dalam lima belas menit untuk verifikasi MFA. Setup/perubahan MFA juga dibatasi. Login password memiliki pembatasan terpisah.
- Perubahan sensitif memerlukan password saat ini, faktor kedua jika aktif, CSRF, serta origin yang sesuai. Penukaran kode dan perubahan status memakai transaksi untuk mencegah pemakaian kode bersamaan.
- Ini MFA berbasis TOTP; belum passkey/WebAuthn dan belum tahan phishing. Panduan: [OWASP Multifactor Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html).

## Kunci enkripsi dan backup

Saat pengembangan lokal, setup pertama membuat **`storage/mfa.key`** secara privat. Jangan menghapus atau menimpa kunci setelah MFA aktif. Jika file hilang sementara ada akun aktif MFA, aplikasi tidak membuat kunci pengganti secara diam-diam. Kode pemulihan tetap dapat dipakai untuk login dan menonaktifkan MFA.

Produksi memerlukan **`MFA_ENCRYPTION_KEY`**, berisi tepat 32 byte acak dalam base64. Buat di terminal privat dan simpan pada environment service atau `.env` yang dibatasi aksesnya:

```bash
node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64'))"
```

Jika memindahkan akun yang sudah aktif dari lokal, gunakan base64 dari **32 byte kunci lokal yang sama**, bukan kunci acak baru. Jangan mengganti kunci saat MFA aktif tanpa prosedur migrasi/re-enrollment. Backup kunci secara terenkripsi dan terpisah dari backup database; backup database saja tidak cukup untuk memulihkan autentikator. Batasi ACL file pada Windows dan permission user service pada Linux. Jangan masukkan kunci ke Git, tangkapan layar, log, atau folder publik.

## Pemulihan melalui terminal server

Gunakan kode pemulihan terlebih dahulu. Jika perangkat dan semua kode hilang, administrator yang menguasai terminal server **dan mengetahui password akun saat ini** dapat menjalankan:

```bash
npm run mfa:reset -- --email emailanda@example.com --confirm
# Masukkan password akun melalui prompt tersembunyi.
```

Perintah menghapus secret/kode pemulihan akun, menonaktifkan MFA, mencabut seluruh sesi/tantangan/setup tertunda, dan mencatat `mfa.server-reset`. Login kembali dan segera daftarkan perangkat baru. Perintah bukan endpoint web, tidak mengganti password, dan tidak mencetak faktor atau kunci. `MFA_RESET_PASSWORD` hanya tersedia untuk otomasi privat; jangan disimpan permanen pada `.env`.

## Pengujian

`npm test` menguji vektor TOTP RFC, enkripsi/tamper, setup kedaluwarsa, CSRF, login dua tahap, penolakan replay, penggunaan recovery secara bersamaan, rotasi kode/sesi/password, batas percobaan, pemulihan terminal, serta status dan parser tag Search Console. `npm run test:browser` memeriksa setup QR, unduhan kode, login TOTP/recovery, pembuatan ulang/penonaktifan MFA, dan pengaturan tag Google di browser. Semua memakai database uji terpisah.
