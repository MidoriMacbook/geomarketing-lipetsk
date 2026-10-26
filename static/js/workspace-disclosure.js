import { motionReduced } from './ui.js';

const controllers=new WeakMap();
export function initWorkspaceDisclosure(details,onChange=()=>{}) {
 if(!details)return null;
 if(controllers.has(details))return controllers.get(details);
 const summary=details.querySelector(':scope>summary'),body=details.querySelector(':scope>.workspace-disclosure-body');
 if(!summary||!body)return null;
 let wanted=details.open,timer=null;
 const finish=()=>{
  clearTimeout(timer);timer=null;
  details.open=wanted;details.dataset.expanded=String(wanted);
  summary.setAttribute('aria-expanded',String(wanted));body.inert=false;
 };
 const setOpen=(open,{immediate=false}={})=>{
  open=Boolean(open);clearTimeout(timer);timer=null;
  if(!open&&body.contains(document.activeElement))summary.focus({preventScroll:true});
  wanted=open;
  body.inert=!open;
  if(!details.open){details.open=true;body.getBoundingClientRect();}
  details.dataset.expanded=String(open);summary.setAttribute('aria-expanded',String(open));
  if(immediate||motionReduced())finish();
  else timer=setTimeout(finish,310);
  onChange(open);
 };
 summary.addEventListener('click',event=>{event.preventDefault();setOpen(!wanted);});
 details.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||!wanted||event.defaultPrevented)return;
  event.preventDefault();setOpen(false);summary.focus({preventScroll:true});
 });
 details.addEventListener('toggle',()=>{
  if(timer!==null||details.open===wanted)return;
  wanted=details.open;finish();onChange(wanted);
 });
 matchMedia('(prefers-reduced-motion:reduce)').addEventListener('change',event=>{if(event.matches)finish();});
 window.addEventListener('beforeprint',finish);
 const controller={setOpen,finish,get open(){return wanted;}};
 controllers.set(details,controller);finish();return controller;
}
