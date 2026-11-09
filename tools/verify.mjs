import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const catalog=JSON.parse(readFileSync(resolve(root,'catalog.json'),'utf8'));
assert.equal(catalog.length,19);
assert.equal(catalog.filter(doc=>doc.primary).length,19);
assert.equal(readdirSync(resolve(root,'pdfs')).filter(f=>f.endsWith('.pdf')).length,19);
assert.equal(readdirSync(resolve(root,'assets/covers')).filter(f=>f.endsWith('.webp')).length,19);
assert.equal(new Set(catalog.map(doc=>doc.id)).size,catalog.length);
for(const doc of catalog){
  for(const asset of [doc.file,doc.cover])assert(existsSync(resolve(root,asset)),asset);
  assert.equal(statSync(resolve(root,doc.file)).size,doc.bytes);
  assert.equal(createHash('sha256').update(readFileSync(resolve(root,doc.file))).digest('hex'),doc.sha256);
  assert(doc.pages>0);
  assert(doc.bytes<100*1024*1024,'GitHub file size limit');
}
const html=readFileSync(resolve(root,'index.html'),'utf8');
for(const path of [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1])){
  if(!path.startsWith('https:'))assert(existsSync(resolve(root,path)),path);
}
assert(existsSync(resolve(root,'vendor/pdf.min.mjs')));
assert(existsSync(resolve(root,'vendor/pdf.worker.min.mjs')));
console.log(`Verified ${catalog.length} PDFs, their covers, metadata, and page assets.`);
