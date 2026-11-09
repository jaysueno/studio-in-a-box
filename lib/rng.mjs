// A small seeded random number generator. Same seed, same sequence, on every platform.
// It never touches Math.random, the clock or the network.

export function makeRng(seed) {
  let state = (Number(seed) >>> 0) || 0x9e3779b9;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  function float() {
    return next() / 4294967296;
  }

  function int(min, max) {
    return min + Math.floor(float() * (max - min + 1));
  }

  function pick(list) {
    return list[int(0, list.length - 1)];
  }

  return { next, float, int, pick };
}

// A version 4 shaped identifier drawn from the generator, so a given seed always produces the
// same identifiers. Dashes keep every hex run short.
export function uid(rng) {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = rng.int(0, 255);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}
