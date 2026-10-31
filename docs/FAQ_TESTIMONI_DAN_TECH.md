# Logo teknologi, FAQ, dan testimoni

## Logo teknologi

Logo muncul otomatis berdasarkan nama teknologi di **Teknologi & Tools**, serta tag layanan/proyek yang dikenali. Contoh: `PHP / Laravel`, `JavaScript`, `HTML / CSS`, `Tailwind CSS`, `MySQL`, `Android`, `MikroTik RouterOS`, `Linux / Ubuntu`, `Nginx / Apache`, dan `Git & GitHub`. Nama gabungan dapat memakai dua logo. Nama dalam daftar teknologi tetap ditampilkan sebagai teks.

Aset SVG tersimpan di `public/assets/tech/` dan tidak memuat skrip atau bergantung pada CDN. Nama yang belum dikenal dan istilah umum seperti Testing, DNS, IT Support, dan Deployment memakai ikon kategori. Daftar alias dapat diperluas di `public/js/technology.js`.

Untuk membangun ulang aset dengan dependensi pengembangan terpasang:

```bash
npm run assets:tech
```

Katalog dan logo yang dihasilkan sudah tersedia sehingga perintah tersebut tidak diperlukan saat menjalankan website. Sumber dan metadata ikon tercantum di [Logo teknologi](LOGO_TEKNOLOGI.md). Grafik bersumber dari [Simple Icons](https://github.com/simple-icons/simple-icons).

## FAQ

Pilih **FAQ** di admin, pilih bahasa, lalu klik **+ Tambah**. Isi pertanyaan dan jawaban, atur urutan bila diperlukan, dan simpan. FAQ berstatus `draft` tidak dikirim ke API atau HTML publik. `published` memerlukan pertanyaan dan jawaban yang lengkap.

FAQ menggunakan elemen HTML `details`/`summary`, sehingga tetap bisa dibuka melalui keyboard dan saat JavaScript tidak aktif. Tidak ada HTML mentah dari editor yang dieksekusi. Maksimal pertanyaan 180 karakter dan jawaban 4.000 karakter. Empat FAQ awal menjelaskan fungsi portofolio tanpa menambahkan janji harga, waktu pengerjaan, atau klaim pengalaman baru.

## Testimoni

Data awal tidak memiliki kutipan pelanggan. Bagian publik menampilkan kondisi kosong sampai testimoni asli dimasukkan dan dipublikasikan.

Di **Testimoni**, isi nama pemberi testimoni, kutipan yang diizinkan, dan bila tersedia peran/jabatan, organisasi, serta foto. Foto opsional; tanpa foto, kartu memakai inisial nama. Catat izin melalui pilihan **Izin publikasi diterima**, kemudian ubah status menjadi `published` dan simpan. Aplikasi menolak publikasi tanpa nama, kutipan yang lengkap, serta izin.

Testimoni draft atau tanpa izin tidak dikirim ke pengunjung. Untuk menarik kutipan, ubah status menjadi `draft` dan simpan. Jika izin diubah kembali menjadi belum tersedia, editor juga mengubah statusnya ke draft; perubahan berlaku setelah disimpan. Tidak ada bintang/rating, jumlah pelanggan, atau klaim hasil kerja buatan yang ditambahkan oleh fitur ini.

## Penyimpanan dan bahasa

FAQ dan testimoni disimpan dalam JSON konten MySQL per bahasa, seperti koleksi lain. Saat startup/setup, aplikasi menambahkan field yang belum ada pada data lama; koleksi yang sudah ada, termasuk yang sengaja dikosongkan, dipertahankan. Cadangan database lokal sebelum migrasi tersedia di `storage/portfolio-before-faq-testimonials.sql`.

Terjemahan otomatis mencakup pertanyaan/jawaban FAQ dan kutipan/peran pemberi testimoni. Nama pemberi testimoni, organisasi, foto, ID, izin, dan status publikasi dipertahankan. Hasil terjemahan kutipan perlu diperiksa agar maknanya tetap sesuai izin dan sumber asli. Mesin terjemahan tetap memerlukan konfigurasi seperti dijelaskan di `TERJEMAHAN_OTOMATIS.md`.

HTML FAQ, testimoni yang diizinkan, dan logo toolkit tersedia langsung dari server. Penambahan ini tidak membuat markup rating atau menjanjikan rich result mesin pencari.

## Pengujian

`npm test` memeriksa validasi, penyaringan draft/izin, escaping, pemetaan logo lokal, migrasi konten lama, serta terjemahan. `npm run test:browser` memeriksa pengelolaan melalui admin, keyboard FAQ, tampilan seluler, dan HTML tanpa JavaScript. Semua data testimoni dalam tes/tangkapan layar berlabel data uji dan hanya disimpan di database uji terpisah.
