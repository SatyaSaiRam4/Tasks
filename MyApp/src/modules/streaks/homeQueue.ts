import type { CelebrationSpec } from '../../components/Celebration';

/**
 * Congratulations that wait for Home: achievements earned while ticking a
 * task on another screen are shown the next time Home is on screen, right
 * after any badge reveal, so no card ever stacks behind "+1 streak".
 */
const waiting: CelebrationSpec[] = [];
const listeners = new Set<() => void>();

export function queueForHome(spec: CelebrationSpec) {
  waiting.push(spec);
  listeners.forEach(fn => fn());
}

export function takeQueuedForHome(): CelebrationSpec[] {
  return waiting.splice(0, waiting.length);
}

export function hasQueuedForHome() {
  return waiting.length > 0;
}

export function subscribeHomeQueue(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
