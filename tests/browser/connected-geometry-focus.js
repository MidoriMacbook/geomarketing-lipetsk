async original=>{
 const browser=original.context().browser(),errors=[],cases=[],check=(v,s)=>{if(!v)throw Error(s)};
 for(const [width,scale] of [[320,1],[320,2],[390,1],[430,2]]){
 const ctx=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.emulateMedia({reducedMotion:'reduce'});await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.evaluate(()=>document.fonts.ready);await p.evaluate(n=>document.documentElement.style.fontSize=n===2?'200%':'',scale);
 const geometry=()=>p.evaluate(()=>Object.fromEntries(['hero','hero-map-link'].map(id=>[id,document.getElementById(id).getBoundingClientRect().height]))),before=await geometry();
 await p.getByTestId('save-place').first().tap();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);
 const saved=await geometry();check(Object.keys(before).every(key=>Math.abs(before[key]-saved[key])<1),'Контекст сохранённого места меняет hero '+width+'/'+scale+' '+JSON.stringify({before,saved}));
 await p.locator('#scenario-save').tap();await p.locator('#scenario-name').fill('Геометрия');await p.locator('#scenario-name').press('Enter');await p.waitForFunction(()=>!document.getElementById('scenario-dialog').open);
 const research=await geometry();check(Object.keys(before).every(key=>Math.abs(before[key]-research[key])<1),'Контекст исследования меняет hero '+width+'/'+scale);
 cases.push({width,scale});
 }finally{await ctx.close()}}
 const ctx=await browser.newContext({viewport:{width:1280,height:900}}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(new URL(original.url()).origin);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.getByTestId('save-place').first().click();await p.waitForFunction(async()=>(await import('/static/js/state.js')).state.saved.length===1);await p.getByTestId('compare-place').first().check();await p.locator('#comparison-guide-open').click();
 for(const id of ['comparison-map-link','comparison-settings-link','comparison-research-button']){
  await p.locator('#'+id).focus();await p.setViewportSize({width:390,height:844});await p.waitForFunction(()=>document.documentElement.dataset.mobileLayout==='phone');
  check(await p.evaluate(id=>document.activeElement?.id===id,id),'Перенос на телефон потерял фокус '+id);check(await p.locator('#'+id).isVisible(),'Фокус внутри закрытого раздела '+id);
  await p.setViewportSize({width:1280,height:900});await p.waitForFunction(()=>document.documentElement.dataset.mobileLayout==='wide');check(await p.evaluate(id=>document.activeElement?.id===id,id),'Обратный перенос потерял фокус '+id);
 }
 check(errors.length===0,errors.join('; '));return {ok:true,cases,resizeFocus:true,errors};
 }finally{await ctx.close()}
}
