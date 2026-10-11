/**
 * Rectangular complex arithmetic for the kernel's frequency-domain solves.
 * Components are real/imaginary SI-valued coefficients; physical AC phasors
 * use RMS amplitude, and polar phases are radians.
 */
export interface Complex { re: number; im: number }
export const complex = (re: number, im = 0): Complex => ({ re, im });
export const add = (a: Complex, b: Complex): Complex => complex(a.re + b.re, a.im + b.im);
export const sub = (a: Complex, b: Complex): Complex => complex(a.re - b.re, a.im - b.im);
export const mul = (a: Complex, b: Complex): Complex => complex(
  a.re * b.re - a.im * b.im,
  a.re * b.im + a.im * b.re,
);
export const scale = (a: Complex, b: number): Complex => complex(a.re * b, a.im * b);
export const abs = (a: Complex): number => Math.hypot(a.re, a.im);
export function div(a: Complex, b: Complex): Complex {
  // For a/b = a*conj(b)/|b|², normalize b first. This avoids squaring a
  // potentially huge divisor while preserving the same rectangular formula.
  const divisorScale = Math.max(Math.abs(b.re), Math.abs(b.im));
  if (divisorScale === 0) throw new RangeError('Complex division by zero');
  const normalizedReal = b.re / divisorScale;
  const normalizedImaginary = b.im / divisorScale;
  const normalizedMagnitudeSquared = normalizedReal * normalizedReal + normalizedImaginary * normalizedImaginary;
  return complex(
    ((a.re / divisorScale) * normalizedReal + (a.im / divisorScale) * normalizedImaginary) / normalizedMagnitudeSquared,
    ((a.im / divisorScale) * normalizedReal - (a.re / divisorScale) * normalizedImaginary) / normalizedMagnitudeSquared,
  );
}
export const polar = (z: Complex) => ({ magnitude: abs(z), phaseRadians: Math.atan2(z.im, z.re) });
export const finiteComplex = (z: Complex): boolean => Number.isFinite(z.re) && Number.isFinite(z.im);
