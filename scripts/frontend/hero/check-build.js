import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { rollup } from 'rollup';
import config from '../../../rollup.config.js';

const provenance=JSON.parse(await readFile(new URL('./upstream/PROVENANCE.json',import.meta.url),'utf8'));
for (const [file,hash] of Object.entries(provenance.sha256)) {
  // Preserve upstream LF hashes across Windows Git autocrlf checkouts.
  const data=(await readFile(new URL(`./upstream/${file}`,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  if(createHash('sha256').update(data).digest('hex')!==hash)throw new Error(`Upstream source changed: ${file}`);
}
const {output:options,...input}=config({configHero:true});
const bundle=await rollup(input);
try {
  const {output}=await bundle.generate(options);
  const code=output[0].code;
  const saved=(await readFile(options.file,'utf8')).replace(/\r\n/g,'\n');
  if(code!==saved)throw new Error('Hero bundle is stale. Run pnpm build:hero and commit the result.');
  const raw=Buffer.byteLength(code),gzip=gzipSync(code,{level:9}).length;
  if(gzip>180*1024)throw new Error(`Hero gzip exceeds 180 KiB: ${gzip}`);
  console.log(`Hero deterministic build: ${raw} raw bytes / ${gzip} gzip bytes; source hashes verified.`);
} finally { await bundle.close(); }
