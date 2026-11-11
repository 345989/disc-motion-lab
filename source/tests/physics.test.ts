import assert from 'node:assert/strict';
import test from 'node:test';
import {Vector3 as V} from 'three';
import {defaultConfig,simulate,samplePose,getRelease,aerodynamic,validateConfig,getCommands} from '../lib/disc/engine.ts';
const near=(a:number,b:number,tol=1e-5)=>assert.ok(Math.abs(a-b)<tol,`${a} ≠ ${b}`);
test('all 28 preset/hand combinations yield finite states and unit orientation',()=>{
 for(const type of ['backhand','forehand'] as const)for(const preset of ['reference','push','torso','roll','nose','early','late'] as const)for(const handedness of ['right','left'] as const){const c={...defaultConfig(type,preset),handedness},s=simulate(c);assert.ok(s.landed);for(const f of s.frames){assert.ok([...f.p.toArray(),...f.q.toArray(),...f.omega.toArray()].every(Number.isFinite));near(f.q.length(),1,1e-9);}}
});
test('grip remains on rim through 3D non-planar arm movement, both hands and throws',()=>{
 for(const type of ['backhand','forehand'] as const)for(const handedness of ['right','left'] as const){const c={...defaultConfig(type),handedness,discPitch:13,discRoll:17,discYaw:26};c.offsets.elevation=-12;c.offsets.forearm=35;c.offsets.wristPitch=8;for(let t=0;t<=1.35;t+=.013){const p=samplePose(c,t),offset=p.center.clone().sub(p.grip);near(offset.length(),c.radius,1e-9);near(offset.dot(p.normal),0,1e-9);near(p.elbow.distanceTo(p.shoulder),c.upperLength,1e-9);near(p.wrist.distanceTo(p.elbow),c.foreLength,1e-9);}}
});
test('vacuum follows gravity parabola and conserves world angular momentum',()=>{
 const c={...defaultConfig('forehand','roll'),air:false},s=simulate(c);for(const f of s.frames){const exact=s.release.pose.center.clone().addScaledVector(s.release.v,f.t).add(new V(0,-.5*9.80665*f.t*f.t,0));assert.ok(exact.distanceTo(f.p)<1e-9);assert.ok(s.frames[0].L.distanceTo(f.L)<1e-12);}assert.equal(s.outOfRange,false);
});
test('release velocity respects rigid grip offset relationship',()=>{
 for(const type of ['backhand','forehand'] as const){const c=defaultConfig(type,'roll'),r=getRelease(c),h=.00002,a=samplePose(c,c.releasePhase-h),b=samplePose(c,c.releasePhase+h);const vg=b.grip.clone().sub(a.grip).divideScalar(2*h*c.duration);const derived=vg.add(r.omega.clone().cross(r.pose.center.clone().sub(r.pose.grip)));assert.ok(derived.distanceTo(r.v)<1e-4);}
});
test('left-hand reflection transforms angular velocity as an axial vector',()=>{
 for(const type of ['backhand','forehand'] as const){const c=defaultConfig(type,'roll'),r=getRelease(c),l=getRelease({...c,handedness:'left'});near(r.v.x,l.v.x);near(r.v.y,l.v.y);near(r.v.z,-l.v.z);near(r.omega.x,-l.omega.x);near(r.omega.y,-l.omega.y);near(r.omega.z,l.omega.z);near(r.spin,-l.spin);const sr=simulate(c),sl=simulate({...c,handedness:'left'});near(sr.distance,sl.distance,1e-8);near(sr.lateral,-sl.lateral,1e-8);}
});
test('lift does no relative-flow work and drag dissipates energy',()=>{
 const c=defaultConfig();c.windX=2;c.windZ=-3;const s=simulate(c);for(const f of s.frames){const a=aerodynamic(c,f.v,f.q,f.omega),u=f.v.clone().sub(new V(2,0,-3));near(a.lift.dot(u),0,1e-8);assert.ok(a.drag.dot(u)<=1e-10);}
});
test('joint speed contributions sum to disc release speed',()=>{
 for(const type of ['backhand','forehand'] as const){const c=defaultConfig(type,'roll'),r=getRelease(c);near(r.contributions.reduce((a,b)=>a+b.value,0),r.speed,1e-4);}
});
test('prescribed motion is mass independent and scales inversely with duration',()=>{
 const c=defaultConfig(),r=getRelease(c),heavy=getRelease({...c,bodyMass:100,discMass:.22}),slow=getRelease({...c,duration:c.duration*2});near(heavy.speed,r.speed);near(heavy.spin,r.spin);near(slow.speed,r.speed/2);near(slow.spin,r.spin/2);assert.ok(heavy.energy>r.energy);assert.ok(heavy.armEnergy>r.armEnergy);assert.ok(heavy.trunkEnergy>r.trunkEnergy);
});
test('release initial conditions are continuous into flight and spin signs differ',()=>{
 const bh=simulate(defaultConfig()),fh=simulate(defaultConfig('forehand'));assert.ok(bh.release.spin<0&&fh.release.spin>0);for(const s of [bh,fh]){assert.ok(s.frames[0].p.distanceTo(s.release.pose.center)<1e-12);assert.ok(s.frames[0].v.distanceTo(s.release.v)<1e-12);near(s.frames[0].q.angleTo(s.release.pose.discQ),0,1e-7);}
});
test('second-order flight converges with half step',()=>{
 for(const type of ['backhand','forehand'] as const){const c=defaultConfig(type),a=simulate(c,1/480),b=simulate(c,1/960);near(a.distance,b.distance,.035);near(a.flightTime,b.flightTime,.004);}
});
test('configuration round trips; rejects invalid and extreme commands',()=>{
 const c=defaultConfig();assert.deepEqual(validateConfig(JSON.parse(JSON.stringify(c))),c);assert.throws(()=>validateConfig({...c,discMass:-1}));assert.throws(()=>validateConfig({...c,version:2}));const cmds=getCommands(c);assert.doesNotThrow(()=>validateConfig({...c,commands:cmds}));cmds.wrist=[{t:0,value:0},{t:.00001,value:90}];assert.throws(()=>validateConfig({...c,commands:cmds}));
});
