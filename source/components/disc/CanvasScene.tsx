'use client';
import {useEffect,useRef} from 'react';
import {PerspectiveCamera,Vector3 as V,Spherical} from 'three';
import {drawCanvasScene,positionCamera,CanvasOptions,CanvasView} from './canvas-renderer';
type Props=CanvasOptions&{view:CanvasView;cameraNonce:number};
export default function CanvasScene(props:Props){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),latest=useRef(props),runtime=useRef<{camera:PerspectiveCamera;target:V}|null>(null);latest.current=props;
 useEffect(()=>{
  const el=canvas.current!,box=host.current!,ctx=el.getContext('2d');if(!ctx)return;
  const camera=new PerspectiveCamera(36,1,.02,220),target=new V();positionCamera(camera,target,latest.current.config,latest.current.sim,latest.current.view);runtime.current={camera,target};
  let w=1,h=1,dirty=true;const resize=()=>{w=box.clientWidth;h=box.clientHeight;const dpr=Math.min(window.devicePixelRatio||1,2);el.width=w*dpr;el.height=h*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);dirty=true;};const ro=new ResizeObserver(resize);ro.observe(box);resize();
  const pointers=new Map<number,{x:number;y:number}>();let lastDist=0;
  const down=(e:PointerEvent)=>{el.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});lastDist=0;};
  const zoom=(factor:number)=>{const delta=camera.position.clone().sub(target),length=Math.max(.25,Math.min(100,delta.length()*factor));camera.position.copy(target).add(delta.setLength(length));camera.lookAt(target);dirty=true;};
  const move=(e:PointerEvent)=>{const old=pointers.get(e.pointerId);if(!old)return;const dx=e.clientX-old.x,dy=e.clientY-old.y;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size>1){const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);if(lastDist)zoom(lastDist/Math.max(distance,1));lastDist=distance;return;}const spherical=new Spherical().setFromVector3(camera.position.clone().sub(target));spherical.theta-=dx*.008;spherical.phi=Math.max(.015,Math.min(Math.PI-.04,spherical.phi+dy*.008));camera.up.set(0,1,0);camera.position.copy(target).add(new V().setFromSpherical(spherical));camera.lookAt(target);dirty=true;};
  const up=(e:PointerEvent)=>{pointers.delete(e.pointerId);lastDist=0;};const wheel=(e:WheelEvent)=>{e.preventDefault();zoom(Math.exp(Math.max(-.3,Math.min(.3,e.deltaY*.001))));};
  el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('wheel',wheel,{passive:false});
  let id=0,lastTick=0,prior:Props|null=null;const render=(now:number)=>{if((dirty||prior!==latest.current)&&now-lastTick>=1000/30){drawCanvasScene(ctx,w,h,camera,latest.current);lastTick=now;prior=latest.current;dirty=false;}id=requestAnimationFrame(render);};id=requestAnimationFrame(render);
  return()=>{cancelAnimationFrame(id);ro.disconnect();el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('wheel',wheel);runtime.current=null;};
 },[]);
 useEffect(()=>{const r=runtime.current;if(r)positionCamera(r.camera,r.target,props.config,props.sim,props.view);},[props.view,props.cameraNonce]);
 return <div className="scene" ref={host} role="img" aria-label="兼容绘制的三维连杆模型，可拖动旋转与缩放"><canvas ref={canvas}/><div className="compat-badge">三维兼容绘制</div><div className="scene-coordinate"><b>Y</b> 向上 · <b>X</b> 目标方向 · <b>Z</b> 右侧</div></div>;
}
