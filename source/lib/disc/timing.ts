import type {Channel, Commands, Keyframe} from './engine.ts';

export type TrackTiming = {shift:number; scale:number};
export type Timing = Partial<Record<Channel, TrackTiming>>;
export type TimingEdit = 'move' | 'start' | 'end';

export const MOTION_END_PHASE = 1.35;
export const TIMING_LIMITS = {shift:[-2, 2], scale:[0.25, 3]} as const;
export const DEFAULT_TIMING: TrackTiming = {shift:0, scale:1};
const EPSILON = 1e-10;

export function sourcePhase(phase:number, timing?:TrackTiming) {
  return timing ? (phase - timing.shift) / timing.scale : phase;
}

export function globalPhase(phase:number, timing:TrackTiming) {
  return phase * timing.scale + timing.shift;
}

export function hasTimingEdit(timing?:TrackTiming) {
  return !!timing && (Math.abs(timing.shift) > EPSILON || Math.abs(timing.scale - 1) > EPSILON);
}

export function editedTrackCount(timing?:Timing) {
  return Object.values(timing ?? {}).filter(hasTimingEdit).length;
}

function activeInterval(keys:Keyframe[]): [number, number] {
  return keys.length >= 4
    ? [keys[1].t, keys[keys.length - 2].t]
    : [keys[0].t, keys[keys.length - 1].t];
}

export function trackInterval(keys:Keyframe[], timing:TrackTiming): [number, number] {
  const [start, end] = activeInterval(keys);
  return [globalPhase(start, timing), globalPhase(end, timing)];
}

function minimumScale(keys:Keyframe[]) {
  let scale: number = TIMING_LIMITS.scale[0];
  for (let i = 1; i < keys.length; i++) {
    const gap = keys[i].t - keys[i - 1].t;
    const angle = Math.abs(keys[i].value - keys[i - 1].value);
    scale = Math.max(scale, 0.005 / gap, angle / (gap * 1800));
  }
  return scale;
}

const clamp = (value:number, min:number, max:number) => Math.max(min, Math.min(max, value));

export function editTrack(keys:Keyframe[], timing:TrackTiming, mode:TimingEdit, phase:number): TrackTiming {
  if (!Number.isFinite(phase)) return {...timing};
  const [sourceStart, sourceEnd] = activeInterval(keys);
  const span = sourceEnd - sourceStart;
  const [start, end] = trackInterval(keys, timing);
  const [minShift, maxShift] = TIMING_LIMITS.shift;
  if (mode === 'move') {
    const nextStart = clamp(phase, 0, Math.max(0, MOTION_END_PHASE - (end - start)));
    return {scale:timing.scale, shift:clamp(timing.shift + nextStart - start, minShift, maxShift)};
  }

  const scaleLimit = minimumScale(keys);
  const maxScale = TIMING_LIMITS.scale[1];
  if (mode === 'start') {
    const min = Math.max(scaleLimit, (end - maxShift) / sourceEnd);
    const max = Math.min(maxScale, end / span, (end - minShift) / sourceEnd);
    if (max < min) return {...timing};
    const scale = clamp((end - phase) / span, min, max);
    return {scale, shift:clamp(end - sourceEnd * scale, minShift, maxShift)};
  }

  const min = Math.max(scaleLimit, sourceStart > 0 ? (start - maxShift) / sourceStart : 0);
  const max = Math.min(maxScale, (MOTION_END_PHASE - start) / span,
    sourceStart > 0 ? (start - minShift) / sourceStart : maxScale);
  if (max < min) return {...timing};
  const scale = clamp((phase - start) / span, min, max);
  return {scale, shift:clamp(start - sourceStart * scale, minShift, maxShift)};
}

export function validateTiming(value:unknown, commands:Commands, channels:Channel[]): Timing | undefined {
  if (value == null) return;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('timing 必须为关节时序对象');
  const timing: Timing = {};
  for (const [key, track] of Object.entries(value)) {
    const channel = key as Channel;
    if (!channels.includes(channel)) throw new Error(`未知时序轨道：${key}`);
    if (!track || typeof track !== 'object' || Array.isArray(track)) {
      throw new Error(`timing.${key} 需要 shift 与 scale`);
    }
    const {shift, scale} = track as Record<string, unknown>;
    const [minShift, maxShift] = TIMING_LIMITS.shift;
    const [minScale, maxScale] = TIMING_LIMITS.scale;
    if (typeof shift !== 'number' || !Number.isFinite(shift) || shift < minShift || shift > maxShift) {
      throw new Error(`timing.${key}.shift 必须在 −2～2 相位之间`);
    }
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale < minScale - EPSILON ||
      scale > maxScale + EPSILON || scale < minimumScale(commands[channel]) - EPSILON) {
      throw new Error(`timing.${key}.scale 须在 0.25～3 之间，且保持关键帧间距 ≥ 0.005、相邻角度变化率 ≤ 1800°/相位`);
    }
    timing[channel] = {shift, scale};
  }
  return Object.keys(timing).length ? timing : undefined;
}
