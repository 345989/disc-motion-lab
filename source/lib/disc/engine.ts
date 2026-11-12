import {Vector3 as V, Quaternion as Q} from 'three';
import {sourcePhase, validateTiming, type Timing} from './timing.ts';
import {defaultGrip, validateGrip, simulateGrip, heldStateAt, type GripConfig, type GripRun, type Motion} from './grip.ts';

export const DEG = Math.PI / 180;
export type ThrowType = 'backhand'|'forehand';
export type Preset = 'reference'|'push'|'torso'|'roll'|'nose'|'early'|'late';
export type Channel = 'pelvis'|'torso'|'shoulder'|'elevation'|'elbow'|'forearm'|'wrist'|'wristPitch';
export const CHANNELS:Channel[]=['pelvis','torso','shoulder','elevation','elbow','forearm','wrist','wristPitch'];
export const LABELS:Record<Channel,string>={pelvis:'骨盆转动',torso:'胸廓 / 腰转动',shoulder:'肩水平转动',elevation:'大臂抬升',elbow:'肘屈曲',forearm:'前臂旋前 / 旋后',wrist:'腕部出盘转轴',wristPitch:'腕屈伸'};
export type Keyframe = {t:number;value:number};
export type Commands = Record<Channel,Keyframe[]>;
export type Config = {
 version:1; throwType:ThrowType; handedness:'right'|'left'; preset:Preset;
 duration:number; releasePhase:number; bodyMass:number; upperLength:number; foreLength:number; handLength:number; shoulderWidth:number; hipHeight:number; shoulderHeight:number;
 rootX:number;rootZ:number;heading:number;offsets:Record<Channel,number>;
 discMass:number;radius:number;inertiaAxial:number;inertiaTransverse:number;gripAngle:number;discPitch:number;discRoll:number;discYaw:number;
 air:boolean;rho:number;windX:number;windZ:number;liftScale:number;dragScale:number;momentScale:number;pitchDamping:number;rollDamping:number;spinDamping:number;
 commands:Commands|null; timing?:Timing; grip?:GripConfig;
};
export type Pose={pelvis:V;chest:V;shoulder:V;otherShoulder:V;elbow:V;wrist:V;grip:V;center:V;normal:V;discQ:Q;handQ:Q;torsoQ:Q;pelvisQ:Q;upperQ:Q;foreQ:Q;angles:Record<Channel,number>};
export type Release={pose:Pose;v:V;omega:V;spin:number;offAxis:number;speed:number;azimuth:number;elevation:number;energy:number;armEnergy:number;trunkEnergy:number;contributions:{key:Channel;value:number}[]};
export type Frame={t:number;p:V;v:V;q:Q;L:V;omega:V;alpha:number;cl:number;cd:number;lift:V;drag:V;outOfRange:boolean};
export type Simulation={config:Config;release:Release;frames:Frame[];flightTime:number;distance:number;lateral:number;peakHeight:number;outOfRange:boolean;landed:boolean;releaseTime:number;grip:GripRun};
const UP=new V(0,1,0),X=new V(1,0,0),Z=new V(0,0,1);
export const PRESETS:Record<Preset,{name:string;short:string;description:string;focus:string}>={
 reference:{name:'基础平盘参考',short:'参考动作',description:'保持稳定盘面，肩肘展开与末段腕部加速配合。角度与时序为教学构造，并非唯一标准。',focus:'观察盘缘握点、腕部末段加速，以及盘心速度如何形成。'},
 push:{name:'身前推盘',short:'推盘',description:'缩小肩部横向展开与腕部幅度，以提前伸肘为主。旋转和轨迹由模型计算，不预设距离。',focus:'对比肘伸展与腕部对线速度、自旋的不同贡献。'},
 torso:{name:'躯干主导',short:'躯干代偿示意',description:'增大骨盆与胸廓转动，减少肩、肘、腕的相对运动。该预设不能诊断核心力量。',focus:'正常转体有助于传力；这里演示的是转体与末端关节参与不协调。'},
 roll:{name:'出手翻掌',short:'翻掌',description:'末段加入前臂轴向旋转，改变盘面法向及偏轴角速度，观察滚转和摆振。',focus:'前臂旋前 / 旋后是独立转轴，不等同于腕部出盘转轴。'},
 nose:{name:'盘头上仰',short:'抬鼻',description:'只增加手—盘安装俯仰偏置；释放速度仰角仍由运动学导出。',focus:'盘面俯仰角、速度仰角、迎角是三个不同的量。'},
 early:{name:'过早释放',short:'早出手',description:'保留参考关节曲线，仅提前解除手—盘约束。',focus:'出手位置、方向、速度和旋转会同时改变。'},
 late:{name:'过晚释放',short:'晚出手',description:'保留参考关节曲线，仅延后解除手—盘约束。',focus:'先看俯视图，观察释放瞬间的切线方向。'}
};
export function defaultConfig(type:ThrowType='backhand',preset:Preset='reference'):Config{
 return {version:1,throwType:type,handedness:'right',preset,duration:.58,releasePhase:preset==='early'?.88:preset==='late'?1.09:1,
 bodyMass:70,upperLength:.31,foreLength:.265,handLength:.105,shoulderWidth:.40,hipHeight:.92,shoulderHeight:1.37,rootX:0,rootZ:0,heading:0,
 offsets:{pelvis:0,torso:0,shoulder:0,elevation:0,elbow:0,forearm:0,wrist:0,wristPitch:0},
 discMass:.175,radius:.1347,inertiaAxial:.002352,inertiaTransverse:.001219,gripAngle:type==='backhand'?-90:90,discPitch:preset==='nose'?22:0,discRoll:0,discYaw:0,
 air:true,rho:1.23,windX:0,windZ:0,liftScale:1,dragScale:1,momentScale:1,pitchDamping:.0144,rollDamping:.0125,spinDamping:.0000341,commands:null,grip:defaultGrip(type)};
}
function keys(ts:number[],vs:number[]):Keyframe[]{return ts.map((t,i)=>({t,value:vs[i]}));}
export function getCommands(c:Config):Commands{
 if(c.commands)return c.commands;
 const bh=c.throwType==='backhand', ts=[0,.48,.82,1,1.12,1.35];
 const m:Commands={pelvis:keys(ts,bh?[-6,-6,-2,3,5,5]:[-3,-3,-1,2,3,3]),torso:keys(ts,bh?[-12,-12,-4,7,13,15]:[6,6,2,-3,-5,-5]),shoulder:keys(ts,bh?[-55,-55,-12,36,58,65]:[50,50,36,12,0,-8]),elevation:keys(ts,[0,0,0,0,0,0]),elbow:keys(ts,bh?[108,108,88,30,14,12]:[105,105,94,58,39,35]),forearm:keys(ts,[0,0,0,0,0,0]),wrist:keys([0,.7,.92,1,1.055,1.35],bh?[-44,-44,-40,7,45,48]:[48,48,44,-6,-45,-48]),wristPitch:keys(ts,[0,0,0,0,0,0])};
 if(c.preset==='push'){
  m.shoulder=keys(ts,bh?[-10,-10,0,8,12,12]:[27,27,20,13,11,10]);
  m.elbow=keys(ts,[105,105,65,30,18,15]);m.wrist=keys(ts,bh?[-8,-8,-6,-2,1,2]:[8,8,6,2,-1,-2]);
  m.torso=keys(ts,[0,0,1,3,4,4]);m.pelvis=keys(ts,[0,0,0,1,2,2]);
 }
 if(c.preset==='torso'){
  m.pelvis=keys(ts,bh?[-25,-25,0,40,65,70]:[25,25,0,-40,-65,-70]);
  m.torso=keys(ts,bh?[-20,-20,0,35,55,60]:[20,20,0,-35,-55,-60]);
  m.shoulder=m.shoulder.map(k=>({...k,value:(bh?15:25)+k.value*.15}));
  m.elbow=keys(ts,bh?[60,60,58,50,45,43]:[90,90,88,80,75,73]);
  m.wrist=m.wrist.map(k=>({...k,value:k.value*.12}));
 }
 if(c.preset==='roll')m.forearm=keys([0,.7,.9,1,1.1,1.35],[0,0,0,bh?27:-27,bh?55:-55,bh?60:-60]);
 return m;
}
// C1 cubic Hermite curve; release is sampled inside the motion, not at a stopped endpoint.
export function interpolate(k:Keyframe[],t:number):number{
 if(t<=k[0].t)return k[0].value;if(t>=k[k.length-1].t)return k[k.length-1].value;
 let i=0;while(i<k.length-2&&t>k[i+1].t)i++;
 const a=k[i],b=k[i+1],span=b.t-a.t,u=(t-a.t)/span;
 const slope=(j:number)=>j===0||j===k.length-1?0:(k[j+1].value-k[j-1].value)/(k[j+1].t-k[j-1].t);
 return (2*u**3-3*u*u+1)*a.value+(u**3-2*u*u+u)*span*slope(i)+(-2*u**3+3*u*u)*b.value+(u**3-u*u)*span*slope(i+1);
}
export function sampleAngles(c:Config,phase:number){
 const commands=getCommands(c);
 return Object.fromEntries(CHANNELS.map(k=>[k,interpolate(commands[k],sourcePhase(phase,c.timing?.[k]))+c.offsets[k]])) as Record<Channel,number>;
}
const qAxis=(axis:V,deg:number)=>new Q().setFromAxisAngle(axis,deg*DEG);
function chain(c:Config,a:Record<Channel,number>,align:number):Pose{
 const root=new V(c.rootX,c.hipHeight,c.rootZ);
 const pQ=qAxis(UP,-(align+c.heading+a.pelvis));
 const tQ=pQ.clone().multiply(qAxis(UP,-a.torso));
 const chest=new V(0,c.shoulderHeight-c.hipHeight,0).applyQuaternion(tQ).add(root);
 const shoulder=new V(0,0,c.shoulderWidth/2).applyQuaternion(tQ).add(chest),otherShoulder=new V(0,0,-c.shoulderWidth/2).applyQuaternion(tQ).add(chest);
 const uQ=tQ.clone().multiply(qAxis(UP,-a.shoulder)).multiply(qAxis(Z,a.elevation));
 const elbow=new V(c.upperLength,0,0).applyQuaternion(uQ).add(shoulder);
 const sign=c.throwType==='backhand'?-1:1;
 const fQ=uQ.clone().multiply(qAxis(UP,-sign*a.elbow)).multiply(qAxis(X,a.forearm));
 const wrist=new V(c.foreLength,0,0).applyQuaternion(fQ).add(elbow);
 const hQ=fQ.clone().multiply(qAxis(UP,-a.wrist)).multiply(qAxis(Z,a.wristPitch));
 const grip=new V(c.handLength,0,0).applyQuaternion(hQ).add(wrist);
 const dQ=hQ.clone().multiply(qAxis(UP,-c.discYaw)).multiply(qAxis(Z,c.discPitch)).multiply(qAxis(X,c.discRoll));
 const toCenter=new V(Math.cos(c.gripAngle*DEG)*c.radius,0,Math.sin(c.gripAngle*DEG)*c.radius).applyQuaternion(dQ);
 const center=grip.clone().add(toCenter);
 const pose:Pose={pelvis:root,chest,shoulder,otherShoulder,elbow,wrist,grip,center,normal:UP.clone().applyQuaternion(dQ),discQ:dQ,handQ:hQ,torsoQ:tQ,pelvisQ:pQ,upperQ:uQ,foreQ:fQ,angles:a};
 if(c.handedness==='left'){
  for(const k of ['pelvis','chest','shoulder','otherShoulder','elbow','wrist','grip','center','normal'] as const)pose[k].z=k==='normal'?-pose[k].z:2*c.rootZ-pose[k].z;
  // M R M is a proper rotation for reflection M=diag(1,1,-1).
  for(const k of ['discQ','handQ','torsoQ','pelvisQ','upperQ','foreQ'] as const){const q=pose[k];q.set(-q.x,-q.y,q.z,q.w);}
 }
 return pose;
}
const alignmentCache=new Map<ThrowType,number>();
function alignment(type:ThrowType){if(alignmentCache.has(type))return alignmentCache.get(type)!;const b=defaultConfig(type);const a=chain(b,sampleAngles(b,.9999),0).center;const d=chain(b,sampleAngles(b,1.0001),0).center.sub(a);const angle=-Math.atan2(d.z,d.x)/DEG;alignmentCache.set(type,angle);return angle;}
export function samplePose(c:Config,phase:number,angles?:Record<Channel,number>){return chain(c,angles??sampleAngles(c,phase),alignment(c.throwType));}
function omegaBetween(a:Q,b:Q,dt:number){const d=b.clone().multiply(a.clone().invert()).normalize();if(d.w<0)d.set(-d.x,-d.y,-d.z,-d.w);const len=Math.hypot(d.x,d.y,d.z);return len<1e-12?new V():new V(d.x,d.y,d.z).multiplyScalar(2*Math.atan2(len,d.w)/len/dt);}
export function sampleMotion(c:Config,time:number):Motion {
 const h=c.duration*.0001,phase=time/c.duration;
 const pose=samplePose(c,phase),before=samplePose(c,phase-.0001),after=samplePose(c,phase+.0001);
 return {pose,v:after.center.clone().sub(before.center).divideScalar(2*h),
  acceleration:after.center.clone().add(before.center).addScaledVector(pose.center,-2).divideScalar(h*h),
  omega:omegaBetween(before.discQ,after.discQ,2*h),
  alpha:omegaBetween(pose.discQ,after.discQ,h).sub(omegaBetween(before.discQ,pose.discQ,h)).divideScalar(h)};
}

export function analyzeGrip(c:Config,step=1/960):GripRun {
 return simulateGrip(c,time=>sampleMotion(c,time),step);
}
function rodEnergy(p1:V,p2:V,va:V,vb:V,m:number){const l=p2.clone().sub(p1);const v=va.clone().add(vb).multiplyScalar(.5);const om=l.clone().cross(vb.clone().sub(va)).divideScalar(Math.max(l.lengthSq(),1e-8));return .5*m*v.lengthSq()+m*l.lengthSq()*om.lengthSq()/24;}
export function getRelease(c:Config):Release{
 const phase=c.releasePhase,h=.00002,p=samplePose(c,phase),before=samplePose(c,phase-h),after=samplePose(c,phase+h),dt=2*h*c.duration;
 const v=after.center.clone().sub(before.center).divideScalar(dt),omega=omegaBetween(before.discQ,after.discQ,dt),spin=omega.dot(p.normal),offAxis=omega.clone().addScaledVector(p.normal,-spin).length();
 const energy=.5*c.discMass*v.lengthSq()+.5*c.inertiaAxial*spin*spin+.5*c.inertiaTransverse*offAxis*offAxis;
 const vel=(k:'shoulder'|'elbow'|'wrist'|'grip'|'chest')=>after[k].clone().sub(before[k]).divideScalar(dt);
 const armEnergy=rodEnergy(p.shoulder,p.elbow,vel('shoulder'),vel('elbow'),.0271*c.bodyMass)+rodEnergy(p.elbow,p.wrist,vel('elbow'),vel('wrist'),.0162*c.bodyMass)+rodEnergy(p.wrist,p.grip,vel('wrist'),vel('grip'),.0061*c.bodyMass);
 const direction=v.clone().normalize(),a=sampleAngles(c,phase),a0=sampleAngles(c,phase-h),a1=sampleAngles(c,phase+h);
 const trunkOmega=((a1.pelvis+a1.torso)-(a0.pelvis+a0.torso))*DEG/dt;
 const trunkMass=.504*c.bodyMass,trunkInertia=trunkMass*((c.shoulderWidth/2)**2+.12**2)/4;
 const trunkEnergy=.5*trunkInertia*trunkOmega**2;
 const contributions=CHANNELS.map(key=>{
 const aa={...a,[key]:a0[key]},bb={...a,[key]:a1[key]};
 return {key,value:samplePose(c,phase,bb).center.sub(samplePose(c,phase,aa).center).divideScalar(dt).dot(direction)};
 });
 return {pose:p,v,omega,spin,offAxis,speed:v.length(),azimuth:Math.atan2(v.z,v.x)/DEG,elevation:Math.atan2(v.y,Math.hypot(v.x,v.z))/DEG,energy,armEnergy,trunkEnergy,contributions};
}
const alphas=[-10,-3,0,5,10,15,20,25,30],cls=[-.225,0,.15,.45,.725,.975,1.2,1.45,1.675],cds=[.15,.08,.10,.15,.26,.39,.57,.75,.92];
const malphas=[-10,-5,-3,0,3,6,9,12,15,20,23,26,30],cms=[-.038,-.022,-.014,-.006,-.006,-.002,0,.010,.022,.044,.060,.084,.110];
function lookup(xs:number[],ys:number[],x:number){if(x<=xs[0])return ys[0];for(let i=1;i<xs.length;i++)if(x<=xs[i])return ys[i-1]+(ys[i]-ys[i-1])*(x-xs[i-1])/(xs[i]-xs[i-1]);return ys[ys.length-1];}
export function aerodynamic(c:Config,v:V,q:Q,omega:V){
 const n=UP.clone().applyQuaternion(q),u=v.clone().sub(new V(c.windX,0,c.windZ)),speed=u.length(),e=u.clone().normalize(),proj=u.clone().addScaledVector(n,-u.dot(n));
 const alpha=Math.atan2(-u.dot(n),proj.length())/DEG;
 const f=proj.lengthSq()<1e-12?X.clone().applyQuaternion(q):proj.normalize(),b=f.clone().cross(n).normalize(),l=n.clone().addScaledVector(e,-n.dot(e)).normalize();
 const pressure=.5*c.rho*speed*speed*Math.PI*c.radius*c.radius,cl=lookup(alphas,cls,alpha)*c.liftScale,cd=lookup(alphas,cds,alpha)*c.dragScale,cm=lookup(malphas,cms,alpha)*c.momentScale;
 const lift=c.air?l.multiplyScalar(pressure*cl):new V(),drag=c.air?e.multiplyScalar(-pressure*cd):new V();
 const torque=c.air?b.clone().multiplyScalar(cm-c.pitchDamping*omega.dot(b)).addScaledVector(f,-c.rollDamping*omega.dot(f)).addScaledVector(n,-c.spinDamping*omega.dot(n)).multiplyScalar(pressure*2*c.radius):new V();
 return {alpha,cl,cd,lift,drag,torque,outOfRange:c.air&&(alpha< -10||alpha>30)};
}
export function angularVelocity(c:Config,q:Q,L:V){const n=UP.clone().applyQuaternion(q);return L.clone().divideScalar(c.inertiaTransverse).addScaledVector(n,(1/c.inertiaAxial-1/c.inertiaTransverse)*L.dot(n));}
function advanceQ(q:Q,om:V,h:number){const len=om.length();return len>1e-10?new Q().setFromAxisAngle(om.clone().divideScalar(len),len*h).multiply(q).normalize():q.clone();}
export function simulate(c:Config,dt=1/480):Simulation{
 const grip=analyzeGrip(c,dt/2);
 let release=getRelease(c);
 if(c.grip?.enabled && (grip.firstSlipTime!==null || grip.releaseTime===0)){
  const actual=heldStateAt(grip,grip.releaseTime);
  const planned=getRelease({...c,releasePhase:grip.releaseTime/c.duration});
  const normal=UP.clone().applyQuaternion(actual.q),spin=actual.omega.dot(normal);
  const offAxis=actual.omega.clone().addScaledVector(normal,-spin).length();
  release={...planned,pose:{...planned.pose,center:actual.p.clone(),discQ:actual.q.clone(),normal},
   v:actual.v.clone(),omega:actual.omega.clone(),spin,offAxis,speed:actual.v.length(),
   azimuth:Math.atan2(actual.v.z,actual.v.x)/DEG,elevation:Math.atan2(actual.v.y,Math.hypot(actual.v.x,actual.v.z))/DEG,
   energy:.5*c.discMass*actual.v.lengthSq()+.5*c.inertiaAxial*spin*spin+.5*c.inertiaTransverse*offAxis*offAxis};
 }
 let p=release.pose.center.clone(),v=release.v.clone(),q=release.pose.discQ.clone();
 let L=release.omega.clone().multiplyScalar(c.inertiaTransverse).addScaledVector(release.pose.normal,(c.inertiaAxial-c.inertiaTransverse)*release.spin);
 const frames:Frame[]=[];let peakHeight=p.y,outOfRange=false,landed=false,t=0;
 const floor=(qq:Q)=>c.radius*Math.sqrt(Math.max(0,1-UP.clone().applyQuaternion(qq).y**2))+.012;
 const frame=()=>{const omega=angularVelocity(c,q,L),a=aerodynamic(c,v,q,omega);outOfRange ||= a.outOfRange;return {t,p:p.clone(),v:v.clone(),q:q.clone(),L:L.clone(),omega,alpha:a.alpha,cl:a.cl,cd:a.cd,lift:a.lift,drag:a.drag,outOfRange:a.outOfRange};};
 frames.push(frame());
 // Explicit midpoint for translation and world angular momentum; quaternion midpoint rotation.
 for(let i=1;i<=Math.ceil(8/dt);i++){
  const om=angularVelocity(c,q,L),a=aerodynamic(c,v,q,om),acc=a.lift.clone().add(a.drag).divideScalar(c.discMass).add(new V(0,-9.80665,0));
  const vm=v.clone().addScaledVector(acc,dt/2),Lm=L.clone().addScaledVector(a.torque,dt/2),qm=advanceQ(q,om,dt/2),omm=angularVelocity(c,qm,Lm),am=aerodynamic(c,vm,qm,omm);
  p.addScaledVector(vm,dt);v.addScaledVector(am.lift.clone().add(am.drag).divideScalar(c.discMass).add(new V(0,-9.80665,0)),dt);L.addScaledVector(am.torque,dt);q=advanceQ(q,omm,dt);t=i*dt;
  peakHeight=Math.max(peakHeight,p.y);outOfRange ||= am.outOfRange;
  if(p.y<=floor(q)){landed=true;frames.push(frame());break;}
  if(i%4===0)frames.push(frame());
 }
 if(frames.at(-1)!.t!==t)frames.push(frame());
 const last=frames.at(-1)!;return {config:c,release,frames,flightTime:last.t,distance:Math.hypot(last.p.x-release.pose.center.x,last.p.z-release.pose.center.z),lateral:last.p.z-release.pose.center.z,peakHeight,outOfRange,landed,releaseTime:grip.releaseTime,grip};
}
export function discStateAt(sim:Simulation,time:number){
 if(time>=sim.releaseTime)return frameAt(sim,time-sim.releaseTime);
 if(sim.config.grip?.enabled)return heldStateAt(sim.grip,time);
 const motion=sampleMotion(sim.config,time);
 return {t:time,p:motion.pose.center,q:motion.pose.discQ,v:motion.v,omega:motion.omega};
}
export function frameAt(sim:Simulation,t:number){const fs=sim.frames;if(t<=0)return fs[0];if(t>=fs.at(-1)!.t)return fs.at(-1)!;let lo=0,hi=fs.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(fs[m].t>t)hi=m;else lo=m;}const a=fs[lo],b=fs[hi],u=(t-a.t)/(b.t-a.t);return {...a,t,p:a.p.clone().lerp(b.p,u),v:a.v.clone().lerp(b.v,u),q:a.q.clone().slerp(b.q,u),L:a.L.clone().lerp(b.L,u),omega:a.omega.clone().lerp(b.omega,u),alpha:a.alpha+(b.alpha-a.alpha)*u};}
export const SCHEMA={duration:[.3,1.5],releasePhase:[.7,1.15],bodyMass:[35,130],upperLength:[.2,.45],foreLength:[.17,.4],handLength:[.05,.17],shoulderWidth:[.25,.6],hipHeight:[.6,1.2],shoulderHeight:[1,1.85],rootX:[-2,2],rootZ:[-2,2],heading:[-180,180],discMass:[.1,.25],radius:[.1,.16],inertiaAxial:[.0008,.004],inertiaTransverse:[.0004,.003],gripAngle:[-180,180],discPitch:[-40,40],discRoll:[-60,60],discYaw:[-180,180],rho:[0,1.6],windX:[-10,10],windZ:[-10,10],liftScale:[.1,2],dragScale:[.1,2],momentScale:[0,2],pitchDamping:[0,.04],rollDamping:[0,.04],spinDamping:[0,.0002]} as const;
export function validateConfig(value:unknown):Config{
 if(!value||typeof value!=='object')throw new Error('配置必须为 JSON 对象');const v=value as Record<string,unknown>;
 if(v.version!==1)throw new Error('仅支持 version: 1');
 if(!['backhand','forehand'].includes(v.throwType as string))throw new Error('throwType 必须为 backhand 或 forehand');
 if(!['right','left'].includes(v.handedness as string))throw new Error('handedness 必须为 right 或 left');
 if(!Object.hasOwn(PRESETS,v.preset as string))throw new Error('未知动作预设');
 const c=defaultConfig(v.throwType as ThrowType,v.preset as Preset);
 for(const [key,[min,max]] of Object.entries(SCHEMA)){const n=v[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error(`${key} 必须在 ${min}～${max} 之间`);(c as unknown as Record<string,unknown>)[key]=n;}
 if(typeof v.air!=='boolean')throw new Error('air 必须为布尔值');c.air=v.air;c.handedness=v.handedness as Config['handedness'];
 for(const key of CHANNELS){const n=(v.offsets as Record<string,unknown>)?.[key];if(typeof n!=='number'||!Number.isFinite(n)||Math.abs(n)>180)throw new Error(`offsets.${key} 超出 ±180°`);c.offsets[key]=n;}
 if(v.commands!=null){const cmds={} as Commands;for(const key of CHANNELS){const arr=(v.commands as Record<string,unknown>)[key];if(!Array.isArray(arr)||arr.length<2||arr.length>40)throw new Error(`${key}: 需要 2～40 个关键帧`);cmds[key]=arr.map((x,i)=>{if(!x||typeof x.t!=='number'||typeof x.value!=='number'||!Number.isFinite(x.t)||!Number.isFinite(x.value)||x.t<0||x.t>2||Math.abs(x.value)>360||(i>0&&(x.t-arr[i-1].t<.005||Math.abs(x.value-arr[i-1].value)/(x.t-arr[i-1].t)>1800)))throw new Error(`${key}: 时间步距≥0.005，相邻角度变化率≤1800°/相位，t∈[0,2]，角度∈[−360,360]`);return {t:x.t,value:x.value};});}c.commands=cmds;}
 const timing=validateTiming(v.timing,getCommands(c),CHANNELS);
 if(timing)c.timing=timing;
 c.grip=validateGrip(v.grip,c.throwType);
 return c;
}
export function serializeSimulation(sim:Simulation){return {config:sim.config,grip:serializeGrip(sim.grip),releaseTime:sim.releaseTime,release:{position:sim.release.pose.center.toArray(),quaternion:sim.release.pose.discQ.toArray(),velocity:sim.release.v.toArray(),angularVelocity:sim.release.omega.toArray(),speed:sim.release.speed,spin:sim.release.spin,energy:sim.release.energy,armEnergy:sim.release.armEnergy,trunkEnergy:sim.release.trunkEnergy,contributions:sim.release.contributions,contributionBasis:'prescribed-motion-at-actual-release'},metrics:{distance:sim.distance,lateral:sim.lateral,flightTime:sim.flightTime,outOfRange:sim.outOfRange,landed:sim.landed},frames:sim.frames.map(f=>({t:f.t,p:f.p.toArray(),v:f.v.toArray(),quaternion:f.q.toArray(),angularMomentum:f.L.toArray(),angularVelocity:f.omega.toArray(),alpha:f.alpha,outOfRange:f.outOfRange}))};}

export function serializeGrip(grip:GripRun){
 return {...grip,states:grip.states.map(state=>({t:state.t,p:state.p.toArray(),quaternion:state.q.toArray(),v:state.v.toArray(),omega:state.omega.toArray()}))};
}
