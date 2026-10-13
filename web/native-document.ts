import { parseBjtDocument, serializeBjtDocument, type BjtDocument } from '../src/bjt-document.js';
import { parseDocument, serializeDocument, ValidationError, type NativeDocument } from '../src/model.js';
import { parseNonlinearDocument, serializeNonlinearDocument, type NonlinearDocument } from '../src/nonlinear-model.js';

export type BrowserDocument = NativeDocument | NonlinearDocument | BjtDocument;

/** Route only the supported strict native schemas; never coerce a version. */
export function parseBrowserDocument(json: string): BrowserDocument {
  let value: unknown;
  try { value = JSON.parse(json); }
  catch { throw new ValidationError('Invalid JSON', 'invalid-json'); }
  const version = value && typeof value === 'object' && 'circuit' in value &&
    value.circuit && typeof value.circuit === 'object' && 'schemaVersion' in value.circuit
    ? value.circuit.schemaVersion : undefined;
  if (version === 1) return parseDocument(json);
  if (version === 3) return parseBjtDocument(json);
  if (version === 2) return parseNonlinearDocument(json);
  throw new ValidationError('Unsupported circuit schema version', 'invalid-schema');
}

export function serializeBrowserDocument(document: BrowserDocument): string {
  if (isBjtDocument(document)) return serializeBjtDocument(document);
  if (isNonlinearDocument(document)) return serializeNonlinearDocument(document);
  return serializeDocument(document);
}

export function copyBrowserDocument(document: BrowserDocument): BrowserDocument {
  return parseBrowserDocument(serializeBrowserDocument(document));
}

export const isNonlinearDocument = (document: BrowserDocument): document is NonlinearDocument =>
  document.circuit.schemaVersion === 2;

export const isBjtDocument = (document: BrowserDocument): document is BjtDocument => document.circuit.schemaVersion === 3;
export const isLinearDocument = (document: BrowserDocument): document is NativeDocument => document.circuit.schemaVersion === 1;
