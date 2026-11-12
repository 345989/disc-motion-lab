import {PerspectiveCamera,Vector3 as V,Quaternion as Q} from 'three';
import {samplePose,discStateAt,Config,Simulation,Pose} from '../../lib/disc/engine';
import {contactPositions} from '../../lib/disc/grip';
export type CanvasView='perspective'|'top'|'side'|'front'|'flight'|'grip';
export type CanvasOptions={config:Config;sim:Simulation;reference:Simulation|null;time:number;showAxes:boolean;showTrace:boolean;showLabels:boolean;compare:boolean};
export function positionCamera(camera:PerspectiveCamera,target:V,config:Config,sim:Simulation,view:CanvasView){
 target.set(config.rootX+.1,1,config.rootZ);camera.up.set(0,1,0);let delta=new V(3.4,1.8,4);
 if(view==='top'){target.set(config.rootX,.85,config.rootZ);delta.set(0,5.5,.001);camera.up.set(1,0,0);}
 if(view==='side')delta.set(0,.15,5.5);
 if(view==='front')delta.set(5,.25,0);
 if(view==='flight'){const extent=Math.max(5,sim.distance);target.copy(sim.release.pose.center).lerp(sim.frames.at(-1)!.p,.45);target.y=.8;delta.set(-extent*.22,extent*.58,extent*.70);}
 if(view==='grip'){
  target.copy(sim.release.pose.center).lerp(sim.release.pose.wrist,.4);delta.set(.52,.5,.7);
  if(config.grip?.enabled){delta.copy(sim.release.pose.center).sub(sim.release.pose.chest);delta.y=0;if(delta.length()<.01)delta.set(.5,0,.7);delta.normalize().multiplyScalar(.75);delta.y=.55;}
 }
 camera.position.copy(target).add(delta);camera.lookAt(target);camera.updateMatrixWorld();
}
type Shape={depth:number;draw:()=>void};
export function drawCanvasScene(ctx:CanvasRenderingContext2D,width:number,height:number,camera:PerspectiveCamera,o:CanvasOptions){
 const shapes:Shape[]=[];camera.aspect=width/height;camera.updateProjectionMatrix();camera.updateMatrixWorld();
 const project=(p:V)=>{const t=p.clone().project(camera);return {x:(t.x*.5+.5)*width,y:(-.5*t.y+.5)*height,z:t.z,visible:t.z> -1&&t.z<1};};
 const pen=(color:string,w:number,dash=false)=>{ctx.strokeStyle=color;ctx.lineWidth=w;ctx.setLineDash(dash?[5,5]:[]);ctx.lineCap='round';ctx.lineJoin='round';};
 const path=(points:V[],color:string,w:number,dash=false,fill?:string)=>{let ps=points;let ss=ps.map(project);if(ss.some(p=>!p.visible)){if(!fill&&ps.length===2){const a=ps[0].clone(),b=ps[1].clone(),za=a.clone().applyMatrix4(camera.matrixWorldInverse).z,zb=b.clone().applyMatrix4(camera.matrixWorldInverse).z,near=-camera.near*1.01;if(za>=near&&zb>=near)return;if(za>=near)a.lerp(b,(near-za)/(zb-za));else if(zb>=near)b.lerp(a,(near-zb)/(za-zb));ps=[a,b];ss=ps.map(project);if(ss.some(p=>!p.visible))return;}else if(!fill){for(let j=1;j<ps.length;j++)path([ps[j-1],ps[j]],color,w,dash);return;}else return;}shapes.push({depth:ss.reduce((s,p)=>s+p.z,0)/ss.length,draw:()=>{ctx.beginPath();ss.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}pen(color,w,dash);ctx.stroke();}});};
 const line=(a:V,b:V,c:string,w=1,dash=false)=>path([a,b],c,w,dash);
 const dot=(p:V,size:number,c:string,border?:string)=>{const s=project(p);if(!s.visible)return;const r=Math.max(1,size*height/(Math.max(.05,camera.position.distanceTo(p))*.65));shapes.push({depth:s.z,draw:()=>{ctx.beginPath();ctx.arc(s.x,s.y,r,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();if(border){pen(border,1);ctx.stroke();}}});};
 const rod=(a:V,b:V,r:number,c:string)=>line(a,b,c,Math.max(1,r*height/(Math.max(.2,camera.position.distanceTo(a.clone().lerp(b,.5)))*.65)*2));
 const ring=(center:V,r:number,q:Q,c:string)=>path(Array.from({length:41},(_,i)=>new V(Math.cos(i*Math.PI/20)*r,0,Math.sin(i*Math.PI/20)*r).applyQuaternion(q).add(center)),c,1);
 const arrow=(a:V,d:V,len:number,c:string)=>{const b=a.clone().addScaledVector(d.clone().normalize(),len),aa=project(a),bb=project(b);if(!aa.visible||!bb.visible)return;line(a,b,c,1.8);shapes.push({depth:bb.z-1e-5,draw:()=>{const angle=Math.atan2(bb.y-aa.y,bb.x-aa.x);ctx.beginPath();ctx.moveTo(bb.x,bb.y);ctx.lineTo(bb.x-8*Math.cos(angle-.45),bb.y-8*Math.sin(angle-.45));ctx.lineTo(bb.x-8*Math.cos(angle+.45),bb.y-8*Math.sin(angle+.45));ctx.closePath();ctx.fillStyle=c;ctx.fill();}});};
 ctx.clearRect(0,0,width,height);ctx.fillStyle='#f4f7f8';ctx.fillRect(0,0,width,height);
 const extent=Math.min(50,Math.max(7,o.sim.distance*1.3));for(let i=-extent;i<=extent;i+=.5){line(new V(i,0,-extent),new V(i,0,extent),'#dfe7e8',.5);line(new V(-extent,0,i),new V(extent,0,i),'#dfe7e8',.5);}
 arrow(new V(-1,.015,0),new V(1,0,0),4,'#a7babc');ring(new V(o.config.rootX,.016,o.config.rootZ),.34,new Q(),'#a2b6bd');
 // Ground grid is a background plane; draw before elevated geometry.
 shapes.sort((a,b)=>b.depth-a.depth);shapes.forEach(s=>s.draw());shapes.length=0;
 if(o.showTrace){path(Array.from({length:110},(_,i)=>discStateAt(o.sim,o.sim.releaseTime*i/109).p),'#21ac9e',1.4);path(o.sim.frames.filter((_,i)=>i%2===0).map(f=>f.p),'#e6a05c',1.5);path(o.sim.frames.filter((_,i)=>i%3===0).map(f=>new V(f.p.x,.01,f.p.z)),'#bbc9cc',1,true);if(o.compare&&o.reference){path(o.reference.frames.map(f=>f.p),'#9baeb7',1,true);path(Array.from({length:90},(_,i)=>samplePose(o.reference!.config,o.reference!.config.releasePhase*i/89).center),'#9baeb7',1,true);}}
 const body=(c:Config,sim:Simulation,ghost=false)=>{
  const p=samplePose(c,Math.min(o.time/c.duration,1.35));const actual=discStateAt(sim,o.time),flight=o.time>sim.releaseTime,dp=actual.p,dq=actual.q;
  const ink=ghost?'#a8b6c164':'#66808f',teal=ghost?'#92a9b775':'#29b7a7',pale=ghost?'#b6c5cf80':'#e1fcf5';
  const footA=new V(-.08,-c.hipHeight,.22).applyQuaternion(p.pelvisQ).add(p.pelvis),footB=new V(.14,-c.hipHeight,-.22).applyQuaternion(p.pelvisQ).add(p.pelvis);footA.y=footB.y=.055;
  const hipA=new V(0,0,.14).applyQuaternion(p.pelvisQ).add(p.pelvis),hipB=new V(0,0,-.14).applyQuaternion(p.pelvisQ).add(p.pelvis),kneeA=footA.clone().lerp(hipA,.52).add(new V(.08,0,0)),kneeB=footB.clone().lerp(hipB,.52).add(new V(.08,0,0));
  const restElbow=p.otherShoulder.clone().add(new V(.1,-.28,-.08).applyQuaternion(p.torsoQ)),restHand=restElbow.clone().add(new V(.16,-.2,.05).applyQuaternion(p.torsoQ));
  path([hipA,p.shoulder,p.otherShoulder,hipB],ghost?'#9eb4bd20':'#7097a540',1,false,ghost?'#a1b7c010':'#7a9aa323');
  rod(p.pelvis,p.chest,.043,ink);rod(p.shoulder,p.otherShoulder,.028,ink);rod(hipA,hipB,.032,ink);
  [[hipA,kneeA],[kneeA,footA],[hipB,kneeB],[kneeB,footB],[p.otherShoulder,restElbow],[restElbow,restHand]].forEach(([a,b])=>rod(a,b,.026,ink));
  [footA,footB].forEach(a=>rod(a,a.clone().add(new V(.16,0,0).applyQuaternion(p.pelvisQ)),.034,ink));
  rod(p.shoulder,p.elbow,.027,teal);rod(p.elbow,p.wrist,.022,teal);rod(p.wrist,p.grip,.016,teal);
  [p.pelvis,p.chest,p.otherShoulder,hipA,hipB,kneeA,kneeB].forEach(a=>dot(a,.037,ink));[p.shoulder,p.elbow,p.wrist].forEach(a=>dot(a,.037,pale,teal));
  const head=p.chest.clone().add(new V(0,.2,0));rod(p.chest,head,.022,ink);dot(head,.095,ink);rod(head,head.clone().add(new V(.09,0,0).applyQuaternion(p.torsoQ)),.018,ghost?'#8fa7b550':'#3b5c6c');
  const disc=Array.from({length:49},(_,i)=>new V(Math.cos(i*Math.PI/24)*c.radius,0,Math.sin(i*Math.PI/24)*c.radius).applyQuaternion(dq).add(dp));
  path(disc,ghost?'#9caeba90':'#e5a45f',2,false,ghost?'#e4eef280':'#f9fcfd');ring(dp,c.radius*.72,dq,ghost?'#8ba3b450':'#8d9fa7');rod(dp,dp.clone().add(new V(c.radius*.82,.005,0).applyQuaternion(dq)),.004,teal);dot(dp,.008,ghost?'#b2bdc3':'#e49d4f');
  if(!flight){dot(p.grip,.02,ghost?'#a5b9c4':'#e7983f');contactPositions(c,p).forEach((point,i)=>dot(point,.014,ghost?'#abbfca':['#208e82','#bc7533','#527ca5'][i]));}
  if(o.showAxes&&!ghost){const points=[p.pelvis,p.chest,p.shoulder,p.elbow,p.wrist],qs=[p.pelvisQ,p.torsoQ,p.upperQ,p.upperQ,p.foreQ];points.forEach((a,i)=>{ring(a,i===0?.14:.075,qs[i],'#37b2a980');line(a.clone().add(new V(0,-.1,0).applyQuaternion(qs[i])),a.clone().add(new V(0,.1,0).applyQuaternion(qs[i])),'#3da99f70');});arrow(dp,new V(0,1,0).applyQuaternion(dq),.33,'#7b8ce3');const velocity=actual.v;if(velocity.length()>1e-5)arrow(dp,velocity,Math.min(velocity.length()*.075,.95),'#e59d4d');}
  return {p,dp,flight};
 };
 if(o.compare&&o.reference)body(o.reference.config,o.reference,true);const current=body(o.config,o.sim);
 shapes.sort((a,b)=>b.depth-a.depth);shapes.forEach(s=>s.draw());ctx.setLineDash([]);
 if(o.showLabels){const labels:[V,string][]=[[current.p.pelvis,'骨盆固定支点'],[current.p.shoulder,'肩'],[current.p.elbow,'肘'],[current.p.wrist,'腕'],[current.dp,'盘心 C']];if(!current.flight)labels.push([current.p.grip,'握点 G']);const occupied:{x:number;y:number;w:number}[]=[];ctx.font='11px system-ui, sans-serif';labels.forEach(([p,label])=>{const s=project(p);if(!s.visible)return;const ww=ctx.measureText(label).width+10,xx=Math.min(width-ww-3,Math.max(3,s.x+12));let yy=Math.max(18,Math.min(height-45,s.y-8));for(let trial=0;trial<7&&occupied.some(r=>xx<r.x+r.w+3&&xx+ww>r.x-3&&Math.abs(yy-r.y)<19);trial++)yy+=20;occupied.push({x:xx,y:yy,w:ww});ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(xx,yy-4);ctx.strokeStyle='#9ab7bf90';ctx.lineWidth=.7;ctx.stroke();ctx.fillStyle='#ffffffdf';ctx.fillRect(xx,yy-12,ww,17);ctx.fillStyle='#647f8b';ctx.fillText(label,xx+5,yy);});}
 return {shapes:shapes.length,pose:current.p};
}
