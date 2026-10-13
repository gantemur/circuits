import { boltzmannJPerK, elementaryChargeC } from './diode-operating-point.js';

export type BjtTerminal = 'c' | 'b' | 'e';
export const bjtTerminals: readonly BjtTerminal[] = ['c', 'b', 'e'];
export interface Bjt {
  id: string; type: 'Q'; c: string; b: string; e: string; label?: string;
  model: {
    kind: 'ebers-moll'; polarity: 'npn' | 'pnp'; transportSaturationCurrentA: number;
    betaForward: number; betaReverse: number; temperatureK: number;
  };
}
export interface BjtEvaluation {
  thermalVoltageV: number; uBE: number; uBC: number;
  forwardTransportA: number; reverseTransportA: number;
  forwardConductanceS: number; reverseConductanceS: number;
  derivativeUnderflow: { forward: boolean; reverse: boolean };
  terminalVoltagesV: Record<BjtTerminal, number>;
  currentsA: Record<BjtTerminal, number>;
  /** Rows and columns ordered c,b,e. Entries are A/V. */
  jacobianS: number[][];
  /** Signed transport summands in each terminal current, before cancellation. */
  currentTermsA: Record<BjtTerminal, number[]>;
  currentArithmeticAllowanceA: Record<BjtTerminal, number>;
  absorbedW: number; identityPowerW: number;
  powerIdentityResidualW: number; powerArithmeticAllowanceW: number;
  conservationResidualA: number; conservationArithmeticAllowanceA: number;
  region: 'forward-active' | 'reverse-active' | 'saturation' | 'cutoff' | 'boundary';
}

/** Evaluate Is(expm1(z)) and its derivative without an overflowing exp(z)
 * intermediate. Small z uses expm1; large positive z uses exp(log(Is)+z).
 * A derivative below binary64 range is reported, never called exact cutoff.
 */
function transport(is: number, vt: number, voltage: number) {
  const z = voltage / vt;
  if (!Number.isFinite(z)) return null;
  const current = z > 1 ? Math.exp(Math.log(is) + z) - is : is * Math.expm1(z);
  const logConductance = Math.log(is) - Math.log(vt) + z;
  const conductance = Math.exp(logConductance);
  if (![current, logConductance, conductance].every(Number.isFinite)) return null;
  return { current, conductance, underflow: conductance === 0 };
}

/**
 * Reciprocal memoryless Ebers–Moll, all currents entering c,b,e (A).
 * With σ=±1, uBE=σ(Vb−Ve), uBC=σ(Vb−Vc), F=Is expm1(uBE/VT),
 * R=Is expm1(uBC/VT), iC=σ(F−R−R/βR), iB=σ(F/βF+R/βR),
 * iE=σ(R−F−F/βF). Base current is evaluated directly, not by subtracting
 * large collector/emitter currents. The full 3×3 analytic Jacobian uses σ²=1.
 * Temperature changes VT only. No Early effect, charge, clipping or gmin.
 * Null means a required calculation or diagnostic is unrepresentable.
 * See PHASE_3B1_SPECIFICATION.md for equations and independent acceptance.
 */
export function evaluateBjt(device: Bjt, volts: Record<BjtTerminal, number>): BjtEvaluation | null {
  const model = device.model;
  if (model.kind !== 'ebers-moll' || !['npn', 'pnp'].includes(model.polarity) ||
      ![model.transportSaturationCurrentA, model.betaForward, model.betaReverse, model.temperatureK]
        .every(value => Number.isFinite(value) && value > 0) ||
      !bjtTerminals.every(t => Number.isFinite(volts[t]))) return null;
  const vt = boltzmannJPerK * model.temperatureK / elementaryChargeC;
  if (!Number.isFinite(vt) || vt <= 0) return null;
  const sigma = model.polarity === 'npn' ? 1 : -1;
  const uBE = sigma * (volts.b - volts.e);
  const uBC = sigma * (volts.b - volts.c);
  const forward = transport(model.transportSaturationCurrentA, vt, uBE);
  const reverse = transport(model.transportSaturationCurrentA, vt, uBC);
  if (!forward || !reverse) return null;
  const f = forward.current, r = reverse.current;
  const gf = forward.conductance, gr = reverse.conductance;
  // Division avoids overflow in an intermediate 1/β when the quotient fits.
  const fb = f / model.betaForward, rb = r / model.betaReverse;
  const gfb = gf / model.betaForward, grb = gr / model.betaReverse;
  const currentTermsA = {
    c: [sigma * f, -sigma * r, -sigma * rb],
    b: [sigma * fb, sigma * rb],
    e: [sigma * r, -sigma * f, -sigma * fb],
  };
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const magnitude = (values: number[]) => sum(values.map(Math.abs));
  const currentsA = { c: sum(currentTermsA.c), b: sum(currentTermsA.b), e: sum(currentTermsA.e) };
  const jacobianS = [
    [gr + grb, gf - gr - grb, -gf],
    [-grb, gfb + grb, -gfb],
    [-gr, gr - gf - gfb, gf + gfb],
  ];
  // Arithmetic estimates have physical units and retain pre-cancellation
  // transport magnitudes. Terminal subtraction sensitivity also matters at
  // a large common reference potential. It does not enlarge physical tolerances.
  const eps = Number.EPSILON;
  const beError = 4 * eps * (Math.abs(volts.b) + Math.abs(volts.e));
  const bcError = 4 * eps * (Math.abs(volts.b) + Math.abs(volts.c));
  const fError = 16 * eps * (1 + Math.abs(uBE / vt) + Math.abs(Math.log(model.transportSaturationCurrentA))) * Math.abs(f) + gf * beError;
  const rError = 16 * eps * (1 + Math.abs(uBC / vt) + Math.abs(Math.log(model.transportSaturationCurrentA))) * Math.abs(r) + gr * bcError;
  const currentArithmeticAllowanceA = {
    c: fError + rError + rError / model.betaReverse + 16 * eps * magnitude(currentTermsA.c),
    b: fError / model.betaForward + rError / model.betaReverse + 16 * eps * magnitude(currentTermsA.b),
    e: rError + fError + fError / model.betaForward + 16 * eps * magnitude(currentTermsA.e),
  };
  const vce = volts.c - volts.e, vbe = volts.b - volts.e;
  const powerTerms = [vce * currentsA.c, vbe * currentsA.b];
  const identityTerms = [(uBE - uBC) * (f - r), uBE * fb, uBC * rb];
  const absorbedW = sum(powerTerms), identityPowerW = sum(identityTerms);
  const powerArithmeticAllowanceW = 64 * eps * (magnitude(powerTerms) + magnitude(identityTerms)) +
    Math.abs(vce) * currentArithmeticAllowanceA.c + Math.abs(vbe) * currentArithmeticAllowanceA.b +
    4 * eps * ((Math.abs(volts.c) + Math.abs(volts.e)) * Math.abs(currentsA.c) +
      (Math.abs(volts.b) + Math.abs(volts.e)) * Math.abs(currentsA.b));
  const conservationResidualA = currentsA.c + currentsA.b + currentsA.e;
  const conservationArithmeticAllowanceA = sum(Object.values(currentArithmeticAllowanceA));
  const numeric = [uBE, uBC, ...Object.values(currentsA), ...jacobianS.flat(),
    ...Object.values(currentTermsA).flat(), ...Object.values(currentArithmeticAllowanceA),
    absorbedW, identityPowerW, absorbedW - identityPowerW, powerArithmeticAllowanceW, conservationResidualA, conservationArithmeticAllowanceA];
  if (!numeric.every(Number.isFinite)) return null;
  const region = uBE === 0 || uBC === 0 ? 'boundary' :
    uBE > 0 ? (uBC > 0 ? 'saturation' : 'forward-active') : (uBC > 0 ? 'reverse-active' : 'cutoff');
  return { thermalVoltageV: vt, uBE, uBC, forwardTransportA: f, reverseTransportA: r,
    forwardConductanceS: gf, reverseConductanceS: gr,
    derivativeUnderflow: { forward: forward.underflow, reverse: reverse.underflow },
    terminalVoltagesV: { ...volts }, currentsA, jacobianS, currentTermsA, currentArithmeticAllowanceA,
    absorbedW, identityPowerW, powerIdentityResidualW: absorbedW - identityPowerW,
    powerArithmeticAllowanceW, conservationResidualA, conservationArithmeticAllowanceA, region };
}
