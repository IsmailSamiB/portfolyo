import { emit } from '../bridge.js';

// Oyun girdisini kilitleyen tek durum: aşağıdakilerden herhangi biri açıksa kilitli.
const state = { panel: false, dialog: false, classic: false, title: false, overlay: false };
let locked = false;

export function setLock(key, value) {
  if (!(key in state)) return;
  state[key] = Boolean(value);
  const next = Object.values(state).some(Boolean);
  if (next === locked) return;
  locked = next;
  emit('ui:lock', { locked });
}

export function isLocked() {
  return locked;
}
