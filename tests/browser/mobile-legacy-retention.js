async original=>{
 const results=[],base=new URL(original.url()).origin;
 for(const fixture of [{source:'cache',radius:1000,next:'1500'},{source:'demo',radius:1500,next:'700'}]){
  const ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage();const check=(v,s)=>{if(!v)throw Error(s)};
  try{
   await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
   check(await p.evaluate(async fixture=>{const {state}=await import('/static/js/state.js'),{validateScenario}=await import('/static/js/scenario-storage.js'),analysis=structuredClone(state.current);delete analysis.analysis_context;analysis.district='custom';analysis.district_name='Своя область';analysis.source=fixture.source;delete analysis.data_quality;const now=new Date().toISOString(),item={id:crypto.randomUUID(),name:'Старый снимок',note:'',saved_at:now,updated_at:now,selection:{district:'custom',business:analysis.business,custom_point:analysis.center,area_radius_m:fixture.radius},view:{threshold:70,selected_rank:1,layers:{houses:true,competitors:true,centroids:false,zones:true}},analysis};if(!validateScenario(item))return false;localStorage.setItem('geomarketing.scenarios.v1',JSON.stringify({schema_version:1,scenarios:[item]}));return true},fixture),'Невалидная фикстура старого снимка');
   await p.reload();await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');await p.locator('#nav-toggle').tap();await p.locator('#nav-menu a[href="#scenarios-section"]').tap();await p.getByTestId('scenario-open').tap();await p.waitForFunction(()=>document.getElementById('district').value==='custom');
   await p.locator('#mobile-settings-open').tap();await p.locator('#radius-trigger').tap();await p.keyboard.press(fixture.next==='1500'?'End':'Home');await p.keyboard.press('Enter');check(await p.locator('#radius').inputValue()===fixture.next,'Радиус не изменился');await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
   await p.locator('#scenario-save').tap();await p.locator('#scenario-name').fill('Повторное сохранение');await p.locator('#scenario-submit').tap();await p.waitForFunction(async()=>{const {state}=await import('/static/js/state.js');return state.scenarios.length===2||!document.getElementById('scenario-form-error').hidden});
   check(await p.evaluate(async radius=>{const {state}=await import('/static/js/state.js'),{validateScenario}=await import('/static/js/scenario-storage.js');return state.scenarios.length===2&&state.scenarios.every(item=>validateScenario(item)&&item.selection.area_radius_m===radius)},fixture.radius),'Старый снимок смешан с новым радиусом формы: '+fixture.source);
   results.push({source:fixture.source,radius:fixture.radius,next:fixture.next});
  }finally{await ctx.close()}
 }
 return {ok:true,results};
}
