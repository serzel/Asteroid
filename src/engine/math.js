export function wrap(value, max) {
  // Wrap dans [0, max)
  value %= max;
  return value < 0 ? value + max : value;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function rand(min, max) {
  return min + Math.random() * (max - min);
}


export function dot(ax, ay, bx, by) {
  return ax * bx + ay * by;
}
