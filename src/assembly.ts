import { validateCircuit, independent, voltageBranch, type Circuit, type Component } from './model.js';
import { zeros, type Label, type Matrix, type Unit } from './numeric.js';

export interface Contribution {
  component: string; matrix: 'E' | 'K' | 'B'; row: string; column: string;
  rowIndex: number; columnIndex: number; value: number; units: string; law: string;
}
export type OutputRow = { id: string; unit: Unit } & (
  | { kind: 'fixed'; C: number[]; D: number[] }
  | { kind: 'derivative'; component: string; Q: number[] });
export interface Storage { id: string; unit: Unit; S: number[]; F: number[] }
export interface Assembly {
  circuit: Circuit; E: Matrix; K: Matrix; B: Matrix;
  unknowns: Label[]; rows: Label[]; inputs: Label[];
  outputs: OutputRow[]; contributions: Contribution[]; storage: Storage[];
  nodeIndex: Map<string, number>; branchIndex: Map<string, number>;
}
const byId = <T extends { id: string }>(a: T, b: T): number => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
/** Incidence column a: +1 at p, -1 at n; ground has no unknown coordinate. */
export function incidence(a: Assembly, p: string, n: string): number[] {
  const v = Array<number>(a.unknowns.length).fill(0);
  const pi = a.nodeIndex.get(p), ni = a.nodeIndex.get(n);
  if (pi !== undefined) v[pi] = v[pi]! + 1;
  if (ni !== undefined) v[ni] = v[ni]! - 1;
  return v;
}
/**
 * Stamp validated linear terminal laws into E xdot + K x = B u.
 * E and K are N×N, B is N×M; N is the number of unknowns and M the number of
 * independent source coordinates. The first rows are non-ground KCL in A,
 * followed by branch constraints in V. Unknowns are sorted node voltages in V,
 * then inductor and voltage-source-type currents in A. Every device current
 * is positive p→n, so a KCL contribution has incidence a at its terminals.
 * The contribution ledger records each scalar stamp with row/column units.
 * Source values belong to experiments, not to this circuit assembly.
 */
export function assemble(raw: Circuit): Assembly {
  // Own a validated snapshot so subsequent editor mutations cannot stale the matrices.
  const circuit = JSON.parse(JSON.stringify(validateCircuit(raw))) as Circuit;
  const nodes = circuit.nodes.filter(n => n !== '0').sort();
  const devices = [...circuit.components].sort(byId);
  const branches = [...devices.filter(c => c.type === 'L'), ...devices.filter(voltageBranch)];
  const source = devices.filter(independent);
  const unknowns: Label[] = [
    ...nodes.map(id => ({ id: `V(${id})`, unit: 'V' as const, description: `Node ${id} relative to 0` })),
    ...branches.map(c => ({ id: `I(${c.id})`, unit: 'A' as const, description: `${c.id} current ${c.p} -> ${c.n}` })),
  ];
  const rows: Label[] = [
    ...nodes.map(id => ({ id: `KCL(${id})`, unit: 'A' as const, description: 'Sum of currents leaving node into branches' })),
    ...branches.map(c => ({ id: `law(${c.id})`, unit: 'V' as const, description: c.type === 'L' ? 'L di/dt - (Vp - Vn) = 0' : 'Voltage source constraint' })),
  ];
  const inputs: Label[] = source.map(c => ({ id: c.id, unit: c.type === 'V' ? 'V' : 'A', description: `${c.id} independent source coordinate` }));
  const n = unknowns.length;
  const a: Assembly = { circuit, E: zeros(n), K: zeros(n), B: zeros(n, inputs.length), unknowns, rows, inputs,
    outputs: [], contributions: [], storage: [], nodeIndex: new Map(nodes.map((v, i) => [v, i])),
    branchIndex: new Map(branches.map((v, i) => [v.id, nodes.length + i])) };
  const stamp = (d: Component, matrix: Contribution['matrix'], row: number, col: number, value: number, law: string) => {
    if (value === 0) return;
    a[matrix][row]![col] = a[matrix][row]![col]! + value;
    const column = matrix === 'B' ? inputs[col]! : unknowns[col]!;
    const units = matrix === 'E' ? `${rows[row]!.unit}*s/${column.unit}` : `${rows[row]!.unit}/${column.unit}`;
    a.contributions.push({ component: d.id, matrix, row: rows[row]!.id, column: column.id,
      rowIndex: row, columnIndex: col, value, units, law });
  };
  for (const d of devices) {
    const v = incidence(a, d.p, d.n), k = a.branchIndex.get(d.id);
    const input = inputs.findIndex(i => i.id === d.id);
    // An explicitly represented branch current is an unknown. Its incidence
    // enters KCL even when its own constitutive law appears in another row.
    if (k !== undefined) v.forEach((w, i) => stamp(d, 'K', i, k, w, 'KCL: branch current enters p and leaves n'));
    switch (d.type) {
      case 'R': case 'C': {
        // v=aᵀx. Resistor i=(aᵀx)/R stamps aaᵀ/R in K;
        // capacitor i=C aᵀxdot stamps C aaᵀ in E.
        const matrix = d.type === 'R' ? 'K' : 'E';
        const coefficient = d.type === 'R' ? 1 / d.value : d.value;
        const law = d.type === 'R' ? 'i=(Vp-Vn)/R' : 'i=C d(Vp-Vn)/dt';
        v.forEach((rowIncidence, i) => {
          v.forEach((columnIncidence, j) => {
            stamp(d, matrix, i, j, rowIncidence * columnIncidence * coefficient, law);
          });
        });
        if (d.type === 'C') a.storage.push({ id: d.id, unit: 'V', S: v, F: v.map(w => w * d.value) });
        break;
      }
      case 'L': {
        // Inductor law is L dI/dt - (Vp-Vn) = 0. Its own current is the
        // branch unknown k; S selects it and F contributes L to E=F*S.
        v.forEach((w, j) => stamp(d, 'K', k!, j, -w, 'L di/dt-(Vp-Vn)=0'));
        stamp(d, 'E', k!, k!, d.value, 'v=L di/dt');
        const S = Array<number>(n).fill(0), F = Array<number>(n).fill(0); S[k!] = 1; F[k!] = d.value;
        a.storage.push({ id: d.id, unit: 'A', S, F }); break;
      }
      case 'V':
        // Voltage law aᵀx=u. Keeping its branch current preserves KCL and
        // allows current-controlled sources to refer to that exact branch.
        v.forEach((w, j) => stamp(d, 'K', k!, j, w, 'Vp-Vn=u'));
        stamp(d, 'B', k!, input, 1, 'Independent voltage excitation'); break;
      case 'I':
        // A prescribed p→n current is +a*i on the KCL left side, hence -a*u
        // on the right side in the canonical residual convention.
        v.forEach((w, i) => stamp(d, 'B', i, input, -w, 'KCL: prescribed p->n current moves to RHS'));
        break;
      case 'VCVS': case 'VCCS': {
        // A voltage-controlled current source contributes gain*a_out*a_ctlᵀ
        // to KCL; a voltage source instead adds an explicit voltage-law row.
        const vc = incidence(a, d.cp, d.cn);
        if (d.type === 'VCCS') v.forEach((r, i) => vc.forEach((c, j) => stamp(d, 'K', i, j, d.gain * r * c, 'io=g(Vcp-Vcn)')));
        else {
          v.forEach((w, j) => stamp(d, 'K', k!, j, w, 'vo-mu vc=0'));
          vc.forEach((w, j) => stamp(d, 'K', k!, j, -d.gain * w, 'vo-mu vc=0'));
        }
        break;
      }
      case 'CCVS': case 'CCCS': {
        // The control index names a retained voltage-source-type current;
        // there is no inferred current through an arbitrary ideal element.
        const control = a.branchIndex.get(d.control)!;
        if (d.type === 'CCCS') v.forEach((w, i) => stamp(d, 'K', i, control, d.gain * w, 'io=beta ic'));
        else {
          v.forEach((w, j) => stamp(d, 'K', k!, j, w, 'vo-r ic=0'));
          stamp(d, 'K', k!, control, -d.gain, 'vo-r ic=0');
        }
        break;
      }
    }
  }
  a.outputs = [...circuit.observations].sort(byId).map(o => {
    if (o.type === 'voltage') return { id: o.id, unit: 'V', kind: 'fixed', C: incidence(a, o.p, o.n), D: Array<number>(inputs.length).fill(0) };
    const d = devices.find(d => d.id === o.component)!;
    return { id: o.id, ...currentRow(a, d) };
  });
  return a;
}
/** Read a p→n device current from x,u, or from a capacitor's storage rate. */
export function currentRow(a: Assembly, d: Component): Omit<Extract<OutputRow, { kind: 'fixed' }>, 'id'> | Omit<Extract<OutputRow, { kind: 'derivative' }>, 'id'> {
  const C = Array<number>(a.unknowns.length).fill(0), D = Array<number>(a.inputs.length).fill(0);
  const v = incidence(a, d.p, d.n), k = a.branchIndex.get(d.id);
  if (k !== undefined) C[k] = 1;
  else switch (d.type) {
    case 'R': v.forEach((w, j) => { C[j] = w / d.value; }); break;
    case 'C': return { unit: 'A', kind: 'derivative', component: d.id, Q: v.map(w => w * d.value) };
    case 'I': D[a.inputs.findIndex(i => i.id === d.id)] = 1; break;
    case 'VCCS': incidence(a, d.cp, d.cn).forEach((w, j) => { C[j] = d.gain * w; }); break;
    case 'CCCS': C[a.branchIndex.get(d.control)!] = d.gain; break;
  }
  return { unit: 'A', kind: 'fixed', C, D };
}
