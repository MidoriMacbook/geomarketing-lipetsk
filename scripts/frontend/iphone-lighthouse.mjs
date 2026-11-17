import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const cli=process.env.LIGHTHOUSE_CLI;
if(!cli)throw new Error('Set LIGHTHOUSE_CLI to the installed Lighthouse cli/index.js');
const dir='docs/verification/iphone-layout/metrics/lighthouse',url='https://geomarketing-lipetsk-redesign.onrender.com/';
await mkdir(dir,{recursive:true});const rows=[];
for(let run=1;run<=5;run++){
 const path=`${dir}/run-${run}.json`,start=Date.now();
 const child=spawn(process.execPath,[cli,url,'--only-categories=performance,accessibility','--output=json',`--output-path=${path}`,'--chrome-flags=--headless --no-sandbox','--throttling.cpuSlowdownMultiplier=4','--quiet'],{windowsHide:true,env:process.env,stdio:'inherit'});
 let report;
 try{
  while(Date.now()-start<150000){
   try{const r=JSON.parse(await readFile(path,'utf8'));if(Date.parse(r.fetchTime)>=start-1000){if(r.runtimeError)throw new Error(r.runtimeError.message);if(r.audits){report=r;break;}}}catch(e){if(e.code!=='ENOENT'&&!(e instanceof SyntaxError))throw e;}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  if(!report)throw new Error('Lighthouse report timeout');
 }finally{
  // The CLI may retain a Chrome process on Windows after writing its completed report.
  await new Promise(resolve=>setTimeout(resolve,1500));
  if(child.exitCode===null){if(process.platform==='win32')try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});}catch{}else child.kill();}
 }
 const a=report.audits;
 rows.push({run,time:report.fetchTime,version:report.lighthouseVersion,LCP_ms:a['largest-contentful-paint'].numericValue,CLS:a['cumulative-layout-shift'].numericValue,TBT_ms:a['total-blocking-time'].numericValue,Performance:report.categories.performance.score*100,Accessibility:report.categories.accessibility.score*100,transfer_bytes:a['total-byte-weight'].numericValue});
 await writeFile(`${dir}/summary.json`,JSON.stringify(rows,null,2));console.log(rows.at(-1));
}
