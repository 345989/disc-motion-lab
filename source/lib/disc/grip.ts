import {Vector3 as V, Quaternion as Q} from 'three';
import type {Config, Pose, ThrowType} from './engine.ts';

export const CONTACT_IDS = ['thumb', 'index', 'middle'] as const;
export type ContactId = typeof CONTACT_IDS[number];
export type Contact = {id:ContactId; u:number; v:number; weight:number};
export type GripConfig = {enabled:boolean; normalForce:number; staticFriction:number; kineticFriction:number; contacts:Contact[]};
export const GRIP_SCHEMA = {
  normalForce:[0, 2000], staticFriction:[0, 2], kineticFriction:[0, 2],
  coordinateRadius:0.98, contactWeight:[0.05, 1], contactIds:CONTACT_IDS,
  normalForceUnit:'N, sum of all contact normal loads', coordinateUnit:'disc radius',
  coordinates:'u points from disc center to the prescribed grip point; v is the mirrored in-plane tangent',
};
export const CONTACT_LABELS: Record<ContactId, string> = {thumb:'拇指', index:'食指', middle:'中指'};

export function defaultGrip(type:ThrowType = 'backhand'): GripConfig {
  return {enabled:false, normalForce:20, staticFriction:0.6, kineticFriction:0.5,
    contacts:[
      {id:'thumb', u:0.72, v:0, weight:0.5},
      {id:'index', u:type === 'forehand' ? 0.82 : 0.9, v:0.13, weight:0.25},
      {id:'middle', u:type === 'forehand' ? 0.94 : 0.9, v:-0.13, weight:0.25},
    ]};
}

export function validateGrip(value:unknown, type:ThrowType): GripConfig {
  if (value == null) return defaultGrip(type);
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('grip 必须为握盘参数对象');
  const input = value as Record<string, unknown>;
  if (typeof input.enabled !== 'boolean') throw new Error('grip.enabled 必须为布尔值');
  const result = defaultGrip(type);
  result.enabled = input.enabled;
  for (const key of ['normalForce', 'staticFriction', 'kineticFriction'] as const) {
    const number = input[key], [min, max] = GRIP_SCHEMA[key];
    if (typeof number !== 'number' || !Number.isFinite(number) || number < min || number > max) {
      throw new Error(`grip.${key} 必须在 ${min}～${max} 之间`);
    }
    result[key] = number;
  }
  if (result.kineticFriction > result.staticFriction) throw new Error('此库仑模型要求动摩擦系数 ≤ 静摩擦系数');
  if (!Array.isArray(input.contacts) || input.contacts.length !== 3) throw new Error('需要拇指、食指和中指三个有效接触点');
  result.contacts = CONTACT_IDS.map(id => {
    const matches = (input.contacts as Contact[]).filter(point => point && point.id === id);
    if (matches.length !== 1) throw new Error(`接触点 ${id} 必须出现一次`);
    const point = matches[0];
    if (![point.u, point.v, point.weight].every(n => typeof n === 'number' && Number.isFinite(n)) ||
      Math.hypot(point.u, point.v) > GRIP_SCHEMA.coordinateRadius + 1e-10 ||
      point.weight < 0.05 || point.weight > 1) throw new Error(`接触点 ${id} 的位置或受力权重超出范围`);
    return {id, u:point.u, v:point.v, weight:point.weight};
  });
  return result;
}

export function contactOffsets(c:Config): V[] {
  const angle = c.gripAngle * Math.PI / 180, mirror = c.handedness === 'left' ? -1 : 1;
  const radial = new V(-Math.cos(angle), 0, -Math.sin(angle) * mirror);
  const tangent = new V(radial.z * mirror, 0, -radial.x * mirror);
  return (c.grip ?? defaultGrip(c.throwType)).contacts.map(point =>
    radial.clone().multiplyScalar(point.u * c.radius).addScaledVector(tangent, point.v * c.radius));
}

export function contactPositions(c:Config, pose:Pose): V[] {
  return contactOffsets(c).map((offset, index) => offset
    .add(new V(0, index === 0 ? 0.018 : -0.018, 0))
    .applyQuaternion(pose.discQ).add(pose.center));
}

export type Motion = {pose:Pose; v:V; omega:V; acceleration:V; alpha:V};
export type HeldState = {t:number; p:V; q:Q; v:V; omega:V};
export type GripSample = {
  t:number; status:'ideal'|'sticking'|'sliding'|'released';
  requiredFriction:number; requiredNormal:number|null; requiredTorque:number; normalReaction:number;
  staticCapacity:number; appliedFriction:number; frictionPower:number;
  displacement:number; relativeAngle:number; relativeSpeed:number;
  activeContacts:boolean[]; contactForces:number[]; demandForces:number[]; geometryFeasible:boolean;
};
export type GripRun = {
  samples:GripSample[]; states:HeldState[]; releaseTime:number;
  releaseReason:'scheduled'|'contacts-lost'|'zero-grip'; firstSlipTime:number|null;
  peakRequiredFriction:number; peakRequiredNormal:number|null; maxDisplacement:number;
};

type Allocation = {forces:V[]; feasible:boolean; requiredNormal:number|null; total:number};
const moment = (r:V, f:V) => r.z * f.x - r.x * f.z;

// Weighted least-norm force allocation satisfying planar force and yaw torque.
// The reported normal load is sufficient for this allocation, not a global optimum.
export function allocateFriction(force:V, torque:number, offsets:V[], weights:number[], mu:number): Allocation {
  const sum = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map(weight => sum > 0 ? weight / sum : 0);
  const centroid = offsets.reduce((point, offset, index) => point.addScaledVector(offset, shares[index]), new V());
  const spread = offsets.reduce((total, point, index) => total + shares[index] * point.distanceToSquared(centroid), 0);
  const residual = torque - moment(centroid, force);
  const feasible = sum > 0 && (spread > 1e-12 || Math.abs(residual) < 1e-8);
  const couple = spread > 1e-12 ? residual / spread : 0;
  const forces = offsets.map((offset, index) => {
    const delta = offset.clone().sub(centroid);
    return force.clone().addScaledVector(new V(delta.z, 0, -delta.x), couple).multiplyScalar(shares[index]);
  });
  const ratios = forces.map((f, index) => shares[index] > 0 ? f.length() / shares[index] : 0);
  const budget = Math.max(0, ...ratios);
  const requiredNormal = !feasible || (mu === 0 && budget > 1e-9) ? null : mu > 0 ? budget / mu : 0;
  return {forces, feasible, requiredNormal, total:forces.reduce((total, f) => total + f.length(), 0)};
}

// Solve a two-dimensional friction impulse on its circular Coulomb limit.
// The mass matrix is diagonal in radial/tangential contact coordinates.
function contactImpulse(ux:number, uz:number, r:V, mass:number, inertia:number, limit:number): V {
  if (limit === 0) return new V();
  const length = Math.hypot(r.x, r.z);
  const rx = length > 1e-12 ? r.x / length : 1, rz = length > 1e-12 ? r.z / length : 0;
  const radial = ux * rx + uz * rz, tangent = ux * rz - uz * rx;
  const a = 1 / mass, b = a + length * length / inertia;
  let lambda = 0;
  if (Math.hypot(radial / a, tangent / b) > limit) {
    let low = 0, high = Math.hypot(ux, uz) / limit;
    for (let iteration = 0; iteration < 28; iteration++) {
      lambda = (low + high) / 2;
      if (Math.hypot(radial / (a + lambda), tangent / (b + lambda)) > limit) low = lambda;
      else high = lambda;
    }
    lambda = high;
  }
  const pr = -radial / (a + lambda), pt = -tangent / (b + lambda);
  return new V(pr * rx + pt * rz, 0, pr * rz - pt * rx);
}

export function frictionStep(velocity:V, spin:number, offsets:V[], limits:number[], mass:number, inertia:number) {
  const v = velocity.clone(), impulses = offsets.map(() => new V());
  let w = spin;
  for (let iteration = 0; iteration < 60; iteration++) {
    let largestChange = 0;
    offsets.forEach((r, index) => {
      const old = impulses[index], oldSpin = moment(r, old) / inertia;
      const ux = v.x + w * r.z - old.x / mass - oldSpin * r.z;
      const uz = v.z - w * r.x - old.z / mass + oldSpin * r.x;
      const next = contactImpulse(ux, uz, r, mass, inertia, limits[index]);
      const delta = next.clone().sub(old);
      v.addScaledVector(delta, 1 / mass);
      w += moment(r, delta) / inertia;
      largestChange = Math.max(largestChange, delta.length());
      impulses[index] = next;
    });
    if (largestChange < 1e-11) break;
  }
  const relativeWork = 0.5 * mass * (v.lengthSq() - velocity.lengthSq()) +
    0.5 * inertia * (w * w - spin * spin);
  return {v, spin:w, impulses, relativeWork};
}

export function simulateGrip(c:Config, motionAt:(seconds:number)=>Motion, step=1/960): GripRun {
  const grip = c.grip ?? defaultGrip(c.throwType), anchors = contactOffsets(c);
  const totalWeight = grip.contacts.reduce((sum, point) => sum + point.weight, 0);
  const weights = grip.contacts.map(point => point.weight / totalWeight);
  const scheduled = c.duration * c.releasePhase;
  const count = Math.max(1, Math.ceil(scheduled / step)), dt = scheduled / count;
  const displacement = new V(), relativeVelocity = new V();
  let angle = 0, spin = 0, firstSlipTime:number|null = null;
  let releaseTime = scheduled, reason:GripRun['releaseReason'] = 'scheduled';
  let released = grip.enabled && grip.normalForce === 0;
  if (released) { releaseTime = 0; reason = 'zero-grip'; }
  const active = anchors.map(() => !released);
  const samples:GripSample[] = [], states:HeldState[] = [];
  let maxDisplacement = 0, peakFriction = 0, peakNormal:number|null = 0;
  let forces = anchors.map(() => 0), power = 0;
  let status:GripSample['status'] = grip.enabled ? 'sticking' : 'ideal';

  function state(t:number, motion:Motion): HeldState {
    const offset = displacement.clone().applyQuaternion(motion.pose.discQ);
    const normal = motion.pose.normal;
    return {t, p:motion.pose.center.clone().add(offset),
      q:motion.pose.discQ.clone().multiply(new Q().setFromAxisAngle(new V(0,1,0), angle)).normalize(),
      v:motion.v.clone().add(motion.omega.clone().cross(offset)).add(relativeVelocity.clone().applyQuaternion(motion.pose.discQ)),
      omega:motion.omega.clone().addScaledVector(normal, spin)};
  }

  let motion = motionAt(0);
  states.push(state(0, motion));
  for (let index = 0; index <= count; index++) {
    const t = index * dt, inverse = motion.pose.discQ.clone().invert();
    const omegaLocal = motion.omega.clone().applyQuaternion(inverse);
    const alphaLocal = motion.alpha.clone().applyQuaternion(inverse);
    const acceleration = motion.acceleration.clone().add(new V(0,9.80665,0)).applyQuaternion(inverse);
    const normalReaction = acceleration.y * c.discMass;
    acceleration.y = 0;
    const ideal = allocateFriction(acceleration.clone().multiplyScalar(c.discMass),
      c.inertiaAxial * alphaLocal.y, anchors, weights, grip.staticFriction);
    peakFriction = Math.max(peakFriction, ideal.total);
    peakNormal = peakNormal === null || ideal.requiredNormal === null ? null : Math.max(peakNormal, ideal.requiredNormal);

    const ended = grip.enabled && (released || index === count);
    const snapshot:GripSample = {t, status:ended ? 'released' : status,
        requiredFriction:ideal.total, requiredNormal:ideal.requiredNormal, requiredTorque:c.inertiaAxial * alphaLocal.y,
        normalReaction, staticCapacity:ended ? 0 : grip.normalForce * grip.staticFriction * weights.reduce((sum,w,i)=>sum+(active[i]?w:0),0),
        appliedFriction:ended ? 0 : grip.enabled ? forces.reduce((sum, f)=>sum+f,0) : ideal.total, frictionPower:ended ? 0 : power,
        displacement:displacement.length(), relativeAngle:angle, relativeSpeed:relativeVelocity.length(),
        activeContacts:active.map(value=>!ended&&value),
        contactForces:ended ? anchors.map(()=>0) : grip.enabled ? [...forces] : ideal.forces.map(force=>force.length()),
        demandForces:ideal.forces.map(force=>force.length()), geometryFeasible:ideal.feasible};
    samples.push(snapshot);
    if (index === count) break;
    const nextMotion = motionAt((index + 1) * dt);
    if (grip.enabled && !released) {
      const offsets = anchors.map(point => point.clone().sub(displacement));
      const external = acceleration.clone().negate()
        .addScaledVector(omegaLocal.clone().cross(relativeVelocity), -2)
        .sub(alphaLocal.clone().cross(displacement))
        .sub(omegaLocal.clone().cross(omegaLocal.clone().cross(displacement)));
      external.y = 0;
      const currentWeights = weights.map((w,i)=>active[i]?w:0);
      const allocated = allocateFriction(external.clone().multiplyScalar(-c.discMass),
        c.inertiaAxial * alphaLocal.y, offsets, currentWeights, grip.staticFriction);
      const canStick = allocated.feasible && allocated.forces.every((f,i)=>
        f.length() <= grip.staticFriction * grip.normalForce * currentWeights[i] + 1e-9);
      if (relativeVelocity.length() + Math.abs(spin) * c.radius < 1e-7 && canStick) {
        relativeVelocity.set(0,0,0); spin = 0;
        forces = allocated.forces.map(f=>f.length()); power = 0; status = 'sticking';
      } else {
        if (firstSlipTime === null) firstSlipTime = t;
        status = 'sliding';
        const freeVelocity = relativeVelocity.clone().addScaledVector(external, dt);
        const freeSpin = spin - alphaLocal.y * dt;
        const result = frictionStep(freeVelocity, freeSpin, offsets,
          currentWeights.map(w=>grip.kineticFriction * grip.normalForce * w * dt), c.discMass, c.inertiaAxial);
        relativeVelocity.copy(result.v); spin = result.spin;
        displacement.addScaledVector(relativeVelocity, dt); angle += spin * dt;
        forces = result.impulses.map(impulse=>impulse.length()/dt); power = result.relativeWork / dt;
        anchors.forEach((point, i) => { if (point.distanceTo(displacement) > c.radius) active[i] = false; });
        maxDisplacement = Math.max(maxDisplacement, displacement.length());
        if (active.every(value => !value)) {
          released = true; releaseTime = (index + 1) * dt; reason = 'contacts-lost';
        }
      }
      // Forces describe the interval starting at t; kinematics describe its start.
      snapshot.status = status;
      snapshot.appliedFriction = forces.reduce((sum, force)=>sum+force,0);
      snapshot.contactForces = [...forces];
      snapshot.frictionPower = power;
    }
    if (!released || Math.abs((index + 1) * dt - releaseTime) < 1e-10) states.push(state((index + 1) * dt, nextMotion));
    motion = nextMotion;
  }
  return {samples, states, releaseTime, releaseReason:reason, firstSlipTime,
    peakRequiredFriction:peakFriction, peakRequiredNormal:peakNormal, maxDisplacement};
}

export function heldStateAt(run:GripRun, time:number): HeldState {
  const states = run.states;
  if (time <= 0) return states[0];
  if (time >= states.at(-1)!.t) return states.at(-1)!;
  let low = 0, high = states.length - 1;
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (states[middle].t > time) high = middle; else low = middle;
  }
  const a = states[low], b = states[high], fraction = (time - a.t) / (b.t - a.t);
  return {t:time, p:a.p.clone().lerp(b.p,fraction), q:a.q.clone().slerp(b.q,fraction),
    v:a.v.clone().lerp(b.v,fraction), omega:a.omega.clone().lerp(b.omega,fraction)};
}
