const {chromium}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const errors=[],metrics=[];
 const stage=process.argv[2]||'after',base=`http://127.0.0.1:${stage==='before'?5018:5017}`,dir=`tests/artifacts/redesign/${stage}`;
 fs.mkdirSync(dir,{recursive:true});
 for(const width of [375,768,1440]){
  for(const state of ['result','loading','empty','error']){
   const page=await browser.newPage({viewport:{width,height:900}});
   page.on('pageerror',e=>errors.push({width,state,error:e.message}));
   const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
   if(state!=='result')await page.route('**/api/calculate?**',async route=>{
    if(state==='loading'){await new Promise(r=>setTimeout(r,12000));await route.abort().catch(()=>{});return;}
    if(state==='error'){await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Не удалось загрузить данные. Повторите попытку.'})});return;}
    const response=await route.fetch();const data=await response.json();data.recommendations=[];data.best=null;
    await route.fulfill({response,json:data});
   });
   await page.goto(base,{waitUntil:'domcontentloaded'});
   if(state==='result'||state==='empty')await page.waitForSelector('html[data-analysis-state=success]');
   if(state==='error')await page.waitForSelector('html[data-analysis-state=error]');
   if(state==='loading')await page.waitForSelector('html[data-analysis-state=calculating]');
   await page.waitForTimeout(1800);
   if(state==='result')await page.screenshot({path:`${dir}/${width}-hero.png`});
   await page.locator('#map-card').scrollIntoViewIfNeeded();
   if(stage==='after'&&width===375){await page.getByRole('button',{name:'Развернуть результаты полностью'}).click();}
   await page.waitForTimeout(500);
   await page.screenshot({path:`${dir}/${width}-${state}.png`});
   metrics.push({width,state,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
   if(state==='result'){
    await page.locator('[data-testid=save-place]').first().evaluate(el=>el.click());
    await page.locator('#saved-section').evaluate(el=>{const details=el.closest('details');if(details)details.open=true;});
    await page.locator('#saved-section').scrollIntoViewIfNeeded();await page.waitForTimeout(500);
    await page.screenshot({path:`${dir}/${width}-saved.png`});
    await page.locator('#model-button').evaluate(el=>el.click());await page.waitForTimeout(500);
    await page.screenshot({path:`${dir}/${width}-dialog.png`});
   }
   await page.close();
  }
 }
 const p=await browser.newPage({viewport:{width:1440,height:900}});await p.goto(base);
 await p.setContent(`<link rel="stylesheet" href="${base}/static/css/base.css"><style>@font-face{font-family:Unbounded;src:url('${base}/static/assets/fonts/unbounded-cyrillic.woff2')}body{padding:40px;background:#FFF7E6;color:#2D3A47;display:flex;gap:24px}article{width:420px;padding:24px;border:1px solid #A9B7C6;border-radius:20px}h1{font-size:46px;font-weight:500;margin:40px 0}p{font-size:22px}strong{font-size:44px}button{padding:16px;font-size:18px}em{color:#89434E}</style>${[['Playfair Display','Onest'],['Playfair Display','Golos Text'],['Unbounded','Golos Text']].map(([heading,body],i)=>`<article style="font-family:'${body}'"><small>${heading} + ${body}</small><h1 id="fonttitle${i}" style="font-family:'${heading}'">Гео<em>Маркетинг</em></h1><p id="fontbody${i}">Жители и конкуренты</p><strong>12 344</strong><p><button>Найти места</button></p></article>`).join('')}`);
 await p.evaluate(()=>document.fonts.ready);await p.screenshot({path:`${dir}/font-pairs.png`});
 const cdp=await p.context().newCDPSession(p);await cdp.send('DOM.enable');await cdp.send('CSS.enable');
 const {root}=await cdp.send('DOM.getDocument');const fonts=[];
 for(const selector of ['#fonttitle0','#fontbody0','#fonttitle1','#fontbody1','#fonttitle2']){
  const {nodeId}=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});fonts.push({selector,...await cdp.send('CSS.getPlatformFontsForNode',{nodeId})});
 }
 fs.writeFileSync(`${dir}/audit.json`,JSON.stringify({errors,metrics,fonts},null,2));
 console.log(JSON.stringify({errors,metrics,fonts}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
