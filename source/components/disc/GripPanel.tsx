import {useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from 'react';
import {ChevronDown, Move, X} from 'lucide-react';
import type {Config, Simulation} from '../../lib/disc/engine';
import {CONTACT_LABELS, defaultGrip, GRIP_SCHEMA, type Contact, type ContactId, type GripConfig} from '../../lib/disc/grip';

const COLORS = {thumb:'#208e82', index:'#bc7533', middle:'#527ca5'};

function ContactEditor({config, onApply, onClose}:{
  config:Config; onApply:(contacts:Contact[])=>void; onClose:()=>void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [contacts, setContacts] = useState(()=>(config.grip ?? defaultGrip(config.throwType)).contacts.map(point=>({...point})));
  const [selected, setSelected] = useState<ContactId>('thumb');
  const dragging = useRef<ContactId|null>(null);
  const current = contacts.find(point=>point.id===selected)!;
  useEffect(()=>{
    const element=dialog.current!;
    element.showModal();
    return ()=>element.close();
  },[]);

  function position(id:ContactId,u:number,v:number) {
    const scale=Math.max(1,Math.hypot(u,v)/GRIP_SCHEMA.coordinateRadius);
    setContacts(points=>points.map(point=>point.id===id?{...point,u:u/scale,v:v/scale}:point));
  }
  function pointer(event:PointerEvent<SVGSVGElement>) {
    if(!dragging.current)return;
    const box=svg.current!.getBoundingClientRect();
    position(dragging.current,((event.clientY-box.top)/box.height*400-200)/165,
      ((event.clientX-box.left)/box.width*400-200)/165);
  }
  function keyboard(event:KeyboardEvent<SVGGElement>, point:Contact) {
    const directions:Record<string,[number,number]>={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]};
    const direction=directions[event.key];
    if(!direction)return;
    event.preventDefault();setSelected(point.id);
    const step=event.shiftKey ? .05 : .01;
    position(point.id,point.u+direction[0]*step,point.v+direction[1]*step);
  }
  const total=contacts.reduce((sum,point)=>sum+point.weight,0);
  return <dialog ref={dialog} className="grip-dialog" aria-labelledby="contact-editor-title"
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{if(event.target===dialog.current)onClose();}}>
    <div className="grip-dialog-header">
      <div><h2 id="contact-editor-title">编辑手指接触位置</h2><p>{config.throwType==='backhand'?'反手':'正手'} · {config.handedness==='right'?'右手':'左手'} · 飞盘俯视</p></div>
      <button aria-label="关闭接触点编辑器" onClick={onClose}><X size={20}/></button>
    </div>
    <div className="grip-editor-layout">
      <div>
        <svg ref={svg} className="grip-map" viewBox="0 0 400 400" aria-label="可拖动手指接触点的飞盘俯视图"
          onPointerMove={pointer} onPointerUp={()=>{dragging.current=null;}} onPointerCancel={()=>{dragging.current=null;}}>
          <circle cx="200" cy="200" r="165" fill="#f8fbfc" stroke="#d8e3e6" strokeWidth="3"/>
          <circle cx="200" cy="200" r="120" fill="none" stroke="#e5edef"/>
          <path d="M35 200H365 M200 35V365" stroke="#cfdbdf" strokeDasharray="4 5"/>
          <circle cx="200" cy="200" r="4" fill="#627d89"/>
          <text x="210" y="192">盘心</text><text x="377" y="192">v</text><text x="200" y="392" textAnchor="middle">握点 G · u 方向</text>
          <circle cx="200" cy="365" r="5" fill="#bc7533"/>
          {contacts.map(point=><g key={point.id} role="button" tabIndex={0} aria-label={`拖动${CONTACT_LABELS[point.id]}接触点`}
            onFocus={()=>setSelected(point.id)} onKeyDown={event=>keyboard(event,point)}
            onPointerDown={event=>{
              event.preventDefault();event.currentTarget.focus();setSelected(point.id);
              dragging.current=point.id;event.currentTarget.setPointerCapture(event.pointerId);
            }}>
            <circle cx={200+point.v*165} cy={200+point.u*165} r={selected===point.id?15:12}
              fill={point.id==='thumb'?COLORS[point.id]:'#fff'} stroke={COLORS[point.id]} strokeWidth="3"/>
            <text x={200+point.v*165} y={180+point.u*165} textAnchor="middle" fill={COLORS[point.id]}>{CONTACT_LABELS[point.id]}</text>
          </g>)}
        </svg>
        <p className="grip-help">拖动圆点，或用方向键微调。实心圆为盘上接触，描边圆为盘下接触。坐标按盘半径归一化。</p>
      </div>
      <div className="contact-fields">
        <div className="contact-selector">{contacts.map(point=><button key={point.id}
          aria-pressed={point.id===selected} onClick={()=>setSelected(point.id)}>{CONTACT_LABELS[point.id]}</button>)}</div>
        <label>径向位置 u<input type="number" step=".01" min="-.98" max=".98" value={Number(current.u.toFixed(3))}
          onChange={event=>{const n=event.currentTarget.valueAsNumber;if(Number.isFinite(n))position(selected,n,current.v);}}/></label>
        <label>切向位置 v<input type="number" step=".01" min="-.98" max=".98" value={Number(current.v.toFixed(3))}
          onChange={event=>{const n=event.currentTarget.valueAsNumber;if(Number.isFinite(n))position(selected,current.u,n);}}/></label>
        <label>受力权重<input type="number" step=".05" min=".05" max="1" value={current.weight}
          onChange={event=>{
            const n=event.currentTarget.valueAsNumber;
            if(Number.isFinite(n))setContacts(points=>points.map(point=>point.id===selected?{...point,weight:Math.max(.05,Math.min(1,n))}:point));
          }}/></label>
        <p>当前分得总法向力的 {(current.weight/total*100).toFixed(1)}%。三个权重自动归一化。</p>
        <p className="grip-help">接触点随手移动。各点的间距和到盘心的距离决定传递转矩的能力。</p>
        <button className="grip-secondary" onClick={()=>setContacts(defaultGrip(config.throwType).contacts)}>恢复接触布局</button>
      </div>
    </div>
    <div className="grip-dialog-actions">
      <button className="grip-secondary" onClick={onClose}>取消</button>
      <button className="primary-button" onClick={()=>{onApply(contacts);onClose();}}>应用接触位置</button>
    </div>
  </dialog>;
}

function GripNumber({label,value,max,step,unit='',onChange}:{
  label:string;value:number;max:number;step:number;unit?:string;onChange:(value:number)=>void;
}) {
  return <label className="parameter">
    <span className="param-label">{label}<span className="param-number">
      <input aria-label={`${label}数值`} type="number" min="0" max={max} step={step} value={value}
        onChange={event=>{const n=event.currentTarget.valueAsNumber;if(Number.isFinite(n))onChange(Math.max(0,Math.min(max,n)));}}/>
      <small>{unit}</small>
    </span></span>
    <input aria-label={label} type="range" min="0" max={max} step={step} value={value} onChange={event=>onChange(+event.target.value)}/>
  </label>;
}

export default function GripPanel({config,onChange}: {config:Config;onChange:(grip:GripConfig)=>void}) {
  const grip=config.grip ?? defaultGrip(config.throwType);
  const [editing,setEditing]=useState(false);
  return <details className="param-section" open>
    <summary><span><Move size={14}/>握持与摩擦</span><ChevronDown size={14}/></summary>
    <div className="param-body">
      <div className="air-toggle"><span>真实握盘</span><button role="switch" aria-label="真实握盘"
        aria-checked={grip.enabled} className={`toggle ${grip.enabled?'checked':''}`}
        onClick={()=>onChange({...grip,enabled:!grip.enabled})}><span/></button></div>
      <p className="section-note">{grip.enabled?'按各接触点的摩擦能力计算滑动，脱手后接续飞行。':'沿预定动作反算摩擦力与所需握力。'}</p>
      <GripNumber label="总握持法向力" value={grip.normalForce} max={2000} step={1} unit="N" onChange={normalForce=>onChange({...grip,normalForce})}/>
      <GripNumber label="静摩擦系数" value={grip.staticFriction} max={2} step={.01} onChange={staticFriction=>onChange({...grip,staticFriction,kineticFriction:Math.min(grip.kineticFriction,staticFriction)})}/>
      <GripNumber label="动摩擦系数" value={grip.kineticFriction} max={grip.staticFriction} step={.01} onChange={kineticFriction=>onChange({...grip,kineticFriction})}/>
      <button className="grip-edit-button" onClick={()=>setEditing(true)}><Move size={14}/>编辑手指接触位置</button>
      <p className="section-note">法向力为三个接触点载荷之和。平面模型计算盘内滑移与相对转动；法向支撑、俯仰和滚转由手部理想引导。</p>
      <details className="grip-sources"><summary>默认参数与依据</summary>
        <p>初值为总法向力 20 N、静摩擦系数 0.6、动摩擦系数 0.5。法向力按 10／5／5 N 分配，参考指腹实验中 1～20 N 的载荷量级。</p>
        <p>摩擦初值根据干燥皮肤约 0.5 的研究量级选取，0.6／0.5 的静动差及接触布局是可调建模设定。具体飞盘材质与手部状态可通过实验修改。</p>
        <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6756432/" target="_blank" rel="noreferrer">Seo &amp; Armstrong · 指腹载荷与摩擦</a>
        <a href="https://doi.org/10.1016/j.wear.2012.11.030" target="_blank" rel="noreferrer">Derler &amp; Rotaru · 皮肤黏滑</a>
      </details>
    </div>
    {editing&&<ContactEditor config={config} onClose={()=>setEditing(false)} onApply={contacts=>onChange({...grip,contacts})}/>}
  </details>;
}

export function GripResults({sim,time,onSeek,onExport}:{
  sim:Simulation;time:number;onSeek:(time:number)=>void;onExport:()=>void;
}) {
  const run=sim.grip,grip=sim.config.grip ?? defaultGrip(sim.config.throwType);
  let low=0,high=run.samples.length-1;
  while(high-low>1){const middle=(low+high)>>1;if(run.samples[middle].t>time)high=middle;else low=middle;}
  const sample=run.samples[high].t<=time?run.samples[high]:run.samples[low];
  const released=grip.enabled&&time>=sim.releaseTime;
  const status=!grip.enabled?'理想握持 · 反算需求':released?'已释放':sample.status==='sliding'?'正在滑动':'静摩擦保持';
  const end=sim.config.duration*sim.config.releasePhase;
  const maximum=Math.max(1,run.peakRequiredNormal??0,grip.enabled?grip.normalForce:0);
  const x=(t:number)=>36+Math.min(t,end)/end*584;
  const y=(n:number)=>115-n/maximum*90;
  const path=run.samples.filter(point=>point.requiredNormal!==null).map((point,index)=>`${index?'L':'M'}${x(point.t)},${y(point.requiredNormal!)}`).join(' ');
  const numeric=(value:number|null,digits=1)=>value===null?'无有限解':value.toFixed(digits);
  const total=grip.contacts.reduce((sum,point)=>sum+point.weight,0);
  return <section className="grip-results" aria-label="握盘接触分析">
    <div className="grip-results-heading"><h2>握盘接触分析</h2><span className={sample.status==='sliding'&&!released?'is-sliding':''}>{status}</span></div>
    <div className="grip-metrics">
      <div><span>预定动作摩擦需求</span><b>{sample.requiredFriction.toFixed(1)} <small>N</small></b></div>
      <div><span>摩擦所需总法向力</span><b>{numeric(sample.requiredNormal)} <small>N</small></b></div>
      <div><span>法向力需求峰值</span><b>{numeric(run.peakRequiredNormal)} <small>N</small></b></div>
      <div><span>盘内相对位移</span><b>{(sample.displacement*1000).toFixed(1)} <small>mm</small></b></div>
    </div>
    <div className="grip-legend"><span>所需总法向力</span>{grip.enabled&&<span>预设 {grip.normalForce.toFixed(1)} N</span>}<small>按当前接触布局与受力分配反算</small></div>
    <svg className="grip-chart" viewBox="0 0 650 147" role="img" aria-label="预定动作所需握力与设定握力随时间的对比">
      <path d="M36 25H620 M36 70H620 M36 115H620" stroke="#e3ecee" strokeDasharray="3 4"/>
      <path d={path} fill="none" stroke="#159f92" strokeWidth="2"/>
      {grip.enabled&&<line x1="36" x2="620" y1={y(grip.normalForce)} y2={y(grip.normalForce)} stroke="#bd8040" strokeDasharray="5 4"/>}
      <line x1={x(time)} x2={x(time)} y1="20" y2="119" stroke="#38545f"/>
      {run.firstSlipTime!==null&&<circle cx={x(run.firstSlipTime)} cy="115" r="4" fill="#bd8040"/>}
      <text x="36" y="15">{maximum.toFixed(0)} N</text><text x="36" y="137">0 s</text>
      <text x="620" y="137" textAnchor="end">{end.toFixed(3)} s · 计划释放</text>
    </svg>
    <div className="grip-details-row">
      <span>当前施加摩擦 {released?'0.0':sample.appliedFriction.toFixed(1)} N</span>
      <span>相对转角 {(sample.relativeAngle*180/Math.PI).toFixed(1)}°</span>
      {run.firstSlipTime!==null&&<button onClick={()=>onSeek(run.firstSlipTime!)}>首次滑动 {run.firstSlipTime.toFixed(3)} s</button>}
      {grip.enabled&&<span>{run.releaseReason==='scheduled'?'计划释放':run.releaseReason==='zero-grip'?'零握力释放':'接触点滑出盘缘'} {sim.releaseTime.toFixed(3)} s</span>}
    </div>
    <details className="grip-contact-table"><summary>各接触点的摩擦需求与能力</summary>
      <table><thead><tr><th>接触点</th><th>预定需求 N</th><th>静摩擦上限 N</th><th>接触</th></tr></thead>
        <tbody>{grip.contacts.map((point,i)=><tr key={point.id}><th>{CONTACT_LABELS[point.id]}</th>
          <td>{sample.demandForces[i].toFixed(2)}</td><td>{(grip.staticFriction*grip.normalForce*point.weight/total).toFixed(2)}</td>
          <td>{released?'已释放':sample.activeContacts[i]?'接触中':'已脱离'}</td></tr>)}</tbody></table>
      <p>摩擦同时传递平动力与绕盘面法线的转矩。所需握力采用加权最小平方力分配，接触点重合且转矩无法满足时显示「无有限解」。</p>
    </details>
    <div className="grip-export"><span>灰色参考动作采用理想握持。</span><button onClick={onExport}>握盘数据 CSV</button></div>
  </section>;
}
