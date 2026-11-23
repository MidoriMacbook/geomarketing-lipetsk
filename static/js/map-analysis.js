// Клиентская проверка существующей поверхности. Формулу балла здесь не повторяем.
const finite=Number.isFinite;
export const projectPoint=(point,center)=>[(point.lng-center[1])*111000*Math.cos(center[0]*Math.PI/180),(point.lat-center[0])*111000];
const distance2=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
export function interpolateGrid(grid,point){
 if(!grid||!finite(point.lat)||!finite(point.lng)||!Number.isInteger(grid.n)||grid.n<2||!Array.isArray(grid.scores)||grid.scores.length!==grid.n**2)return null;
 const dx=grid.lng_max-grid.lng_min,dy=grid.lat_max-grid.lat_min;
 if(!(dx>0&&dy>0))return null;
 const x=(point.lng-grid.lng_min)/dx*(grid.n-1),y=(point.lat-grid.lat_min)/dy*(grid.n-1),last=grid.n-1;
 if(x<-.000001||y<-.000001||x>last+.000001||y>last+.000001)return null;
 const u=Math.max(0,Math.min(last,x)),v=Math.max(0,Math.min(last,y));
 const col=Math.min(last-1,Math.floor(u)),row=Math.min(last-1,Math.floor(v)),tx=u-col,ty=v-row;
 const values=[grid.scores[row*grid.n+col],grid.scores[row*grid.n+col+1],grid.scores[(row+1)*grid.n+col],grid.scores[(row+1)*grid.n+col+1]];
 if(!values.every(n=>finite(n)&&n>=0&&n<=1))return null;
 return (values[0]*(1-tx)+values[1]*tx)*(1-ty)+(values[2]*(1-tx)+values[3]*tx)*ty;
}
export function createMapAnalysis(data){
 const center=data.center,radius=data.parameters.radius_m;
 const houses=data.houses.map((house,index)=>({...house,index,xy:projectPoint(house,center)}));
 const competitors=data.competitors.map((point,index)=>({...point,index,xy:projectPoint(point,center)}));
 const centroids=data.centroids.map((point,index)=>({...point,index,xy:projectPoint(point,center)}));
 function coverage(point,r=radius){
  const xy=projectPoint(point,center),limit=r*r;
  const members=houses.filter(h=>distance2(h.xy,xy)<=limit+1e-6),nearby=competitors.filter(c=>distance2(c.xy,xy)<=limit+1e-6);
  let nearest=null,demand=null,nearestDistance=Infinity,demandDistance=Infinity;
  for(const c of competitors){const d=distance2(c.xy,xy);if(d<nearestDistance){nearest=c;nearestDistance=d;}}
  for(const c of centroids){const d=distance2(c.xy,xy);if(d<demandDistance){demand=c;demandDistance=d;}}
  return {members,nearby,nearest,demand,residents:Math.round(members.reduce((sum,h)=>sum+h.residents,0)),nearestDistance:nearest?Math.sqrt(nearestDistance):null,demandDistance:demand?Math.sqrt(demandDistance):null};
 }
 function sample(point){
  const xy=projectPoint(point,center);
  if(!finite(xy[0])||!finite(xy[1])||distance2(xy,[0,0])>data.half_m**2+1e-6)return {inside:false};
  const score=interpolateGrid(data.grid,point);if(score===null)return {inside:true,available:false};
  const values=coverage(point),best=data.recommendations[0];
  return {inside:true,available:true,coverage:values,recommendation:{rank:0,origin:'manual',lat:point.lat,lng:point.lng,score,radius_m:radius,residents_in_radius:values.residents,competitors_in_radius:values.nearby.length,nearest_competitor_m:values.nearestDistance===null?null:Math.round(values.nearestDistance)},
   difference:best?{score:Math.round(score*100)-Math.round(best.score*100),residents:values.residents-best.residents_in_radius}:null};
 }
 function overlap(a,b){
  const left=coverage(a,a.radius_m),right=coverage(b,b.radius_m),ids=new Set(right.members.map(h=>h.index)),shared=left.members.filter(h=>ids.has(h.index));
  const residents=Math.round(shared.reduce((sum,h)=>sum+h.residents,0)),union=left.residents+right.residents-residents;
  return {houses:shared.length,residents,union,percent:union>0?100*residents/union:null,shared};
 }
 return {houses,competitors,centroids,coverage,sample,overlap};
}
export function manualPlaceId(analysisId,rec){return `${analysisId}:manual:${rec.lat.toFixed(7)}:${rec.lng.toFixed(7)}`;}
export const placeLabel=rec=>rec.origin==='manual'?'выбрано вручную':`место ${rec.rank}`;
