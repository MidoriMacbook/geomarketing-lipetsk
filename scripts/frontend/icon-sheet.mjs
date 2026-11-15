import {chromium} from '@playwright/test';
const b=await chromium.launch({channel:'chrome'});try{
 const p=await b.newPage({viewport:{width:1000,height:650}});await p.goto('http://127.0.0.1:5071');
 await p.evaluate(async()=>{
  const {icon}=await import('/static/js/icons.js');document.body.replaceChildren();document.body.style.cssText='padding:40px;background:var(--palette-cream);color:var(--palette-ink)';
  const h=document.createElement('h1');h.textContent='Tabler · 20 / 24 px · 1,75 px';document.body.append(h);
  const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:repeat(5,1fr);gap:24px;margin-top:40px';
  for(const name of ['coffee','first-aid-kit','basket','bread','scissors','burger','flower','paw','barbell','dental','chevron-down','x','arrow-right','arrow-up-right','bookmark','arrows-diff','copy','download','check','map-pin']){
   const cell=document.createElement('div');cell.style.cssText='padding:16px;border:1px solid var(--palette-line);border-radius:12px;min-height:86px';
   cell.append(icon(name));const large=icon(name);large.style.cssText='width:24px;height:24px;margin-left:16px;color:var(--palette-rosewood-deep)';cell.append(large);const label=document.createElement('div');label.textContent=name;label.style.cssText='font-size:12px;margin-top:10px';cell.append(label);grid.append(cell);
  }document.body.append(grid);
 });await p.screenshot({path:'docs/verification/map-workbench/brand/icon-sheet.png'});
}finally{await b.close();}
