import { parseDocument, serializeDocument, ValidationError, type NativeDocument } from '../src/model.js';
import { parseNonlinearDocument, serializeNonlinearDocument, type NonlinearDocument } from '../src/nonlinear-model.js';

export type BrowserDocument = NativeDocument | NonlinearDocument;

/** Route only the two supported strict native schemas; never coerce a version. */
export function parseBrowserDocument(json: string): BrowserDocument {
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new ValidationError('Invalid JSON', 'invalid-json'); }
  const version = value && typeof value === 'object' && 'circuit' in value &&
    value.circuit && typeof value.circuit === 'object' && 'schemaVersion' in value.circuit
    ? value.circuit.schemaVersion : undefined;
  if (version === 1) return parseDocument(json);
  if (version === 2) return parseNonlinearDocument(json);
  throw new ValidationError('Unsupported circuit schema version', 'invalid-schema');
}

export function serializeBrowserDocument(document: BrowserDocument): string {
  if (isNonlinearDocument(document)) return serializeNonlinearDocument(document);
  return serializeDocument(document);
}

export function copyBrowserDocument(document: BrowserDocument): BrowserDocument {
  return parseBrowserDocument(serializeBrowserDocument(document));
}

export const isNonlinearDocument = (document: BrowserDocument): document is NonlinearDocument =>
  document.circuit.schemaVersion === 2;
