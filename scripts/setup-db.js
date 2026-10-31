'use strict';
const mysql = require('mysql2/promise');
const {databaseConfig,databaseError} = require('../server/config');
const {db,initializeDatabase} = require('../server/db');

async function setupDatabase(){
 const {database,...connectionOptions}=databaseConfig;
 const connection=await mysql.createConnection(connectionOptions);
 try{
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
 }finally{await connection.end()}
 await initializeDatabase();
 console.log(`Database MySQL ${database} siap. Konten ID/EN tersedia; data yang sudah ada dipertahankan.`);
}
if(require.main===module)setupDatabase().catch(error=>{
 console.error(databaseError(error));
 process.exitCode=1;
}).finally(()=>db.end());
module.exports={setupDatabase};
