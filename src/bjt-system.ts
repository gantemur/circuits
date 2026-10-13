import { assembleDiodeSystem, evaluateDiodeSystem, type DiodeSystem, type NonlinearEvaluation } from './diode-operating-point.js';
import { bjtDiodeCore, ownedBjtDocument, type BjtDocument } from './bjt-document.js';
import { bjtTerminals, evaluateBjt, type Bjt, type BjtEvaluation } from './bjt-model.js';

export interface BjtSystem {
  document: BjtDocument; core: DiodeSystem; bjts: Bjt[];
}
export interface BjtSystemEvaluation extends NonlinearEvaluation {
  bjts: Record<string, BjtEvaluation>; additionalArithmeticAllowances: number[];
}
/** N linear coordinates plus d diode currents; Q adds no unknown or law row.
 * The old diode system owns its own unchanged v2 subdocument. All nodes remain.
 */
export function assembleBjtSystem(input: BjtDocument): BjtSystem {
  const document = ownedBjtDocument(input);
  const core = assembleDiodeSystem(bjtDiodeCore(document));
  const bjts = document.circuit.components.filter((d): d is Bjt => d.type === 'Q')
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { document, core, bjts };
}
/** Add three-terminal currents (A) and derivatives (S) to the existing
 * residual F=Kx−Bu+nonlinear contributions. Never assign a Q entry: terminal
 * coincidences, shared nodes and ground must combine by incidence addition.
 */
export function evaluateBjtSystem(system: BjtSystem, x: number[]): BjtSystemEvaluation | null {
  const base = evaluateDiodeSystem(system.core, x);
  if (!base) return null;
  const bjts: Record<string, BjtEvaluation> = Object.create(null);
  const additionalArithmeticAllowances = system.core.rows.map(() => 0);
  const node = (id: string) => id === '0' ? 0 : x[system.core.linear.nodeIndex.get(id)!]!;
  for (const device of system.bjts) {
    const evaluation = evaluateBjt(device, { c: node(device.c), b: node(device.b), e: node(device.e) });
    if (!evaluation) return null;
    bjts[device.id] = evaluation;
    for (let terminalRow = 0; terminalRow < 3; terminalRow++) {
      const terminal = bjtTerminals[terminalRow]!;
      const row = system.core.linear.nodeIndex.get(device[terminal]);
      if (row === undefined) continue; // Reconstruct ground KCL at description.
      const current = evaluation.currentsA[terminal];
      base.residual[row] = base.residual[row]! + current;
      base.physicalTerms[row]!.push(current);
      base.terms[row]!.push(...evaluation.currentTermsA[terminal]);
      additionalArithmeticAllowances[row] = additionalArithmeticAllowances[row]! +
        evaluation.currentArithmeticAllowanceA[terminal];
      for (let terminalColumn = 0; terminalColumn < 3; terminalColumn++) {
        const column = system.core.linear.nodeIndex.get(device[bjtTerminals[terminalColumn]!]);
        if (column !== undefined)
          base.jacobian[row]![column] = base.jacobian[row]![column]! + evaluation.jacobianS[terminalRow]![terminalColumn]!;
      }
    }
  }
  if (![...base.residual, ...base.jacobian.flat(), ...base.terms.flat(),
    ...base.physicalTerms.flat(), ...additionalArithmeticAllowances].every(Number.isFinite)) return null;
  return { ...base, bjts, additionalArithmeticAllowances };
}
