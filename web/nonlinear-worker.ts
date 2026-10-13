import { nonlinearTransient } from '../src/diode-transient.js';
import type { TransientWorkerReply, TransientWorkerRequest } from './nonlinear-worker-contract.js';

// This source is bundled and embedded in the three-file static app package.
// Terminating its Worker interrupts the synchronous kernel solve at any point.
self.onmessage = (event: MessageEvent<TransientWorkerRequest>): void => {
  const request = event.data;
  if (!request || request.kind !== 'run') return;
  let reply: TransientWorkerReply;
  try {
    reply = { kind: 'result', token: request.token,
      result: nonlinearTransient(request.document, request.options) };
  } catch (error) {
    reply = { kind: 'error', token: request.token,
      message: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
