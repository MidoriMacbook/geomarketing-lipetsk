// Эта подсказка работает после получения HTML; ответ 503 самого хостинга ей не заменить.
(() => {
  const root=document.documentElement;
  let waiting=false;
  const done=()=>['success','error'].includes(root.dataset.analysisState);
  const show=()=>{
    if(done()){clearTimeout(timer);observer.disconnect();return;}
    if(!waiting)return;
    for(const id of ['mobile-settings-state','analysis-status']){
      const target=document.getElementById(id);
      if(target)target.textContent='Сервис просыпается…';
    }
  };
  const observer=new MutationObserver(show);
  const timer=setTimeout(()=>{waiting=true;show();},3000);
  observer.observe(root,{attributes:true,attributeFilter:['data-analysis-state']});
  if(done()){clearTimeout(timer);observer.disconnect();}
})();
