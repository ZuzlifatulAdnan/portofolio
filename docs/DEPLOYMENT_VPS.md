# Panduan Deploy VPS Ubuntu + Nginx

> Untuk uji coba lokal, aktifkan MySQL, jalankan `npm install`, `npm run setup:local`, dan `npm start` (lihat README). Panduan di bawah hanya untuk tahap produksi berikutnya. Jangan mengekspos storage atau konfigurasi ke web.

## 1. Instal runtime Node.js

Gunakan Node.js LTS yang masih didukung, minimal versi 20.20, serta MySQL 8.0+. Proyek lokal diuji dengan Node.js 20.20.2 dan MySQL 8.4.3. Jalankan `npm ci` untuk memasang dependensi yang tercatat di package-lock.json.

## 2. Letakkan source

Misal repo ditempatkan di `/opt/personal-it-portfolio`; buat user sistem khusus `portfolio`. Siapkan database dan akun MySQL khusus, lalu isi `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, dan `DB_PASSWORD` dalam `.env` privat. Akun aplikasi hanya memerlukan izin pada database portofolio. Folder `public/assets/uploads` harus dapat ditulis oleh service.

```bash
cd /opt/personal-it-portfolio
sudo -u portfolio npm run db:setup
sudo -u portfolio npm run create-admin -- --email admin@domainanda.id
```

Gunakan `.env` yang sama seperti service produksi. Password admin dimasukkan melalui prompt interaktif. Jalankan `npm test` pada lingkungan pengembangan dengan akun MySQL pengujian yang memiliki izin CREATE/DROP DATABASE; tes menggunakan database acak terpisah.

Isi `MFA_ENCRYPTION_KEY` pada `.env` privat dengan 32 byte acak base64. Bila memindahkan akun yang sudah aktif MFA, gunakan kunci lokal yang sama dalam bentuk base64. Backup kunci terpisah dari database; jangan menggantinya saat MFA aktif. Lihat [panduan MFA](MFA_DAN_SEARCH_CONSOLE.md).

## 3. Unit systemd

Buat `/etc/systemd/system/personal-it-portfolio.service` dan sesuaikan user serta path:

```ini
[Unit]
Description=Portfolio Pribadi IT CMS
After=network.target

[Service]
Type=simple
User=portfolio
Group=portfolio
WorkingDirectory=/opt/personal-it-portfolio
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=APP_ORIGIN=https://portfolio.example.com
EnvironmentFile=/opt/personal-it-portfolio/.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/opt/personal-it-portfolio/public/assets/uploads

[Install]
WantedBy=multi-user.target
```

**Catatan:** sesuaikan lokasi `/usr/bin/node` dengan output `command -v node`, gunakan permission user service yang benar, pastikan sistem bisa menulis folder upload, dan pertimbangkan hardening lebih lanjut sesuai sistem operasi.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now personal-it-portfolio
sudo systemctl status personal-it-portfolio
sudo journalctl -u personal-it-portfolio -f
```

## 4. Konfigurasi Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name portfolio.example.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name portfolio.example.com;
    # Sertifikat TLS dikelola oleh Certbot atau panel hosting Anda.
    ssl_certificate /etc/letsencrypt/live/portfolio.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/portfolio.example.com/privkey.pem;

    client_max_body_size 10m;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 30s;
    }
}
```

Terbitkan sertifikat TLS sebelum mengaktifkan konfigurasi HTTPS di atas. Pastikan port 3000 tidak dibuka ke internet. Tambahkan firewall UFW/alat setara. Ganti seluruh `portfolio.example.com` dengan domain milik Anda.

## 5. Backup & operasional

- Backup **database MySQL** dengan `mysqldump --single-transaction --no-tablespaces -u USER -p portfolio_cms > portfolio_cms.sql` menggunakan akun backup yang sesuai; `-p` meminta password secara interaktif.
- Backup folder `/opt/personal-it-portfolio/public/assets/uploads/`.
- Backup kunci `MFA_ENCRYPTION_KEY` secara terenkripsi dan terpisah dari database. Untuk pengembangan lokal, kunci berada di `storage/mfa.key` setelah setup pertama.
- Simpan backup di lokasi privat, terenkripsi, dan uji restore berkala.
- Atur monitoring uptime dan resource; update Node.js dan paket OS secara rutin.
- Atur policy retensi data untuk contact messages; jangan simpan pesan pribadi selamanya.
- Backend ini sudah menggunakan MySQL. Untuk pengembangan lebih lanjut, pertimbangkan framework dengan autentikasi matang sesuai kebutuhan.

## 6. Keterbatasan cPanel

Jika hosting cPanel hanya mendukung **PHP statis + MySQL**, server Node.js di atas tidak dapat berjalan tanpa fitur aplikasi Node.js atau akses proses persisten. Pilih VPS, atau migrasikan ke **Laravel + MySQL** menggunakan prompt yang disediakan.
