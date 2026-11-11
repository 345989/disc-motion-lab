'use client';
import {useEffect,useRef,useState} from 'react';
import * as T from 'three';
import CanvasScene from './CanvasScene';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {samplePose,frameAt,Pose,Config,Simulation,DEG} from '../../lib/disc/engine';
export type View='perspective'|'top'|'side'|'front'|'flight'|'grip';
type Props={config:Config;sim:Simulation;reference:Simulation|null;time:number;view:View;cameraNonce:number;showAxes:boolean;showTrace:boolean;showLabels:boolean;compare:boolean};
const MAIN=0x17b8aa,ORANGE=0xf49b45,INK=0x536e80;
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function dispose(object:T.Object3D){object.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});}
function material(color:number,ghost=false){return new T.MeshStandardMaterial({color,roughness:.42,metalness:.18,transparent:ghost,opacity:ghost?.25:1,depthWrite:!ghost});}
function makeBody(ghost=false){
 const group=new T.Group(),bones:T.Mesh[]=[],joints:T.Mesh[]=[];
 for(let i=0;i<14;i++){const mesh=new T.Mesh(new T.CylinderGeometry(1,1,1,12),material(i>=3&&i<=5?(ghost?0x8296a6:MAIN):INK,ghost));group.add(mesh);bones.push(mesh);}
 for(let i=0;i<11;i++){const mesh=new T.Mesh(new T.SphereGeometry(1,20,14),material(i>=2&&i<=5?(ghost?0x8198aa:0xdafff8):0x91a1ae,ghost));group.add(mesh);joints.push(mesh);}
 const head=new T.Mesh(new T.SphereGeometry(.094,20,18),material(0x8c9da9,ghost));head.scale.set(.85,1.1,1);group.add(head);
 const face=new T.Mesh(new T.BoxGeometry(.045,.025,.065),material(0x314b5d,ghost));group.add(face);
 const torso=new T.Mesh(new T.BoxGeometry(.19,1,.31),new T.MeshStandardMaterial({color:0x7193a5,transparent:true,opacity:ghost?.05:.13,depthWrite:false,roughness:.8}));group.add(torso);
 const disc=new T.Group();
 const plate=new T.Mesh(new T.CylinderGeometry(1,1,.13,72),material(ghost?0xa5b7c4:0xf6fafb,ghost));disc.add(plate);
 const rim=new T.Mesh(new T.TorusGeometry(1,.035,10,72),material(ghost?0x8299aa:ORANGE,ghost));rim.rotation.x=Math.PI/2;disc.add(rim);
 const topRing=new T.Mesh(new T.TorusGeometry(.72,.009,8,60),material(ghost?0x8198aa:0x7a8d96,ghost));topRing.rotation.x=Math.PI/2;topRing.position.y=.085;disc.add(topRing);
 const stripe=new T.Mesh(new T.BoxGeometry(.72,.022,.045),material(ghost?0x8299aa:MAIN,ghost));stripe.position.set(.40,.09,0);disc.add(stripe);
 const hub=new T.Mesh(new T.CylinderGeometry(.07,.07,.17,20),material(ghost?0x8299aa:ORANGE,ghost));disc.add(hub);group.add(disc);
 const grip=new T.Mesh(new T.SphereGeometry(.022,16,12),material(ORANGE,ghost));group.add(grip);
 const palm=new T.Mesh(new T.BoxGeometry(.095,.025,.065),material(ghost?0x8198aa:0xbcded6,ghost));group.add(palm);
 const thumb=new T.Mesh(new T.SphereGeometry(.014,12,8),material(0xe8bb83,ghost)),finger=new T.Mesh(new T.SphereGeometry(.016,12,8),material(0xe8bb83,ghost));group.add(thumb,finger);
 const axes:T.Group[]=[];
 for(let i=0;i<6;i++){const g=new T.Group(),ring=new T.Mesh(new T.TorusGeometry(i===0?.14:.075,.0025,6,48),new T.MeshBasicMaterial({color:i===5?ORANGE:MAIN,transparent:true,opacity:ghost?.15:.65}));ring.rotation.x=Math.PI/2;g.add(ring);const shaft=new T.Mesh(new T.CylinderGeometry(.002,.002,.23,6),new T.MeshBasicMaterial({color:MAIN,transparent:true,opacity:.5}));g.add(shaft);axes.push(g);group.add(g);}
 const velocity=new T.ArrowHelper(v(1,0,0),v(),.6,0xf39a43,.10,.055),normal=new T.ArrowHelper(v(0,1,0),v(),.33,0x6d86ed,.06,.035);group.add(velocity,normal);
 function bone(i:number,a:T.Vector3,b:T.Vector3,r:number){const o=bones[i],d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(v(0,1,0),d.clone().normalize());o.scale.set(r,d.length(),r);}
 const update=(p:Pose,c:Config,free:{p:T.Vector3;q:T.Quaternion;v:T.Vector3}|null,axesVisible:boolean,heldVelocity?:T.Vector3)=>{
  const bodyq=p.pelvisQ,footA=new T.Vector3(-.08,-c.hipHeight,.22).applyQuaternion(bodyq).add(p.pelvis),footB=new T.Vector3(.14,-c.hipHeight,-.22).applyQuaternion(bodyq).add(p.pelvis);footA.y=footB.y=.055;
  const hipA=new T.Vector3(0,0,.14).applyQuaternion(bodyq).add(p.pelvis),hipB=new T.Vector3(0,0,-.14).applyQuaternion(bodyq).add(p.pelvis);
  const kneeA=footA.clone().lerp(hipA,.52).add(v(.08,0,0)),kneeB=footB.clone().lerp(hipB,.52).add(v(.08,0,0));
  const restElbow=p.otherShoulder.clone().add(new T.Vector3(.1,-.28,-.08).applyQuaternion(p.torsoQ)),restHand=restElbow.clone().add(new T.Vector3(.16,-.20,.05).applyQuaternion(p.torsoQ));
  bone(0,p.pelvis,p.chest,.057);bone(1,p.shoulder,p.otherShoulder,.035);bone(2,hipA,hipB,.045);bone(3,p.shoulder,p.elbow,.029);bone(4,p.elbow,p.wrist,.022);bone(5,p.wrist,p.grip,.017);
  bone(6,hipA,kneeA,.035);bone(7,kneeA,footA,.029);bone(8,hipB,kneeB,.035);bone(9,kneeB,footB,.029);bone(10,p.otherShoulder,restElbow,.025);bone(11,restElbow,restHand,.02);bone(12,footA,footA.clone().add(new T.Vector3(.16,0,0).applyQuaternion(bodyq)),.033);bone(13,footB,footB.clone().add(new T.Vector3(.16,0,0).applyQuaternion(bodyq)),.033);
  [p.pelvis,p.chest,p.shoulder,p.elbow,p.wrist,p.grip,hipA,hipB,kneeA,kneeB,p.otherShoulder].forEach((pt,i)=>{joints[i].position.copy(pt);joints[i].scale.setScalar(i===0?.065:i===3?.043:.035);});
  head.position.copy(p.chest).add(v(0,.20,0));head.quaternion.copy(p.torsoQ);face.position.copy(head.position).add(new T.Vector3(.073,0,0).applyQuaternion(p.torsoQ));face.quaternion.copy(p.torsoQ);
  torso.position.copy(p.pelvis).lerp(p.chest,.58);torso.quaternion.copy(p.torsoQ);torso.scale.y=(c.shoulderHeight-c.hipHeight)*.72;
  disc.position.copy(free?.p??p.center);disc.quaternion.copy(free?.q??p.discQ);disc.scale.setScalar(c.radius);
  grip.position.copy(p.grip);grip.visible=!free;
  palm.position.copy(p.wrist).lerp(p.grip,.65);palm.quaternion.copy(p.handQ);if(c.throwType==='backhand')palm.rotateX(Math.PI/2);
  const g=p.grip.clone().sub(p.center),n=p.normal;
  thumb.position.copy(p.center).addScaledVector(g,.88).addScaledVector(n,.025);finger.position.copy(p.center).addScaledVector(g,.89).addScaledVector(n,-.025);thumb.visible=finger.visible=!free;
  const pos=[p.pelvis,p.chest,p.shoulder,p.elbow,p.wrist,p.grip];const quats=[p.pelvisQ,p.torsoQ,p.upperQ,p.upperQ,p.foreQ,p.handQ];axes.forEach((a,i)=>{a.visible=axesVisible;a.position.copy(pos[i]);a.quaternion.copy(quats[i]);});
  velocity.position.copy(disc.position);velocity.visible=axesVisible;const vel=free?.v??heldVelocity??v(1,0,0);velocity.setDirection(vel.clone().normalize());velocity.setLength(Math.min(vel.length()*.075,.95)||.65,.08,.04);
  normal.position.copy(disc.position);normal.visible=axesVisible;normal.setDirection(v(0,1,0).applyQuaternion(disc.quaternion));
 };
 return {group,update};
}
export default function Scene(props:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(props),runtime=useRef<{scene:T.Scene;camera:T.PerspectiveCamera;controls:OrbitControls;paths:T.Group}|null>(null),[error,setError]=useState(()=>typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('renderer')==='canvas'?'compat':'');latest.current=props;
 const labels=useRef<HTMLDivElement[]>([]);
 useEffect(()=>{
  if(error)return;const el=host.current!;let renderer:T.WebGLRenderer;try{renderer=new T.WebGLRenderer({antialias:true,alpha:false});}catch{setError('此浏览器未能启用 WebGL。参数和数据仍可使用，请在支持 WebGL 的浏览器中查看三维模型。');return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0xf4f7f8);renderer.outputColorSpace=T.SRGBColorSpace;el.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.fog=new T.Fog(0xf4f7f8,45,100);
  scene.add(new T.HemisphereLight(0xffffff,0x9aaeb1,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(2,6,4);scene.add(light);
  const floor=new T.Mesh(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({color:0xf0f4f5,roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-.008;scene.add(floor);
  const grid=new T.GridHelper(80,160,0xc8d5d8,0xdfe7e8);grid.material.transparent=true;grid.material.opacity=.65;scene.add(grid);
  const target=new T.ArrowHelper(v(1,0,0),v(-1,.015,0),4,0xa7bbbd,.18,.09);scene.add(target);
  const base=new T.Mesh(new T.RingGeometry(.33,.34,64),new T.MeshBasicMaterial({color:0x9cb6ba,transparent:true,opacity:.65,side:T.DoubleSide}));base.rotation.x=-Math.PI/2;base.position.y=.012;scene.add(base);
  const body=makeBody(),ghost=makeBody(true);scene.add(ghost.group,body.group);const paths=new T.Group();scene.add(paths);
  const camera=new T.PerspectiveCamera(36,1,.02,220);camera.position.set(3.6,2.7,4.0);
  const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.15,.9,0);controls.enableDamping=true;controls.dampingFactor=.12;controls.minDistance=.22;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.96;controls.update();
  runtime.current={scene,camera,controls,paths};
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  let req=0;const render=()=>{
   const s=latest.current,p=samplePose(s.config,Math.min(s.time/s.config.duration,1.35)),free=s.time>s.sim.releaseTime?frameAt(s.sim,s.time-s.sim.releaseTime):null;
   const phase=Math.min(s.time/s.config.duration,1.35),step=.00002,heldVelocity=samplePose(s.config,phase+step).center.sub(samplePose(s.config,phase-step).center).divideScalar(2*step*s.config.duration);
   body.update(p,s.config,free,s.showAxes,heldVelocity);
   ghost.group.visible=s.compare&&!!s.reference;
   if(s.reference){const rs=s.reference,rp=samplePose(rs.config,Math.min(s.time/rs.config.duration,1.35)),rf=s.time>rs.releaseTime?frameAt(rs,s.time-rs.releaseTime):null;ghost.update(rp,rs.config,rf,false);}
   paths.visible=s.showTrace;base.position.x=s.config.rootX;base.position.z=s.config.rootZ;
   const points=[p.pelvis,p.shoulder,p.elbow,p.wrist,free?.p??p.center,p.grip];labels.current.forEach((label,i)=>{if(!label)return;const point=points[i].clone().project(camera);label.style.display=s.showLabels&&point.z<1&&!(i===5&&free)?'block':'none';label.style.transform=`translate(${(point.x*.5+.5)*el.clientWidth+12}px,${(-point.y*.5+.5)*el.clientHeight-12}px)`;});
   controls.update();renderer.render(scene,camera);req=requestAnimationFrame(render);
  };render();
  return()=>{cancelAnimationFrame(req);observer.disconnect();controls.dispose();dispose(scene);renderer.dispose();renderer.domElement.remove();runtime.current=null;};
 },[error]);
 useEffect(()=>{const r=runtime.current;if(!r)return;const {camera,controls}=r,s=props.sim,root=new T.Vector3(props.config.rootX,0,props.config.rootZ);let at=new T.Vector3(.1,1,0).add(root),pos:T.Vector3;
  if(props.view==='top'){at.set(root.x,.85,root.z);pos=at.clone().add(v(0,5.5,.001));camera.up.set(1,0,0);}
  else if(props.view==='side'){pos=at.clone().add(v(0,.15,5.5));camera.up.set(0,1,0);}
  else if(props.view==='front'){pos=at.clone().add(v(5,.25,0));camera.up.set(0,1,0);}
  else if(props.view==='flight'){const end=s.frames.at(-1)!.p,extent=Math.max(5,s.distance);at=s.release.pose.center.clone().lerp(end,.45);at.y=.8;pos=at.clone().add(v(-extent*.22,extent*.58,extent*.70));camera.up.set(0,1,0);}
  else if(props.view==='grip'){at=s.release.pose.center.clone().lerp(s.release.pose.wrist,.4);pos=at.clone().add(v(.52,.5,.7));camera.up.set(0,1,0);}
  else{pos=at.clone().add(v(3.4,1.8,4.0));camera.up.set(0,1,0);}
  camera.position.copy(pos);controls.target.copy(at);controls.update();
 },[props.view,props.cameraNonce]);
 useEffect(()=>{const r=runtime.current;if(!r)return;while(r.paths.children.length){const child=r.paths.children[0];r.paths.remove(child);dispose(child);}
  const line=(points:T.Vector3[],color:number,dash=false)=>{const geometry=new T.BufferGeometry().setFromPoints(points);const material=dash?new T.LineDashedMaterial({color,dashSize:.08,gapSize:.06,transparent:true,opacity:.65}):new T.LineBasicMaterial({color,transparent:true,opacity:.8});const l=new T.Line(geometry,material);if(dash)l.computeLineDistances();r.paths.add(l);};
  const hand=Array.from({length:130},(_,i)=>samplePose(props.config,props.config.releasePhase*i/129).center);line(hand,MAIN);
  line(props.sim.frames.map(f=>f.p),ORANGE);line(props.sim.frames.map(f=>v(f.p.x,.014,f.p.z)),0xbdc9ca,true);
  const marker=new T.Mesh(new T.SphereGeometry(.025,16,12),new T.MeshBasicMaterial({color:ORANGE}));marker.position.copy(props.sim.release.pose.center);r.paths.add(marker);
  if(props.compare&&props.reference){line(props.reference.frames.map(f=>f.p),0x8ca2b0,true);line(Array.from({length:100},(_,i)=>samplePose(props.reference!.config,props.reference!.config.releasePhase*i/99).center),0x94adb9,true);}
 },[props.sim,props.reference,props.compare]);
 if(error)return <CanvasScene {...props}/>;
 return <div className="scene" ref={host} role="img" aria-label="可拖动旋转的三维飞盘连杆模型，滚轮或双指缩放"><button className="compat-switch" onClick={()=>setError("compat")} title="无需 WebGL 的三维兼容绘制">兼容视图</button>{['骨盆固定支点','肩转轴','肘转轴','腕转轴','飞盘质心 C','盘缘握点 G'].map((s,i)=><div key={s} className={`scene-label label-${i}`} ref={e=>{if(e)labels.current[i]=e;}}>{s}</div>)}<div className="scene-coordinate"><b>Y</b> 向上 · <b>X</b> 目标方向 · <b>Z</b> 右侧</div></div>;
}
