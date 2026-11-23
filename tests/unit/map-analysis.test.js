import test from 'node:test';
import assert from 'node:assert/strict';
import {interpolateGrid,createMapAnalysis,projectPoint} from '../../static/js/map-analysis.js';
const grid={n:2,lat_min:0,lat_max:1,lng_min:0,lng_max:1,scores:[0,.2,.6,1]};
test('билинейная оценка совпадает с узлами и смешивает четыре угла',()=>{
 for(const [lat,lng,value] of [[0,0,0],[0,1,.2],[1,0,.6],[1,1,1],[.5,.5,.45]])assert.ok(Math.abs(interpolateGrid(grid,{lat,lng})-value)<1e-12);
 assert.equal(interpolateGrid(grid,{lat:2,lng:.5}),null);
 assert.equal(interpolateGrid({...grid,scores:[0,null,.6,1]},{lat:.5,lng:.5}),null);
});
const center=[52.6,39.6];
const at=(x,y,residents)=>({lat:center[0]+y/111000,lng:center[1]+x/(111000*Math.cos(center[0]*Math.PI/180)),residents});
const data={center,half_m:1000,parameters:{radius_m:350},houses:[at(350,0,100),at(350.01,0,200),at(0,0,50)],competitors:[at(0,350)],centroids:[at(0,0,350)],recommendations:[{score:.9,residents_in_radius:500}],grid:{n:2,lat_min:52.59,lat_max:52.61,lng_min:39.58,lng_max:39.62,scores:[.5,.5,.5,.5]}};
test('метрическая граница совпадает с серверной, ближайший и разница честные',()=>{
 const analysis=createMapAnalysis(data),result=analysis.sample(at(0,0));
 assert.ok(Math.abs(projectPoint(at(350,0),center)[0]-350)<1e-6);
 assert.equal(result.recommendation.residents_in_radius,150);assert.equal(result.recommendation.competitors_in_radius,1);assert.equal(result.recommendation.nearest_competitor_m,350);
 assert.deepEqual(result.difference,{score:-40,residents:-350});
 assert.deepEqual(analysis.sample(at(1001,0)),{inside:false});
 assert.equal(createMapAnalysis({...data,competitors:[]}).sample(at(0,0)).recommendation.nearest_competitor_m,null);
});
test('общая аудитория считается по домам, знаменатель — объединение охвата',()=>{
 const analysis=createMapAnalysis(data),a={...at(0,0),radius_m:350},b={...at(700,0),radius_m:350};
 const result=analysis.overlap(a,b);assert.equal(result.houses,1);assert.equal(result.residents,100);assert.equal(result.union,350);assert.ok(Math.abs(result.percent-100/350*100)<1e-8);
 const empty=createMapAnalysis({...data,houses:[]}).overlap(a,b);assert.equal(empty.percent,null);
});
