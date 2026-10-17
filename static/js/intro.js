import { $, motionReduced } from './ui.js';

let initialized=false;
const SESSION_KEY='geomarketing.intro.v1';

// Only visual glyphs change. The accessible name and the occupied lines are final
// from the start; restore the original text nodes on completion or cancellation.
export function initHeadline() {
  if(initialized)return;
  initialized=true;
  const heading=$('page-title');
  if(!heading)return;
  try {
    if(sessionStorage.getItem(SESSION_KEY))return;
    sessionStorage.setItem(SESSION_KEY,'seen');
  }catch { /* Storage restrictions still allow a single entrance per page. */ }
  if(motionReduced()||document.hidden||!heading.animate)return;
  const label=heading.cloneNode(true);
  label.querySelectorAll('br').forEach(br=>br.replaceWith(' '));
  const originalLabel=heading.getAttribute('aria-label');
  heading.setAttribute('aria-label',label.textContent.replace(/\s+/g,' ').trim());
  const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT),sources=[];
  while(walker.nextNode())sources.push(walker.currentNode);
  const runs=[],glyphs=[],animations=[];
  let finished=false;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),print=matchMedia('print');
  const finish=()=>{
    if(finished)return;
    finished=true;
    animations.forEach(animation=>animation.cancel());
    runs.forEach(([source,run])=>run.replaceWith(source));
    if(originalLabel===null)heading.removeAttribute('aria-label');
    else heading.setAttribute('aria-label',originalLabel);
    reduced.removeEventListener('change',onMedia);
    print.removeEventListener('change',onMedia);
    document.removeEventListener('visibilitychange',onVisibility);
    window.removeEventListener('beforeprint',finish);
  };
  const onMedia=event=>{if(event.matches)finish();};
  const onVisibility=()=>{if(document.hidden)finish();};
  reduced.addEventListener('change',onMedia);
  print.addEventListener('change',onMedia);
  document.addEventListener('visibilitychange',onVisibility);
  window.addEventListener('beforeprint',finish);
  try {
    for(const source of sources){
      const run=document.createElement('span');
      run.setAttribute('aria-hidden','true');
      for(const char of Array.from(source.textContent)){
        const glyph=document.createElement('span');
        glyph.className='typed-char';
        glyph.textContent=char;
        run.append(glyph);
        glyphs.push(glyph);
      }
      source.replaceWith(run);
      runs.push([source,run]);
    }
    const styles=getComputedStyle(document.documentElement);
    const step=parseFloat(styles.getPropertyValue('--motion-type-step'))||38;
    glyphs.forEach((glyph,index)=>{
      const animation=glyph.animate([{opacity:0},{opacity:1}],{
        duration:step,delay:index*step,easing:'steps(1,end)',fill:'backwards'
      });
      animation.id='gm:headline';
      animations.push(animation);
    });
    Promise.all(animations.map(animation=>animation.finished)).then(finish,finish);
  }catch {finish();}
}
