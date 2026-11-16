// Same WCAG sRGB compositing method used by tests/browser/redesign.js.
// Geometry checks are limited to component shells; chart circles and table cells
// are intentional shapes, not radius/spacing tokens.
export function auditPresentation(){
 const issues=[],exceptions=[],allowedRadii=[0,8,12,16,20,24],allowedSpace=[0,4,8,12,16,24,32];
 const visible=el=>el.clientWidth>0&&el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})&&!el.closest('[hidden],[inert],[aria-hidden="true"]');
 const label=el=>el.id?`#${el.id}`:`${el.tagName.toLowerCase()}.${String(el.className).trim().replaceAll(' ','.')}`;
 if(document.documentElement.scrollWidth>innerWidth+1)issues.push({kind:'page-overflow',value:document.documentElement.scrollWidth-innerWidth});
 const shells='.recommendation,.saved-card,.scenario-card,.comparison,#selection-note,.notice,.kpi-card,.hero-steps article,.settings,.map-card,.site-header,.choice-trigger,.button,.sheet-place';
 for(const el of document.querySelectorAll('.recommendation.selected')){
  if(!visible(el))continue;const s=getComputedStyle(el);
  if(!s.boxShadow.includes('inset')||s.borderLeftColor!==s.borderRightColor||s.borderTopColor!==s.borderBottomColor)issues.push({kind:'selected-outline',id:label(el),shadow:s.boxShadow});
 }
 for(const el of document.querySelectorAll(shells)){
  if(!visible(el))continue;const s=getComputedStyle(el),id=label(el);
  const radius=['borderTopLeftRadius','borderTopRightRadius','borderBottomLeftRadius','borderBottomRightRadius'].map(k=>s[k]);
  if(radius.some(v=>v.includes('%')||!allowedRadii.includes(parseFloat(v))))issues.push({kind:'radius',id,value:radius});
  const pad=['paddingTop','paddingRight','paddingBottom','paddingLeft'].map(k=>parseFloat(s[k]));
  if(pad.some(v=>!allowedSpace.includes(v)))issues.push({kind:'padding-scale',id,value:pad});
  if(Math.abs(pad[1]-pad[3])>.5||Math.abs(pad[0]-pad[2])>.5)issues.push({kind:'asymmetric-padding',id,value:pad});
  if(el.scrollWidth>el.clientWidth+1&&!['auto','scroll'].includes(s.overflowX))issues.push({kind:'component-overflow',id,value:el.scrollWidth-el.clientWidth});
 }
 const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
 const blend=(front,back)=>front.slice(0,3).map((c,i)=>c*(front[3]??1)+back[i]*(1-(front[3]??1)));
 const bg=el=>{const chain=[];for(let n=el;n;n=n.parentElement)chain.unshift(n);return chain.reduce((color,n)=>blend(rgb(getComputedStyle(n).backgroundColor),color),[255,255,255]);};
 const lum=c=>c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
 let textCount=0,minContrast=Infinity;
 for(const el of document.querySelectorAll('p,span,small,strong,button,a,label,h1,h2,h3,summary,td,th,dt,dd,li')){
  if(!visible(el)||el.closest('svg,.leaflet-container,button:disabled,[aria-disabled="true"]')||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
  const s=getComputedStyle(el);if(s.backgroundImage!=='none'){exceptions.push({kind:'gradient',id:label(el)});continue;}
  const background=bg(el),fg=lum(blend(rgb(s.color),background)),back=lum(background),ratio=(Math.max(fg,back)+.05)/(Math.min(fg,back)+.05),size=parseFloat(s.fontSize),minimum=size>=24||(size>=18.66&&Number(s.fontWeight)>=700)?3:4.5;
  textCount++;minContrast=Math.min(minContrast,ratio);
  if(ratio+.01<minimum)issues.push({kind:'contrast',id:label(el),text:el.textContent.trim().slice(0,90),ratio,minimum});
 }
 for(const group of document.querySelectorAll('.place-actions,.saved-card-actions,.scenario-card-actions,.workspace-actions')){
  const actions=[...group.querySelectorAll('button,a')].filter(visible),weights=[...new Set(actions.map(el=>getComputedStyle(el).fontWeight))];
  if(weights.length>1)issues.push({kind:'button-weight',id:label(group),value:weights});
 }
 return {issues,exceptions,textCount,minContrast:Number.isFinite(minContrast)?minContrast:null};
}
