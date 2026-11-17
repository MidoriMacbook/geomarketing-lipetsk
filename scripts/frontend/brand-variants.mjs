import {chromium} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const dir='docs/verification/map-workbench/brand',base='http://127.0.0.1:5071';await mkdir(dir,{recursive:true});
const marks={
 A:'<ellipse cx="16" cy="23" rx="10" ry="4"/><path d="M22 12c0 5-6 10-6 10s-6-5-6-10a6 6 0 1 1 12 0Z"/><circle cx="16" cy="12" r="2"/>',
 B:'<path d="M6 6h20v20H6zM6 16h20M16 6v20"/><circle cx="16" cy="16" r="6"/><circle cx="16" cy="16" r="1.5" fill="#FFF7E6" stroke="none"/>',
 C:'<path d="M7 17V7h10M25 15v10H15"/><circle cx="16" cy="16" r="7"/><circle cx="16" cy="16" r="2" fill="#FFF7E6" stroke="none"/>'
};
const svg=body=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#89434E"/><g fill="none" stroke="#FFF7E6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
const browser=await chromium.launch({channel:'chrome'});
try{
 for(const [name,body] of Object.entries(marks)){
  await writeFile(`${dir}/logo-${name}.svg`,svg(body));
  for(const width of [375,1440]){
   const p=await browser.newPage({viewport:{width,height:900}});await p.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());await p.goto(base);await p.evaluate(source=>document.querySelector('.brand-icon').innerHTML=source,svg(body));await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1000);await p.screenshot({path:`${dir}/${name}-header-${width}.png`});await p.close();
  }
  for(const size of [16,24,32,180]){const p=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});await p.setContent(`<style>body{margin:0}svg{display:block;width:100%;height:100%}</style>${svg(body)}`);await p.screenshot({path:`${dir}/${name}-${size}.png`});await p.close();}
 }
 // C сохраняет карту и радиус, но читается при 16 px без пересечения трёх линий в центре.
 await writeFile('static/assets/favicon.svg',svg(marks.C));
 for(const [size,name] of [[32,'favicon-32.png'],[180,'apple-touch-icon.png']])await writeFile(`static/assets/${name}`,await readFile(`${dir}/C-${size}.png`));
 let html=await readFile('static/index.html','utf8');html=html.replace(/(<span class="brand-icon" aria-hidden="true">).*?(<\/span><span>Гео)/s,`$1${svg(marks.C)}$2`);await writeFile('static/index.html',html);
 const p=await browser.newPage({viewport:{width:1200,height:630}});await p.goto(base);await p.setContent(`<link rel="stylesheet" href="${base}/static/css/base.css"><style>body{background:#FFF7E6;color:#2D3A47;padding:64px;font-family:'Golos Text',sans-serif}.mark{width:88px;height:88px}h1{font:76px/1.1 'Playfair Display',serif;margin:38px 0 20px}em{color:#89434E}p{font-size:28px;max-width:800px}.line{margin-top:50px;border-top:1px solid #A9B7C6;padding-top:20px;font-size:18px}</style><div class="mark">${svg(marks.C)}</div><h1>Гео<em>Маркетинг</em> Липецк</h1><p>Спрос, конкуренты и места для вашего бизнеса — на одной карте.</p><div class="line">Выберите область · сравните места · проверьте на месте</div>`);await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:'static/assets/og-image.png'});await p.close();
}finally{await browser.close();}
