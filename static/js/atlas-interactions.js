import {motionReduced,animateUI} from './ui.js';
import './result-sheet.js';

// Только представление. Расчёт, состояние и сохранения принадлежат прежним модулям.
const root=document.documentElement;
const visibility=()=>{root.dataset.pageVisible=String(!document.hidden);};
document.addEventListener('visibilitychange',visibility);visibility();
document.addEventListener('click',event=>{
 const target=event.target.closest('.button');
 if(!target||target.disabled||motionReduced())return;
 animateUI(target,[{opacity:.75},{opacity:1}],'press-ring',{duration:350});
});

