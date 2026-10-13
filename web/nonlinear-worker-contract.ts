import type { NonlinearDocument } from '../src/nonlinear-model.js';
import type { NonlinearTransientResult } from '../src/diode-transient.js';

/** Structured-clone messages contain only scientific inputs/results and a run token. */
export interface TransientWorkerRequest {
  kind: 'run'; token: number; document: NonlinearDocument;
  options: { start: 0; stop: number; step: number; maxIntervals: 3000;
    maxUnknowns: 64; maxIterations: 60; maxBacktracks: 30 };
}
export type TransientWorkerReply =
  | { kind: 'result'; token: number; result: NonlinearTransientResult }
  | { kind: 'error'; token: number; message: string };
