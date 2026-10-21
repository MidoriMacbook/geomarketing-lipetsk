async original => {
  const context=await original.context().browser().newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}), page=await context.newPage();
  const base=new URL(original.url()).origin,assert=(ok,message)=>{if(!ok)throw Error(message);},errors=[];
  let calculations=0;
  context.on('page',tab=>tab.on('pageerror',error=>errors.push(error.message)));
  context.on('request',request=>{if(request.url().includes('/api/calculate'))calculations++;});
  try{
    const motionContext=await original.context().browser().newContext({reducedMotion:'no-preference'}),motionPage=await motionContext.newPage();
    try{
      await motionPage.goto(base);await motionPage.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
      await motionPage.locator('[data-testid="save-place"]').first().click();await motionPage.waitForSelector('[data-testid="field-checks"]');
      await motionPage.locator('[data-testid="field-checks"] summary').click();
      await motionPage.evaluate(()=>{window.fieldMotion=[];const animate=Element.prototype.animate;Element.prototype.animate=function(...args){const effect=animate.apply(this,args);if(this.matches('[data-testid="field-check"]'))window.fieldMotion.push({effect,persisted:!!JSON.parse(localStorage.getItem('geomarketing.field-checks.v1'))?.records[0]?.checks[0]});return effect;};});
      await motionPage.locator('[data-testid="field-check"]').first().check();
      await motionPage.waitForFunction(()=>JSON.parse(localStorage.getItem('geomarketing.field-checks.v1'))?.records[0]?.checks[0]);
      assert(await motionPage.evaluate(()=>window.fieldMotion.some(({effect,persisted})=>effect.id==='gm:field-check-saved'&&persisted)),'Persisted checkbox requires gentle check feedback');
      await motionPage.waitForFunction(()=>!document.getAnimations().some(effect=>effect.id==='gm:field-check-saved'&&effect.playState==='running'));
      assert(await motionPage.locator('.field-check-item').first().evaluate(el=>el.getBoundingClientRect().height>=44),'Check feedback keeps label hitbox stable');
      await motionPage.locator('[data-testid="field-check"]').first().uncheck();
      await motionPage.waitForFunction(()=>document.getAnimations().some(effect=>effect.id==='gm:field-check-saved'&&effect.playState==='running'));
      await motionPage.emulateMedia({reducedMotion:'reduce'});
      await motionPage.waitForFunction(()=>!document.getAnimations().some(effect=>effect.id==='gm:field-check-saved'&&effect.playState==='running'));
      const reducedEffects=await motionPage.evaluate(()=>window.fieldMotion.length);
      await motionPage.locator('[data-testid="field-check"]').first().check();await motionPage.waitForFunction(()=>JSON.parse(localStorage.getItem('geomarketing.field-checks.v1'))?.records[0]?.checks[0]);
      assert(await motionPage.evaluate(()=>window.fieldMotion.length)===reducedEffects,'Runtime reduced motion blocks subsequent check effects');
      await motionPage.emulateMedia({reducedMotion:'no-preference'});
      await motionPage.evaluate(()=>{const set=Storage.prototype.setItem;window.restoreMotionStorage=()=>{Storage.prototype.setItem=set;};Storage.prototype.setItem=function(key,value){if(key==='geomarketing.field-checks.v1')throw Error('quota');return set.call(this,key,value);};});
      await motionPage.locator('[data-testid="field-check"]').first().uncheck();await motionPage.waitForFunction(()=>document.querySelector('.field-check-status').textContent.includes('не сохранена'));
      assert(await motionPage.evaluate(()=>window.fieldMotion.length)===reducedEffects,'Failed persistence produces no success effect');
      await motionPage.evaluate(()=>window.restoreMotionStorage());
    }finally{await motionContext.close();}
    await page.goto(base);await page.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    assert(await page.locator('[data-testid="field-checks"]').count()===0,'Checklist is only for saved places');
    await page.locator('[data-testid="save-place"]').first().click();
    await page.waitForSelector('[data-testid="field-checks"]');
    const widget=page.locator('[data-testid="field-checks"]').first();
    assert(await widget.locator('input[type="checkbox"]').count()===7,'Seven checklist items required');
    await widget.locator('summary').click();await widget.locator('input').first().check();
    await page.waitForFunction(()=>JSON.parse(localStorage.getItem('geomarketing.field-checks.v1'))?.records[0]?.checks[0]);
    assert(await page.evaluate(()=>!document.getAnimations().some(effect=>effect.id==='gm:field-check-saved')),'Initial reduced motion prevents check effect');
    await page.reload();await page.waitForSelector('[data-testid="field-checks"]');
    assert(await page.locator('[data-testid="field-checks"] input').first().isChecked(),'Check persists after reload');
    await page.locator('[data-testid="save-place"]').nth(1).click();await page.waitForFunction(()=>document.querySelectorAll('[data-testid="field-checks"]').length===2);
    const savedBefore=await page.evaluate(()=>localStorage.getItem('geomarketing.saved.v1'));
    const other=await context.newPage();
    // Saved cards render before catalog loading starts. Hold that response to
    // exercise the bootstrap race: widget visibility alone is not analysis-ready.
    let releaseCatalog;
    const catalogGate=new Promise(resolve=>{releaseCatalog=resolve;});
    await other.route('**/api/catalog',async route=>{
      const response=await route.fetch();await catalogGate;await route.fulfill({response});
    });
    await other.goto(base);await other.waitForSelector('[data-testid="field-checks"]');
    const beforeInitialCalculation=calculations;
    assert(await other.evaluate(()=>document.documentElement.dataset.analysisState)==='initial','Saved checklist appears while delayed catalog is pending');
    releaseCatalog();
    await other.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
    assert(calculations===beforeInitialCalculation+1,'Delayed catalog completes exactly one initial calculation before checklist request baseline');
    const countBefore=calculations;
    await page.locator('[data-testid="field-checks"]').first().locator('summary').click();
    const focused=page.locator('[data-testid="field-checks"]').first().locator('input').nth(2);await focused.focus();
    await page.evaluate(()=>{window.fieldFocus=document.activeElement;window.fieldWidget=document.activeElement.closest('details');});
    await other.evaluate(async()=>{const {setFieldCheck}=await import('/static/js/field-check-storage.js'),{readSaved}=await import('/static/js/saved-places.js');await setFieldCheck(readSaved()[0].id,1,true,{readSaved});});
    await page.waitForFunction(()=>document.querySelector('[data-testid="field-checks"] input[data-check-index="1"]').checked);
    assert(await page.evaluate(()=>document.activeElement===window.fieldFocus),'Cross-tab check retains focus');
    await other.evaluate(async()=>{const {mutateSaved}=await import('/static/js/saved-places.js');await mutateSaved(latest=>({next:[...latest],message:'test'}));});
    await page.waitForTimeout(100);
    assert(await page.evaluate(()=>document.activeElement===window.fieldFocus&&window.fieldWidget===document.querySelector('[data-testid="field-checks"]')),'Saved event preserves widget and focus');
    await Promise.all([page.evaluate(async()=>{const {setFieldCheck}=await import('/static/js/field-check-storage.js'),{readSaved}=await import('/static/js/saved-places.js');await setFieldCheck(readSaved()[0].id,3,true,{readSaved});}),other.evaluate(async()=>{const {setFieldCheck}=await import('/static/js/field-check-storage.js'),{readSaved}=await import('/static/js/saved-places.js');await setFieldCheck(readSaved()[1].id,4,true,{readSaved});})]);
    const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('geomarketing.field-checks.v1')).records);
    assert(records[0].checks[0]&&records[0].checks[1]&&records[0].checks[3]&&records[1].checks[4],'Concurrent tabs preserve all checks');
    assert(await page.evaluate(()=>localStorage.getItem('geomarketing.saved.v1'))===savedBefore,'Checks do not modify saved schema');
    assert(calculations===countBefore,'Checks/disclosures never recalculate');
    assert(await page.locator('.field-check-item').first().evaluate(el=>el.getBoundingClientRect().height>=44),'Checkbox label has 44px touch area');
    await focused.press('Space');await page.waitForFunction(()=>JSON.parse(localStorage.getItem('geomarketing.field-checks.v1')).records[0].checks[2]);
    const modelBefore=await page.evaluate(async()=>JSON.stringify((await import('/static/js/state.js')).state.current));
    await page.evaluate(async()=>{
      const originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='geomarketing.field-checks.v1')throw new DOMException('quota','QuotaExceededError');return originalSet.call(this,key,value);};
      window.restoreFieldStorage=()=>{Storage.prototype.setItem=originalSet;};
      document.querySelector('[data-testid="field-checks"] input[data-check-index="5"]').click();return true;
    });
    await page.waitForFunction(()=>document.querySelector('.field-check-status').textContent.includes('не сохранена'));
    assert(!(await page.locator('[data-testid="field-checks"] input').nth(5).isChecked()),'Failed quota write rolls back persisted state');
    await page.evaluate(()=>window.restoreFieldStorage());
    await page.evaluate(()=>{
      const descriptor=Object.getOwnPropertyDescriptor(navigator,'locks');
      Object.defineProperty(navigator,'locks',{configurable:true,value:{request(){return new Promise((resolve,reject)=>{window.rejectFieldWrite=()=>reject(new DOMException('denied','SecurityError'));});}}});
      window.restoreFieldLocks=()=>{if(descriptor)Object.defineProperty(navigator,'locks',descriptor);else delete navigator.locks;};
      document.querySelector('[data-testid="field-checks"] input[data-check-index="6"]').click();
    });
    await other.evaluate(async()=>{const {setFieldCheck}=await import('/static/js/field-check-storage.js'),{readSaved}=await import('/static/js/saved-places.js');await setFieldCheck(readSaved()[0].id,6,true,{readSaved});});
    await page.evaluate(()=>window.rejectFieldWrite());await page.waitForFunction(()=>document.querySelector('.field-check-status').textContent.includes('не сохранена'));
    assert(await page.locator('[data-testid="field-checks"] input').nth(6).isChecked(),'Rejected completion refreshes latest cross-tab persisted value');
    await page.evaluate(()=>window.restoreFieldLocks());
    const deletionFailure=await page.evaluate(async()=>{
      const {mutateSaved,readSaved}=await import('/static/js/saved-places.js');
      const saved=localStorage.getItem('geomarketing.saved.v1'),field=localStorage.getItem('geomarketing.field-checks.v1'),id=readSaved()[0].id,original=Storage.prototype.setItem;
      Storage.prototype.setItem=function(key,value){if(key==='geomarketing.saved.v1')throw new DOMException('quota','QuotaExceededError');return original.call(this,key,value);};
      try {const outcome=await mutateSaved(latest=>({next:latest.filter(item=>item.id!==id),message:'removed'}),false,id);return !outcome.persisted&&localStorage.getItem('geomarketing.saved.v1')===saved&&localStorage.getItem('geomarketing.field-checks.v1')===field;}
      finally {Storage.prototype.setItem=original;}
    });
    assert(deletionFailure,'Failed saved deletion preserves saved and checklist raw');
    await page.evaluate(()=>{localStorage.setItem('geomarketing.field-checks.v1','{broken');window.dispatchEvent(new StorageEvent('storage',{key:'geomarketing.field-checks.v1'}));});
    assert(await page.locator('[data-testid="field-checks"] input').first().isDisabled(),'Corruption disables writes');
    page.once('dialog',dialog=>dialog.dismiss());await page.locator('.field-check-reset').first().click();
    assert(await page.evaluate(()=>localStorage.getItem('geomarketing.field-checks.v1'))==='{broken','Recovery cancellation preserves raw');
    page.once('dialog',dialog=>dialog.accept());await page.locator('.field-check-reset').first().click();
    await page.waitForFunction(()=>localStorage.getItem('geomarketing.field-checks.v1')===null);
    await page.evaluate(()=>{localStorage.setItem('geomarketing.field-checks.v1','{"schema_version":2,"records":[]}');window.dispatchEvent(new StorageEvent('storage',{key:'geomarketing.field-checks.v1'}));});
    assert(await page.locator('.field-check-reset').first().isHidden(),'Future schema offers no reset');
    assert(await page.evaluate(async()=>JSON.stringify((await import('/static/js/state.js')).state.current))===modelBefore,'Checklist failure/recovery leaves model unchanged');
    await page.evaluate(()=>{localStorage.removeItem('geomarketing.field-checks.v1');window.dispatchEvent(new StorageEvent('storage',{key:'geomarketing.field-checks.v1'}));});
    await page.locator('[data-testid="field-checks"] input').first().check();await page.waitForFunction(()=>localStorage.getItem('geomarketing.field-checks.v1')!==null);
    const deletedId=await page.locator('[data-testid="saved-card"]').first().getAttribute('data-saved-id');
    await page.locator('[data-testid="saved-card"]').first().getByRole('button',{name:/Удалить/}).click();
    await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('geomarketing.saved.v1')).some(item=>item.id===id),deletedId);
    const late=await other.evaluate(async id=>{const {setFieldCheck}=await import('/static/js/field-check-storage.js'),{readSaved}=await import('/static/js/saved-places.js');try{await setFieldCheck(id,6,true,{readSaved});return 'unexpected';}catch(error){return error.code;}},deletedId);
    assert(late==='missing','Late write cannot revive deleted checklist');
    assert(await page.evaluate(id=>!(JSON.parse(localStorage.getItem('geomarketing.field-checks.v1'))?.records||[]).some(item=>item.place_id===id),deletedId),'Saved deletion cleans only its checklist');
    const incompleteCleanup=await page.evaluate(async()=>{
      const {readSaved,mutateSaved}=await import('/static/js/saved-places.js'),{setFieldCheck}=await import('/static/js/field-check-storage.js');
      const id=readSaved()[0].id;await setFieldCheck(id,0,true,{readSaved});const raw=localStorage.getItem('geomarketing.field-checks.v1'),original=Storage.prototype.removeItem;
      Storage.prototype.removeItem=function(key){if(key==='geomarketing.field-checks.v1')throw new DOMException('denied','SecurityError');return original.call(this,key);};
      try{const result=await mutateSaved(latest=>({next:latest.filter(item=>item.id!==id),message:'removed'}),false,id);return result.persisted&&result.cleanupFailed&&!readSaved().some(item=>item.id===id)&&localStorage.getItem('geomarketing.field-checks.v1')===raw&&document.querySelector('#storage-status').textContent.includes('Место удалено');}
      finally{Storage.prototype.removeItem=original;}
    });
    assert(incompleteCleanup,'Saved deletion persists and reports incomplete cleanup truthfully');
    await page.evaluate(async saved=>{localStorage.setItem('geomarketing.saved.v1',saved);const {loadSaved,renderSaved}=await import('/static/js/saved-places.js');loadSaved();renderSaved();},savedBefore);
    await page.evaluate(()=>{const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{blob.text().then(text=>window.fieldCsv=text);return create(blob);};window.print=()=>{window.fieldPrint=true;};});
    await page.locator('#export-csv').click();await page.waitForFunction(()=>typeof window.fieldCsv==='string');
    assert(await page.evaluate(()=>window.fieldCsv.includes('Относительная оценка (только внутри расчёта)')&&window.fieldCsv.includes('Свежесть данных')&&!window.fieldCsv.includes('Проверка пользователя')),'CSV original schema preserved');
    await page.locator('#print-report').click();assert(await page.evaluate(()=>window.fieldPrint&&document.querySelectorAll('#print-report-content .report-place').length>=3),'Print current report remains complete');
    for(const mode of ['no-lock','blocked-getter','blocked-storage','throwing-widget-getters','long-id']){
      const isolated=await original.context().browser().newContext(),tab=await isolated.newPage();
      try{
        await tab.addInitScript(({saved,mode})=>{
          localStorage.setItem('geomarketing.saved.v1',saved);
          if(mode==='no-lock')Object.defineProperty(navigator,'locks',{configurable:true,value:undefined});
          if(mode==='blocked-getter')Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});
          if(mode==='blocked-storage')Storage.prototype.getItem=function(key){if(key==='geomarketing.field-checks.v1')throw new DOMException('blocked','SecurityError');return key==='geomarketing.saved.v1'?saved:null;};
          if(mode==='long-id'){const items=JSON.parse(saved);items[0].analysis_id='legacy'.repeat(30);items[0].id=items[0].analysis_id+':'+items[0].recommendation.rank;localStorage.setItem('geomarketing.saved.v1',JSON.stringify(items));}
        },{saved:savedBefore,mode});
        await tab.goto(base);await tab.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
        if(mode==='blocked-getter')assert(await tab.locator('#map canvas, #map .leaflet-pane').count()>0,'Blocked global getter leaves map usable');
        else if(mode==='throwing-widget-getters'){
          const safe=await tab.evaluate(async()=>{const {fieldChecksBlock}=await import('/static/js/field-checks.js');const storage=Object.getOwnPropertyDescriptor(window,'localStorage'),locks=Object.getOwnPropertyDescriptor(navigator,'locks');try{Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('denied','SecurityError');}});Object.defineProperty(navigator,'locks',{configurable:true,get(){throw new DOMException('denied','SecurityError');}});const widget=fieldChecksBlock('a');return widget.querySelectorAll('input:disabled').length===7;}finally{Object.defineProperty(window,'localStorage',storage);if(locks)Object.defineProperty(navigator,'locks',locks);else delete navigator.locks;}});
          assert(safe,'Throwing getters during widget construction fail closed');
        }else {await tab.waitForSelector('[data-testid="field-checks"]');assert(await tab.locator('[data-testid="field-checks"] input').first().isDisabled(),`${mode} checklist readonly`);if(mode==='long-id')assert(await tab.locator('[data-testid="saved-card"]').count()===2,'Legacy long-ID saved cards stay usable');}
      }finally{await isolated.close();}
    }
    assert(errors.length===0,`No page errors: ${errors.join(', ')}`);
    return 'PASS persisted-check finite feedback/initial+runtime reduced motion/failure no-effect, checklist creation, keyboard/touch44, reload, real two tabs/latest writes, focus, quota/latest rollback, corrupt/recovery cancel/reset, future schema, model/API unchanged, failed deletion/incomplete cleanup/late write, CSV/print, blocked storage/getters/no locks/legacy IDs';
  }finally{await context.close();}
}
