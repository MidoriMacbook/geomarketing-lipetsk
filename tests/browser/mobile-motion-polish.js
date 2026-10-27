async original=>{
 const base=new URL(original.url()).origin,ctx=await original.context().browser().newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 const check=(ok,msg)=>{if(!ok)throw Error(msg)};p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto(base);await p.waitForFunction(()=>document.documentElement.dataset.analysisState==='success');
 const card=p.getByTestId('recommendation-card').first(),body=card.locator('.recommendation-body'),toggle=card.locator('.mobile-rec-toggle');
 await card.scrollIntoViewIfNeeded();await p.waitForTimeout(350);const full=await body.evaluate(e=>e.getBoundingClientRect().height);
 await toggle.click();await p.waitForTimeout(70);const middle=await body.evaluate(e=>e.getBoundingClientRect().height);
 check(middle>0&&middle<full,'Подробности закрываются скачком вместо перехода');
 await p.waitForTimeout(280);check(await body.evaluate(e=>e.inert&&e.getBoundingClientRect().height<1),'Закрытая карточка оставляет доступный контент');
 await toggle.click();await p.waitForTimeout(40);await toggle.evaluate(e=>e.click());await p.waitForTimeout(40);await toggle.evaluate(e=>e.click());await p.waitForTimeout(350);
 check(await toggle.getAttribute('aria-expanded')==='true'&&await body.evaluate(e=>!e.inert&&e.getBoundingClientRect().height>0),'Быстрое переключение оставило промежуточное состояние');
 await toggle.click();await p.waitForTimeout(260);await toggle.click();check(await p.locator('.recommendation-pin').evaluateAll(nodes=>nodes.some(e=>e.getAnimations().some(a=>a.id==='gm:marker-pulse'))),'Повторное раскрытие не подчёркивает выбранный маркер');
 await p.locator('#mobile-settings-open').tap();await p.waitForTimeout(330);check((await p.locator('.mobile-settings-label').textContent()).includes('Изменить'),'Кнопка не отражает наличие результата');
 check(await p.locator('#mobile-settings-dialog').evaluate(e=>getComputedStyle(e,'::before').content!=='none'),'Нет декоративного хватателя');
 await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('mobile-settings-dialog').open);
 await p.locator('#kpi-residents').locator('..').locator('.kpi-replay').tap();
 check(await p.locator('.kpi-wave').count()===1,'Нет локального отклика KPI');check((await p.locator('#kpi-residents').locator('..').locator('.kpi-action-label').textContent()).includes('Снять'),'Подпись KPI не меняется');await p.keyboard.press('Escape');
 await p.emulateMedia({reducedMotion:'reduce'});await toggle.evaluate(e=>e.click());check(await body.evaluate(e=>e.inert&&e.getBoundingClientRect().height<1&&e.getAnimations().length===0),'Закрытие при уменьшении движения не мгновенное');
 check(errors.length===0,errors.join('; '));return {ok:true,collapse:{full,middle},pageErrors:errors};
 }finally{await ctx.close()}
}
