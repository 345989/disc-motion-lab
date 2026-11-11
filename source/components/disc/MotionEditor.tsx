import {useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent} from 'react';
import {ChevronDown, ChevronUp, GripVertical, Layers, RotateCcw} from 'lucide-react';
import {getCommands, interpolate, LABELS, type Channel, type Config, type Keyframe} from '../../lib/disc/engine';
import {
  DEFAULT_TIMING, MOTION_END_PHASE, editedTrackCount, editTrack, globalPhase,
  hasTimingEdit, sourcePhase, trackInterval, type Timing, type TimingEdit, type TrackTiming,
} from '../../lib/disc/timing';

const primary: Channel[] = ['shoulder', 'elbow', 'wrist'];
const secondary: Channel[] = ['pelvis', 'torso', 'elevation', 'forearm', 'wristPitch'];
const tracks: Record<Channel, {label:string; color:string}> = {
  shoulder:{label:'大臂 · 挥动', color:'#208e82'},
  elbow:{label:'小臂 · 展开', color:'#527ca5'},
  wrist:{label:'手腕 · 出盘', color:'#bd8040'},
  pelvis:{label:'骨盆 · 转动', color:'#8771a5'},
  torso:{label:'胸廓 · 转动', color:'#727da0'},
  elevation:{label:'大臂 · 抬升', color:'#528e76'},
  forearm:{label:'小臂 · 轴向旋转', color:'#658ba1'},
  wristPitch:{label:'手腕 · 屈伸', color:'#ad7c78'},
};
const ticks = [0, 0.25, 0.5, 0.75, 1, 1.25];
const percent = (phase:number) => `${phase / MOTION_END_PHASE * 100}%`;
const formatMs = (value:number) => Number(value.toFixed(1)).toString();

function MillisecondsInput({label, value, onChange}: {label:string; value:number; onChange:(ms:number)=>void}) {
  const [text, setText] = useState(formatMs(value));
  const cancelled = useRef(false);
  useEffect(() => setText(formatMs(value)), [value]);
  return <label>
    {label}
    <span>
      <input aria-label={`选中轨道${label}毫秒`} type="number" step={1} value={text}
        onChange={event => setText(event.target.value)}
        onBlur={() => {
          const next = Number(text);
          if (!cancelled.current && text.trim() && Number.isFinite(next)) onChange(next);
          cancelled.current = false;
          setText(formatMs(value));
        }}
        onKeyDown={event => {
          if (event.key === 'Escape') cancelled.current = true;
          if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur();
        }}/>
      <small>ms</small>
    </span>
  </label>;
}

function TrackCurve({keys, timing}: {keys:Keyframe[]; timing:TrackTiming}) {
  const values = keys.map(key => key.value);
  const min = Math.min(...values);
  const range = Math.max(1, Math.max(...values) - min);
  const y = (angle:number) => 40 - (angle - min) / range * 26;
  const path = Array.from({length:100}, (_, index) => {
    const fraction = index / 99;
    const angle = interpolate(keys, sourcePhase(fraction * MOTION_END_PHASE, timing));
    return `${index ? 'L' : 'M'}${fraction * 1000},${y(angle)}`;
  }).join(' ');

  return <svg className="motion-curve" viewBox="0 0 1000 52" preserveAspectRatio="none" aria-hidden="true">
    <path d={path} fill="none" stroke="currentColor" strokeWidth="1.2" vectorEffect="non-scaling-stroke"/>
    {keys.map(key => {
      const phase = globalPhase(key.t, timing);
      return phase >= 0 && phase <= MOTION_END_PHASE &&
        <circle key={key.t} cx={phase / MOTION_END_PHASE * 1000} cy={y(key.value)} r="3" vectorEffect="non-scaling-stroke"/>;
    })}
  </svg>;
}

type Drag = {
  channel:Channel; mode:TimingEdit; pointerId:number; x:number; width:number;
  initial:TrackTiming; anchor:number;
};
type Props = {
  config:Config; time:number; onPause:()=>void; onSeek:(seconds:number)=>void;
  onChange:(timing:Timing | undefined)=>void;
};

export default function MotionEditor({config, time, onPause, onSeek, onChange}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [showSecondary, setShowSecondary] = useState(false);
  const [selected, setSelected] = useState<Channel>('wrist');
  const [preview, setPreview] = useState<{channel:Channel; timing:TrackTiming} | null>(null);
  const [status, setStatus] = useState('');
  const drag = useRef<Drag | null>(null);
  const {commands, throwType, preset, timing, duration, releasePhase} = config;
  const keys = useMemo(() => getCommands(config), [commands, throwType, preset]);
  const releaseLine = percent(releasePhase);
  const playhead = percent(Math.max(0, Math.min(MOTION_END_PHASE, time / duration)));
  const editCount = editedTrackCount(timing);
  const toMs = (phase:number) => phase * duration * 1000;
  const timingFor = (channel:Channel) => preview?.channel === channel
    ? preview.timing : timing?.[channel] ?? DEFAULT_TIMING;
  const selectedTiming = timingFor(selected);
  const [selectedStart, selectedEnd] = trackInterval(keys[selected], selectedTiming);
  const isConstant = (channel:Channel) => keys[channel].every(key => key.value === keys[channel][0].value);
  const hasHiddenKeys = globalPhase(keys[selected][0].t, selectedTiming) < -1e-7 ||
    globalPhase(keys[selected].at(-1)!.t, selectedTiming) > MOTION_END_PHASE + 1e-7;

  useEffect(() => {
    drag.current = null;
    setPreview(null);
  }, [config]);

  function commit(channel:Channel, next:TrackTiming) {
    const updated = {...timing};
    if (hasTimingEdit(next)) updated[channel] = next;
    else delete updated[channel];
    onChange(Object.keys(updated).length ? updated : undefined);
    const [start, end] = trackInterval(keys[channel], next);
    setStatus(`${tracks[channel].label}已更新：${formatMs(toMs(start))} 至 ${formatMs(toMs(end))} 毫秒`);
  }

  function startDrag(event:PointerEvent<HTMLButtonElement>, channel:Channel, mode:TimingEdit) {
    if (event.button !== 0 || drag.current) return;
    const width = event.currentTarget.closest('.motion-lane')?.getBoundingClientRect().width;
    if (!width) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    const initial = timingFor(channel);
    const [start, end] = trackInterval(keys[channel], initial);
    drag.current = {channel, mode, pointerId:event.pointerId, x:event.clientX, width, initial,
      anchor:mode === 'end' ? end : start};
    setSelected(channel);
    setPreview({channel, timing:initial});
    onPause();
  }

  function dragTiming(active:Drag, x:number) {
    const phase = active.anchor + (x - active.x) / active.width * MOTION_END_PHASE;
    return editTrack(keys[active.channel], active.initial, active.mode, phase);
  }

  function moveDrag(event:PointerEvent<HTMLButtonElement>) {
    const active = drag.current;
    if (active?.pointerId === event.pointerId) {
      setPreview({channel:active.channel, timing:dragTiming(active, event.clientX)});
    }
  }

  function finishDrag(event:PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = drag.current;
    if (active?.pointerId !== event.pointerId) return;
    drag.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cancelled) commit(active.channel, dragTiming(active, event.clientX));
  }

  function moveWithKeys(event:KeyboardEvent<HTMLButtonElement>, channel:Channel, mode:TimingEdit) {
    if (event.key === 'Escape') {
      drag.current = null;
      setPreview(null);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    onPause();
    setSelected(channel);
    const initial = timingFor(channel);
    const [start, end] = trackInterval(keys[channel], initial);
    const direction = event.key === 'ArrowRight' ? 1 : -1;
    const step = direction * (event.shiftKey ? 10 : 1) / (duration * 1000);
    commit(channel, editTrack(keys[channel], initial, mode, (mode === 'end' ? end : start) + step));
  }

  function control(channel:Channel, mode:TimingEdit, label:string, phase:number, valueText:string) {
    return {
      role:'slider', 'aria-label':tracks[channel].label + label,
      'aria-valuemin':0, 'aria-valuemax':Math.round(toMs(MOTION_END_PHASE)),
      'aria-valuenow':Number(formatMs(toMs(phase))), 'aria-valuetext':valueText,
      onPointerDown:(event:PointerEvent<HTMLButtonElement>) => startDrag(event, channel, mode),
      onPointerMove:moveDrag, onPointerUp:finishDrag,
      onPointerCancel:(event:PointerEvent<HTMLButtonElement>) => finishDrag(event, true),
      onLostPointerCapture:(event:PointerEvent<HTMLButtonElement>) => finishDrag(event, true),
      onKeyDown:(event:KeyboardEvent<HTMLButtonElement>) => moveWithKeys(event, channel, mode),
      onFocus:() => setSelected(channel),
    };
  }

  function editSelected(mode:'move' | 'end', value:number) {
    onPause();
    commit(selected, editTrack(keys[selected], selectedTiming, mode, value / duration / 1000));
  }

  return <section className="motion-editor" aria-label="多轨相对时序编辑器">
    <div className="motion-heading">
      <div><Layers size={15}/><h2>关节相对时序</h2><span>{editCount ? `${editCount} 轨已调整` : '独立动作轨道'}</span></div>
      <button className="motion-collapse" aria-expanded={expanded} aria-label={expanded ? '收起多轨时序' : '展开多轨时序'}
        onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</button>
    </div>
    {expanded && <>
      <p className="motion-intro">拖色块调整先后，拖两端改变快慢；松手后更新模拟。</p>
      <div className="motion-axis-row">
        <span>动作轨道</span>
        <div className="motion-axis">
          <button className="motion-release-label" style={{left:releaseLine}} title="跳至释放瞬间"
            onClick={() => onSeek(duration * releasePhase)}>释放 {formatMs(toMs(releasePhase))} ms</button>
          {ticks.map(tick => <span key={tick} style={{left:percent(tick)}}>{Math.round(toMs(tick))}</span>)}
          <small>ms</small>
        </div>
      </div>
      <div className="motion-tracks">
        {(showSecondary ? [...primary, ...secondary] : primary).map(channel => {
          const track = timingFor(channel);
          const [start, end] = trackInterval(keys[channel], track);
          const visibleStart = Math.max(0, Math.min(MOTION_END_PHASE, start));
          const visibleEnd = Math.max(visibleStart, Math.min(MOTION_END_PHASE, end));
          const range = `${formatMs(toMs(start))}–${formatMs(toMs(end))} ms`;
          return <div key={channel}
            className={`motion-row ${selected === channel ? 'is-selected' : ''} ${preview?.channel === channel ? 'is-dragging' : ''}`}
            style={{'--track-color':tracks[channel].color} as CSSProperties}>
            <button className="motion-track-name" aria-pressed={selected === channel} title={LABELS[channel]}
              onClick={() => setSelected(channel)}>
              <b><i/>{tracks[channel].label}</b>
              <small>{isConstant(channel) ? '恒定角度' : hasTimingEdit(track) ? `时长 ×${track.scale.toFixed(2)}` : '原始时序'}</small>
            </button>
            <div className="motion-lane" onClick={() => setSelected(channel)}>
              {ticks.map(tick => <i key={tick} className="motion-gridline" style={{left:percent(tick)}}/>)}
              <TrackCurve keys={keys[channel]} timing={track}/>
              <div className="motion-clip" style={{left:percent(visibleStart), width:percent(visibleEnd - visibleStart)}}>
                <button className="motion-handle start" title="拖动左端：改变动作时长，右端不动"
                  {...control(channel, 'start', '区间起点', start, `${formatMs(toMs(start))} 毫秒`)}><span/></button>
                <button className="motion-clip-body" title={`${range} · 拖动平移整条动作曲线`}
                  {...control(channel, 'move', '整体时序', start, range)}><GripVertical size={13}/><span>{range}</span></button>
                <button className="motion-handle end" title="拖动右端：改变动作时长，左端不动"
                  {...control(channel, 'end', '区间终点', end, `${formatMs(toMs(end))} 毫秒`)}><span/></button>
              </div>
              <span className="motion-release-line" style={{left:releaseLine}}/>
              <span className="motion-playhead" style={{left:playhead}}/>
            </div>
          </div>;
        })}
      </div>
      <div className="motion-tools">
        <button className="motion-more" aria-expanded={showSecondary} onClick={() => {
          setShowSecondary(!showSecondary);
          if (showSecondary && !primary.includes(selected)) setSelected('wrist');
        }}>
          {showSecondary ? <ChevronUp size={13}/> : <ChevronDown size={13}/>} {showSecondary ? '收起辅助轨道' : '展开另外 5 条关节轨道'}
        </button>
        <button className="motion-reset-all" disabled={!editCount} onClick={() => {
          onPause();
          onChange(undefined);
          setStatus('全部轨道已恢复原始时序，角度与其它参数保留');
        }}><RotateCcw size={12}/>重置全部时序</button>
      </div>
      <div className="motion-selection">
        <b style={{color:tracks[selected].color}}>{tracks[selected].label}</b>
        <MillisecondsInput label="起点" value={toMs(selectedStart)} onChange={value => editSelected('move', value)}/>
        <MillisecondsInput label="终点" value={toMs(selectedEnd)} onChange={value => editSelected('end', value)}/>
        <button disabled={!hasTimingEdit(timing?.[selected])} title="只重置当前轨道的时间变换"
          onClick={() => {onPause(); commit(selected, DEFAULT_TIMING);}}>重置本轨</button>
      </div>
      <p className="motion-detail">
        起点数值平移整轨，终点数值伸缩片段；方向键微调 1 ms，Shift + 方向键 10 ms。
        {isConstant(selected) && <strong>本轨角度恒定，调整时序不会产生新动作。</strong>}
        {hasHiddenKeys && <strong>本轨部分前后过渡位于显示窗口之外。</strong>}
      </p>
      <details className="motion-help">
        <summary>色块、曲线与释放线分别代表什么？</summary>
        <p>色块标出中间关键帧的主要动作区间，并不代表肌肉开始或停止发力。细线是整条角度曲线，圆点是关键帧；平移或伸缩会连同前后过渡一起改变时序，角度值不变。释放线独立于各轨，离手后的动作不再影响飞盘。</p>
        <p>各轨控制相对关节角，上游关节仍会带动下游连杆。小臂“展开”由肘关节控制，“轴向旋转”是另一条轨道。配置导出会保存全部时序；原有 JSON 编辑器仍可编辑基础角度曲线。</p>
      </details>
      <span className="motion-status" role="status" aria-live="polite">
        {preview ? '正在调整，松手后计算；Esc 取消' : status}
      </span>
    </>}
  </section>;
}
