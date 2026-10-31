'use strict';
const path=require('node:path');
const sharp=require('sharp');
const {PDFDocument,PDFDict,PDFArray,PDFName}=require('pdf-lib');
const blockedNames=new Set(['JavaScript','JS','OpenAction','AA','Launch','EmbeddedFiles','RichMedia','AcroForm','XFA','SubmitForm','ImportData','GoToR']);
function checkPDF(object,seen=new Set()){
 if(seen.has(object))return;seen.add(object);
 if(object instanceof PDFName&&blockedNames.has(object.decodeText()))throw new Error('PDF interaktif, skrip, atau lampiran tidak diizinkan.');
 if(object instanceof PDFDict)for(const [key,value]of object.entries()){checkPDF(key,seen);checkPDF(value,seen)}
 if(object instanceof PDFArray)for(const value of object.asArray())checkPDF(value,seen);
}
async function sanitizeUpload(body){
 const {filename,mime,base64}=body;
 const fail=message=>{const error=new Error(message);error.status=422;return error};
 if(typeof filename!=='string'||!filename||filename.length>255||/[\u0000-\u001f]/.test(filename)||typeof base64!=='string'||base64.length>10000000||base64.length%4!==0||!/[A-Za-z0-9+/]/.test(base64)||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw fail('Nama berkas atau encoding tidak valid.');
 const bytes=Buffer.from(base64,'base64');
 if(bytes.toString('base64')!==base64)throw fail('Encoding base64 tidak valid.');
 if(!bytes.length||bytes.length>7000000){const error=fail('Berkas maksimal 7 MB.');error.status=413;throw error}
 const extension=path.extname(filename).toLowerCase();
 if(mime==='application/pdf'){
  if(extension!=='.pdf'||bytes.toString('ascii',0,5)!=='%PDF-'||!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))throw fail('Berkas PDF tidak valid.');
  try{
   const pdf=await PDFDocument.load(bytes,{ignoreEncryption:false,throwOnInvalidObject:true});
   if(pdf.getPageCount()<1||pdf.getPageCount()>100)throw new Error('PDF harus berisi 1–100 halaman.');
   for(const [,object]of pdf.context.enumerateIndirectObjects())checkPDF(object);
   const clean=Buffer.from(await pdf.save());
   if(clean.length>7000000)throw new Error('PDF hasil pemeriksaan melebihi 7 MB.');
   return {bytes:clean,extension:'.pdf',type:'application/pdf'};
  }catch(error){throw fail(error.message.startsWith('PDF ')?error.message:'PDF rusak, terenkripsi, atau memiliki fitur aktif yang tidak didukung.')}
 }
 if(bytes.length>5000000){const error=fail('Gambar maksimal 5 MB.');error.status=413;throw error}
 const formats={'image/png':{format:'png',extensions:['.png']},'image/jpeg':{format:'jpeg',extensions:['.jpg','.jpeg']},'image/webp':{format:'webp',extensions:['.webp']}};
 const expected=formats[mime];
 if(!expected||!expected.extensions.includes(extension))throw fail('Gunakan gambar PNG/JPG/WebP atau PDF dengan ekstensi yang sesuai.');
 try{
  const image=sharp(bytes,{limitInputPixels:25000000,failOn:'warning',animated:false});
  const info=await image.metadata();
  if(info.format!==expected.format||(info.pages||1)>1)throw new Error();
  const clean=await image.rotate().toFormat(expected.format).toBuffer();
  if(clean.length>5000000)throw new Error();
  return {bytes:clean,extension:expected.extensions[0],type:mime};
 }catch{throw fail('Gambar rusak, terlalu besar, atau isi tidak sesuai jenis berkas.')}
}
module.exports={sanitizeUpload};
