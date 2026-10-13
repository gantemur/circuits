/** Bounded exact scalar arithmetic for synthesis, not a general CAS.
 * Fractions have coprime signed numerator n and positive denominator d.
 * Every operation, including Euclid iterations, consumes a shared budget. */
export interface Rational { readonly n: bigint; readonly d: bigint }
export const exactZero: Rational = { n: 0n, d: 1n };
export const exactOne: Rational = { n: 1n, d: 1n };
export interface ExactLimits {
  rawDegree: number; degree: number; inputLength: number; inputCharacters: number;
  exponent: number; bits: number; operations: number;
}
// Pure initialization lets browser consumers omit this unused headless module.
export const exactLimits: Readonly<ExactLimits> = /* @__PURE__ */ Object.freeze({ rawDegree: 16, degree: 8, inputLength: 1024,
  inputCharacters: 32768, exponent: 2048, bits: 8192, operations: 1000000 });
export class ExactResourceError extends Error {
  constructor(readonly stage: string, readonly resource: string) { super(`${stage}: ${resource} budget exceeded`); }
}
export class ExactInputError extends Error {}
export class ExactBudget {
  readonly limits: ExactLimits;
  operations = 0;
  characters = 0;
  stage = 'input';
  constructor(options: Partial<ExactLimits> = {}) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) throw new ExactInputError('Invalid budgets');
    for (const [key, value] of Object.entries(options)) {
      const maximum = exactLimits[key as keyof ExactLimits];
      if (maximum === undefined || !Number.isSafeInteger(value) || value < 1 || value > maximum)
        throw new ExactInputError(`Invalid budget ${key}`);
    }
    this.limits = { ...exactLimits, ...options };
  }
  tick(): void {
    if (++this.operations > this.limits.operations) throw new ExactResourceError(this.stage, 'operations');
  }
  integer(n: bigint): void {
    this.tick();
    if (bitLength(n) > this.limits.bits) throw new ExactResourceError(this.stage, 'integer bits');
  }
  text(s: string): void {
    this.tick();
    this.characters += s.length;
    if (s.length > this.limits.inputLength || this.characters > this.limits.inputCharacters)
      throw new ExactResourceError(this.stage, 'input length');
  }
}
export const bitLength = (n: bigint): number => (n < 0n ? -n : n).toString(2).length;
function gcd(a: bigint, b: bigint, budget: ExactBudget): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) {
    budget.tick();
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a;
}
function product(a: bigint, b: bigint, budget: ExactBudget): bigint {
  budget.integer(a);
  budget.integer(b);
  // Bound allocation before multiplying. This conservative guard may decline
  // a product one bit below the bound; it never claims nonrealizability.
  if (a !== 0n && b !== 0n && bitLength(a) + bitLength(b) > budget.limits.bits)
    throw new ExactResourceError(budget.stage, 'product bits');
  const value = a * b;
  budget.integer(value);
  return value;
}
export function rational(n: bigint, d: bigint, budget: ExactBudget): Rational {
  budget.integer(n);
  budget.integer(d);
  if (d === 0n) throw new ExactInputError('Zero rational denominator');
  if (n === 0n) return exactZero;
  const divisor = gcd(n, d, budget);
  const sign = d < 0n ? -1n : 1n;
  return { n: sign * (n / divisor), d: sign * (d / divisor) };
}
export function exactAdd(a: Rational, b: Rational, budget: ExactBudget): Rational {
  const numerator = product(a.n, b.d, budget) + product(b.n, a.d, budget);
  return rational(numerator, product(a.d, b.d, budget), budget);
}
export const exactNegate = (a: Rational): Rational => ({ n: -a.n, d: a.d });
export const exactSubtract = (a: Rational, b: Rational, budget: ExactBudget): Rational => exactAdd(a, exactNegate(b), budget);
export function exactMultiply(a: Rational, b: Rational, budget: ExactBudget): Rational {
  return rational(product(a.n, b.n, budget), product(a.d, b.d, budget), budget);
}
export function exactDivide(a: Rational, b: Rational, budget: ExactBudget): Rational {
  if (b.n === 0n) throw new ExactInputError('Exact division by zero');
  return rational(product(a.n, b.d, budget), product(a.d, b.n, budget), budget);
}
export const exactString = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const exactEqual = (a: Rational, b: Rational): boolean => a.n === b.n && a.d === b.d;

/** Decimal digits and exponents are interpreted as powers of ten, never as
 * a binary64 coefficient. Whitespace, nonfinite tokens and mixed forms fail. */
export function parseExact(raw: unknown, budget: ExactBudget): Rational {
  if (typeof raw !== 'string') throw new ExactInputError('Expected an exact rational string');
  budget.text(raw);
  if (/^[+-]?\d+\/[+-]?\d+$/.test(raw)) {
    const [n, d] = raw.split('/');
    return rational(BigInt(n!), BigInt(d!), budget);
  }
  const match = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) throw new ExactInputError('Malformed rational string');
  const exponentText = match[3] ?? '0';
  const exponent = BigInt(exponentText);
  if (exponent > BigInt(budget.limits.exponent) || exponent < -BigInt(budget.limits.exponent))
    throw new ExactResourceError(budget.stage, 'decimal exponent');
  const digits = match[2]!;
  const places = digits.includes('.') ? digits.length - digits.indexOf('.') - 1 : 0;
  const shift = Number(exponent) - places;
  // log2(10)<4: a preallocation bound also covers long fractional mantissas.
  if (4 * Math.abs(shift) > budget.limits.bits) throw new ExactResourceError(budget.stage, 'decimal power bits');
  const n = BigInt(digits.replace('.', '')) * (match[1] === '-' ? -1n : 1n);
  const power = 10n ** BigInt(Math.abs(shift));
  budget.integer(power);
  return shift >= 0 ? rational(product(n, power, budget), 1n, budget) : rational(n, power, budget);
}

/** Exact binary64 decoding is used only for recording conversion error and
 * numerical experiment coordinates, never for the input coefficient parser. */
export function exactFromNumber(value: number, budget: ExactBudget): Rational {
  if (!Number.isFinite(value)) throw new ExactInputError('Nonfinite binary64 value');
  const data = new DataView(new ArrayBuffer(8));
  data.setFloat64(0, value);
  const bits = data.getBigUint64(0);
  const exponent = Number((bits >> 52n) & 2047n);
  const fraction = bits & ((1n << 52n) - 1n);
  const mantissa = exponent === 0 ? fraction : fraction + (1n << 52n);
  const shift = exponent === 0 ? -1074 : exponent - 1023 - 52;
  const sign = bits >> 63n ? -1n : 1n;
  return shift >= 0 ? rational(sign * (mantissa << BigInt(shift)), 1n, budget)
    : rational(sign * mantissa, 1n << BigInt(-shift), budget);
}
export interface ExactConversion { value: number; discrepancy: string; relativeError: number }
/** Round n/d directly to nearest binary64, ties to even. Select the quantum
 * 2^(e-52), or 2^-1074 for subnormals, and round an integer quotient. Thus
 * enormous n and d never separately become Infinity. Range failures throw
 * for the caller to classify as native/evaluation unavailability. */
export function exactToNumber(a: Rational, budget: ExactBudget): ExactConversion {
  budget.integer(a.n);
  budget.integer(a.d);
  if (a.n === 0n) return { value: 0, discrepancy: '0', relativeError: 0 };
  const n = a.n < 0n ? -a.n : a.n;
  let exponent = bitLength(n) - bitLength(a.d);
  const below = exponent >= 0 ? n < (a.d << BigInt(exponent)) : (n << BigInt(-exponent)) < a.d;
  if (below) exponent--;
  if (exponent > 1023 || exponent < -1075) throw new RangeError('Exact value exceeds nonzero binary64 range');
  const shift = Math.max(exponent - 52, -1074);
  const numerator = shift < 0 ? n << BigInt(-shift) : n;
  const denominator = shift > 0 ? a.d << BigInt(shift) : a.d;
  budget.integer(numerator);
  budget.integer(denominator);
  let quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const twice = 2n * remainder;
  if (twice > denominator || (twice === denominator && quotient % 2n !== 0n)) quotient++;
  const value = (a.n < 0n ? -1 : 1) * Number(quotient) * 2 ** shift;
  if (!Number.isFinite(value) || value === 0) throw new RangeError('Exact value rounds to zero or infinity');
  const error = exactSubtract(exactFromNumber(value, budget), a, budget);
  const relative = exactDivide(error, a, budget);
  // Error reporting does not feed back into extraction. Leading-bit scaling
  // keeps even this small ratio from an Infinity/Infinity conversion.
  const magnitude = relative.n < 0n ? -relative.n : relative.n;
  const ns = Math.max(0, bitLength(magnitude) - 53);
  const ds = Math.max(0, bitLength(relative.d) - 53);
  const relativeError = Number(magnitude >> BigInt(ns)) / Number(relative.d >> BigInt(ds)) * 2 ** (ns - ds);
  return { value, discrepancy: exactString(error), relativeError };
}
