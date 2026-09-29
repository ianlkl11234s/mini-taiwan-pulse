import test from 'node:test';
import assert from 'node:assert/strict';
import {homographyForQuad,transformPoint,projectImagePoint} from './projection.js';
const quad=[[.4,.3],[.6,.3],[.95,.95],[.05,.95]];
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('perspective quad maps all authored corners and preserves near/far ordering',()=>{
 const h=homographyForQuad(quad),targets=[[-.5,1],[.5,1],[.5,0],[-.5,0]];
 quad.forEach(([x,y],i)=>{const p=transformPoint(h,{x,y});near(p.u,targets[i][0]);near(p.v,targets[i][1]);});
 assert.ok(transformPoint(h,{x:.5,y:.5}).v>transformPoint(h,{x:.5,y:.8}).v);
});
test('degenerate geometry and horizon fail closed',()=>{
 assert.equal(homographyForQuad([[0,0],[.2,0],[.5,0],[1,0]]),null);
 assert.equal(transformPoint([1,0,0,0,1,0,1,0,0],{x:0,y:1}),null);
});
test('view direction flips both road axes without changing authored scale',()=>{
 const c={lon:121.55281,lat:25.03316},config={perspectiveQuad:quad,approximateWidthMeters:24,approximateLengthMeters:100};
 const e=projectImagePoint(c,{x:.6,y:.3},config,1),w=projectImagePoint(c,{x:.6,y:.3},config,-1);
 near(e.x,108);near(e.z,12);near(w.x,-108);near(w.z,-12);
 assert.equal(projectImagePoint(c,{x:.9,y:.1},config,1),null);
});
test('north-facing camera maps image right to east and far depth to north',()=>{
 const c={lon:121.55281,lat:25.03316};
 const config={perspectiveQuad:quad,approximateWidthMeters:24,approximateLengthMeters:100,
   assumedViewDirection:'N'};
 const farLeft=projectImagePoint(c,{x:.4,y:.3},config);
 const farRight=projectImagePoint(c,{x:.6,y:.3},config);
 const nearRight=projectImagePoint(c,{x:.95,y:.95},config);
 near(farLeft.x,-12);near(farLeft.z,-108);
 near(farRight.x,12);near(farRight.z,-108);
 near(nearRight.x,12);near(nearRight.z,-8);
 const fallback=projectImagePoint(c,{x:.6,y:.3},{assumedViewDirection:'N'});
 assert.ok(fallback.x>0&&fallback.z<0);
});
