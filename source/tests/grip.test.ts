import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3 as V} from 'three';
import {defaultConfig, getRelease, simulate, samplePose, validateConfig, analyzeGrip} from '../lib/disc/engine.ts';
import {allocateFriction, frictionStep, defaultGrip, simulateGrip} from '../lib/disc/grip.ts';

const near = (a:number,b:number,tolerance=1e-7) => assert.ok(Math.abs(a-b)<tolerance,`${a} ≠ ${b}`);

test('inverse contact allocation reproduces both resultant force and torque',()=>{
  const offsets=[new V(-.04,0,.06),new V(.03,0,.07),new V(.01,0,.1)];
  const force=new V(3,0,-2),torque=.7,weights=[.5,.25,.25];
  const result=allocateFriction(force,torque,offsets,weights,.6);
  assert.ok(result.feasible);
  assert.ok(result.forces.reduce((sum,f)=>sum.add(f),new V()).distanceTo(force)<1e-10);
  near(result.forces.reduce((sum,f,i)=>sum+offsets[i].z*f.x-offsets[i].x*f.z,0),torque);
  result.forces.forEach((f,i)=>assert.ok(f.length()<=.6*result.requiredNormal!*weights[i]+1e-9));
  assert.equal(allocateFriction(force,torque,offsets,weights,0).requiredNormal,null);
  assert.equal(allocateFriction(force,torque,[new V(),new V(),new V()],weights,.6).feasible,false);
});

test('finite friction impulses respect each contact limit and dissipate relative kinetic energy',()=>{
  const offsets=[new V(.03,0,.11),new V(-.03,0,.11),new V(0,0,.08)];
  for(const spin of [-100,0,100])for(const load of [0,.01,1]){
    const result=frictionStep(new V(3,0,-2),spin,offsets,[load,load*.5,load*.5],.175,.002352);
    result.impulses.forEach((impulse,i)=>assert.ok(impulse.length()<=[load,load*.5,load*.5][i]+1e-10));
    assert.ok(result.relativeWork<=1e-8);
  }
});

test('analytic centered grip reports m*a demand and holds above its static threshold',()=>{
  const c=defaultConfig();
  c.grip={...defaultGrip(),enabled:true,normalForce:20,contacts:[
    {id:'thumb',u:0,v:0,weight:.5},{id:'index',u:.4,v:.2,weight:.25},{id:'middle',u:-.4,v:-.2,weight:.25},
  ]};
  const base=samplePose(c,0);
  const run=simulateGrip(c,t=>({pose:{...base,center:new V(t*t,1,0)},
    v:new V(2*t,0,0),acceleration:new V(2,0,0),omega:new V(),alpha:new V()}));
  near(run.peakRequiredFriction,.35);
  near(run.peakRequiredNormal!, .35/.6);
  assert.equal(run.firstSlipTime,null);
  near(run.states.at(-1)!.p.x,c.duration*c.duration);
});

test('ideal mode ignores finite grip while strong real grip reproduces the prescribed release',()=>{
  const c=defaultConfig(),ideal=getRelease(c);
  c.grip={...defaultGrip(),normalForce:0,staticFriction:0,kineticFriction:0};
  const off=simulate(c);
  assert.deepEqual(off.release,ideal);
  c.grip={...defaultGrip(),enabled:true,normalForce:2000};
  const strong=simulate(c);
  assert.equal(strong.grip.firstSlipTime,null);
  assert.deepEqual(strong.release,ideal);
});

test('weak grip slips, loses contacts, and hands continuous state to free flight',()=>{
  const c=defaultConfig();c.grip={...defaultGrip(),enabled:true,normalForce:20};
  const s=simulate(c);
  assert.ok(s.grip.firstSlipTime!==null);
  assert.ok(s.releaseTime<c.duration*c.releasePhase);
  assert.equal(s.grip.releaseReason,'contacts-lost');
  assert.ok(s.grip.maxDisplacement>0);
  const last=s.grip.states.at(-1)!;
  assert.ok(last.p.distanceTo(s.frames[0].p)<1e-10);
  assert.ok(last.v.distanceTo(s.frames[0].v)<1e-10);
  near(last.q.angleTo(s.frames[0].q),0);
  assert.ok(s.grip.samples.every(sample=>sample.frictionPower<=1e-7));
  assert.equal(s.grip.samples.find(sample=>sample.t===s.grip.firstSlipTime)?.status,'sliding');
  for(const sample of s.grip.samples.filter(sample=>sample.t>=s.releaseTime)){
    assert.equal(sample.status,'released');
    assert.equal(sample.appliedFriction,0);
    assert.equal(sample.staticCapacity,0);
    assert.ok(sample.contactForces.every(force=>force===0));
  }
});

test('zero normal load releases immediately and old configurations acquire ideal grip defaults',()=>{
  const c=defaultConfig();delete c.grip;
  assert.equal(validateConfig(c).grip!.enabled,false);
  c.grip={...defaultGrip(),enabled:true,normalForce:0};
  const s=simulate(c);
  near(s.releaseTime,0);assert.equal(s.grip.releaseReason,'zero-grip');
  assert.throws(()=>validateConfig({...c,grip:{...c.grip,kineticFriction:.9,staticFriction:.2}}));
  assert.throws(()=>validateConfig({...c,grip:{...c.grip,contacts:[]}}));
});

test('left and right hand mirror grip motion and inferred forces',()=>{
  for(const type of ['forehand','backhand'] as const){
    const c=defaultConfig(type);c.grip={...defaultGrip(type),enabled:true};
    const right=simulate(c),left=simulate({...c,handedness:'left'});
    near(right.releaseTime,left.releaseTime,1/960);
    near(right.release.speed,left.release.speed,1e-5);
    near(right.release.spin,-left.release.spin,1e-4);
    near(right.grip.peakRequiredNormal!,left.grip.peakRequiredNormal!,1e-3);
  }
});

test('grip integration converges on release and slip displacement when its step is halved',()=>{
  const c=defaultConfig();c.grip={...defaultGrip(),enabled:true};
  const a=analyzeGrip(c,1/960),b=analyzeGrip(c,1/1920);
  near(a.releaseTime,b.releaseTime,.003);
  assert.ok(a.states.at(-1)!.p.distanceTo(b.states.at(-1)!.p)<.02);
  assert.ok(a.states.at(-1)!.v.distanceTo(b.states.at(-1)!.v)<.15);
});

test('finite grip stays finite and respects contact budgets across all 28 preset/hand combinations',()=>{
  for(const type of ['backhand','forehand'] as const)
  for(const handedness of ['right','left'] as const)
  for(const preset of ['reference','push','torso','roll','nose','early','late'] as const){
    const c=defaultConfig(type,preset);c.handedness=handedness;c.grip!.enabled=true;
    const s=simulate(c);
    assert.ok(s.releaseTime<=c.duration*c.releasePhase);
    for(const frame of [...s.grip.states,...s.frames]){
      assert.ok([...frame.p.toArray(),...frame.q.toArray(),...frame.v.toArray(),...frame.omega.toArray()].every(Number.isFinite));
      near(frame.q.length(),1,1e-9);
    }
    for(const sample of s.grip.samples){
      const mu=sample.status==='sticking'?c.grip!.staticFriction:c.grip!.kineticFriction;
      sample.contactForces.forEach((force,i)=>assert.ok(force<=mu*c.grip!.normalForce*c.grip!.contacts[i].weight+1e-7));
    }
  }
});

test('zero friction and coincident contacts have explicit finite serialized outcomes',()=>{
  for(const mu of [0,.6]){
    const c=defaultConfig();c.grip={...defaultGrip(),enabled:true,staticFriction:mu,kineticFriction:Math.min(.5,mu)};
    c.grip.contacts=c.grip.contacts.map(point=>({...point,u:0,v:0}));
    const run=analyzeGrip(validateConfig(c));
    assert.equal(run.peakRequiredNormal,null);
    assert.ok(run.samples.some(sample=>!sample.geometryFeasible));
    for(const state of run.states)assert.ok([...state.p.toArray(),...state.v.toArray()].every(Number.isFinite));
  }
});
