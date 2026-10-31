'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=path=>fs.readFileSync(path,'utf8');
test('Every public i18n key exists in both dictionaries',()=>{
 const ui=JSON.parse(read(path.join(root,'data/seed/ui.json')));
 const html=read(path.join(root,'public/index.html'));
 const keys=[...html.matchAll(/data-i18n(?:-html|-placeholder|-aria)?="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(keys.length>40);
 for(const key of new Set(keys)){
  assert.ok(typeof ui.id[key]==='string',`Missing ID translation: ${key}`);
  assert.ok(typeof ui.en[key]==='string',`Missing EN translation: ${key}`);
 }
 assert.deepEqual(Object.keys(ui.id).sort(),Object.keys(ui.en).sort());
 const id=JSON.parse(read(path.join(root,'data/seed/id.json')));
 const en=JSON.parse(read(path.join(root,'data/seed/en.json')));
 assert.deepEqual(Object.keys(id),Object.keys(en));
 assert.equal(id.projects.length,en.projects.length);
 assert.ok(id.projects.every(p=>p.visibility==='demo'));
 assert.ok(en.projects.every(p=>p.visibility==='demo'));
});
