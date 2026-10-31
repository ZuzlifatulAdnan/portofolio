# Panduan Deploy VPS Ubuntu + Nginx

> Untuk uji coba lokal, cukup `npm run create-admin` dan `npm start` (lihat README). Di server produksi, **wajib HTTPS**, permission disk, backup, dan review keamanan. Jangan mengekspos SQLite / storage / konfigurasi ke web.

## 1. Instal runtime Node.js

Gunakan Node.js versi LTS yang kompatibel dengan `node:sqlite` dan **uji** `node --version` / `node -e "require('node:sqlite')"`. Proyek diuji dengan Node 22.16. Ikuti panduan paket resmi Node.js untuk instalasi pada sistem Anda.

## 2. Letakkan source

Misal repo ditempatkan di `/opt/personal-it-portfolio`; buat user sistem khusus `portfolio` dengan permission minimum. Pastikan folder kode dimiliki user deploy, dan folder `DATA_DIR` dapat ditulis oleh user service. Jangan menyimpan berkas SQLite di direktori `public/`.

```bash
sudo mkdir -p /var/lib/personal-it-portfolio
sudo chown portfolio:portfolio /var/lib/personal-it-portfolio
sudo chmod 700 /var/lib/personal-it-portfolio
cd /opt/personal-it-portfolio
npm test
sudo -u portfolio npm run create-admin -- --email admin@domainanda.id
```

Jika membuat admin melalui `sudo -u`, gunakan `DATA_DIR` yang sama seperti service produksi. Password dimasukkan melalui prompt interaktif di terminal.

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
Environment=DATA_DIR=/var/lib/personal-it-portfolio
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ReadWritePaths=/var/lib/personal-it-portfolio /opt/personal-it-portfolio/public/assets/uploads

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

- Backup **database SQLite secara konsisten** menggunakan perintah backup API/SQLite backup procedure yang aman saat proses berjalan; untuk sederhana, jadwalkan maintenance singkat sebelum menyalin file DB beserta berkas media.
- Backup folder `/opt/personal-it-portfolio/public/assets/uploads/`.
- Simpan backup di lokasi privat, terenkripsi, dan uji restore berkala.
- Atur monitoring uptime dan resource; update Node.js dan paket OS secara rutin.
- Atur policy retensi data untuk contact messages; jangan simpan pesan pribadi selamanya.
- Untuk skala lebih besar, pindahkan DB ke MySQL/PostgreSQL dan gunakan framework web yang memiliki autentikasi matang.

## 6. Keterbatasan cPanel

Jika hosting cPanel hanya mendukung **PHP statis + MySQL**, server Node.js di atas tidak dapat berjalan tanpa fitur aplikasi Node.js atau akses proses persisten. Pilih VPS, atau migrasikan ke **Laravel + MySQL** menggunakan prompt yang disediakan.
