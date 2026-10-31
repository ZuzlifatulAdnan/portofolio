'use strict';
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({path:path.join(ROOT, '.env'), quiet:true});

const database = process.env.DB_NAME || 'portfolio_cms';
if (!/^[a-zA-Z0-9_]{1,64}$/.test(database)) {
 throw new Error('DB_NAME hanya boleh berisi huruf, angka, dan underscore (maksimal 64 karakter).');
}
const port = Number(process.env.DB_PORT || 3306);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
 throw new Error('DB_PORT harus berupa nomor port yang valid.');
}
const databaseConfig = {
 host:process.env.DB_HOST || '127.0.0.1',
 port,
 user:process.env.DB_USER || 'root',
 password:process.env.DB_PASSWORD || '',
 database,
 charset:'utf8mb4',
 timezone:'Z',
 dateStrings:true,
 jsonStrings:true,
 connectTimeout:5000
};

function databaseError(error) {
 if (['ECONNREFUSED','ETIMEDOUT','ENOTFOUND'].includes(error.code)) {
  return `MySQL tidak dapat dihubungi di ${databaseConfig.host}:${port}. Jalankan MySQL di Laragon/XAMPP dan periksa .env.`;
 }
 if (error.code === 'ER_BAD_DB_ERROR') return `Database ${database} belum tersedia. Jalankan npm run db:setup.`;
 if (error.code === 'ER_ACCESS_DENIED_ERROR') return 'Akses MySQL ditolak. Periksa DB_USER dan DB_PASSWORD pada .env.';
 return error.message;
}
module.exports = {ROOT, databaseConfig, databaseError};
