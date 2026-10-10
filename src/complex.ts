/** Rectangular complex numbers. Physical AC phasors are RMS; phases are radians. */
export interface Complex { re: number; im: number }
export const complex = (re: number, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex => complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const scale = (a: Complex, b: number): Complex => complex(a.re * b, a.im * b);
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export function div(a: Complex, b: Complex): Complex {
  // Normalize the divisor to avoid squaring its potentially huge magnitude.
  const s = Math.max(Math.abs(b.re), Math.abs(b.im));
  if (s === 0) throw new RangeError('Complex division by zero');
  const r = b.re / s, i = b.im / s, d = r * r + i * i;
  return complex(((a.re / s) * r + (a.im / s) * i) / d,
    ((a.im / s) * r - (a.re / s) * i) / d);
}
export const polar = (z: Complex) => ({ magnitude: abs(z), phaseRadians: Math.atan2(z.im, z.re) });
export const finiteComplex = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);
