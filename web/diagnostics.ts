import { t, translate, type TranslationKey } from './i18n.js';

const validationKeys: Record<string, TranslationKey> = {
  'invalid-document': 'documentRejected', 'invalid-json': 'invalidJson', 'invalid-schema': 'invalidSchema',
  'expected-object': 'expectedObject', 'unsupported-field': 'unsupportedFieldAt',
  'expected-string': 'expectedString', 'expected-number': 'expectedNumber', 'expected-array': 'expectedArray',
  'duplicate-ids': 'duplicateIds', 'missing-node': 'missingNode', 'missing-ground': 'missingGround',
  'passive-positive': 'passivePositive', 'unsupported-device': 'unsupportedDevice',
  'invalid-control': 'invalidControl', 'invalid-observation': 'invalidObservation',
  'unknown-source': 'unknownSource', 'invalid-sinusoid': 'invalidSinusoid',
  'unsupported-waveform': 'unsupportedWaveform', 'missing-sources': 'missingSources',
  'unknown-storage': 'unknownStorage', 'missing-storage': 'missingStorage',
  'unsupported-initial': 'unsupportedInitial',
};
export function validationSummary(code: string | undefined, params: Readonly<Record<string, string | number>> = {}): string {
  return translate(validationKeys[code ?? ''] ?? 'documentRejected', { ...params });
}
export type DocumentIssue =
  | { kind: 'validation'; code: string; params: Readonly<Record<string, string | number>> }
  | { kind: 'read' };
export function documentIssueText(issue: DocumentIssue, surface: 'json' | 'import'): string {
  const reason = issue.kind === 'read' ? t('importReadError') : validationSummary(issue.code, issue.params);
  return surface === 'json' ? t('jsonRejected', { reason }) :
    t(issue.kind === 'read' ? 'importFailed' : 'importRejected', { reason });
}
export function statusSummary(status: string): string {
  switch (status) {
    case 'inconsistent': return t('statusInconsistent');
    case 'nonunique': return t('statusNonunique');
    case 'ill-conditioned': return t('statusIllConditioned');
    case 'unsupported-initialization': return t('statusUnsupportedInitialization');
    case 'step-limit': return t('statusStepLimit');
    default: return t('statusNotSupported');
  }
}
export function algebraicSummary(reason: string | undefined): string {
  switch (reason) {
    case 'derivative-observation': return t('reasonDerivative');
    case 'storage-structure': return t('reasonStorage');
    case 'algebraic-block': return t('reasonAlgebraicBlock');
    case 'numeric-range': return t('reasonNumericRange');
    default: return t('statusNotSupported');
  }
}

/** Nonlinear solver identifiers remain stable in native/test data; the panel
 * translates their explanations when it renders in the current language. */
export function diodeFailureReason(code: string): string {
  const reasons: Record<string, TranslationKey> = {
    'numeric-range': 'diodeFailureNumeric',
    'linearized-system': 'diodeFailureLinearized',
    'line-search': 'diodeFailureLineSearch',
    'iteration-limit': 'diodeFailureIterations',
    'stale-bias': 'diodeFailureStale',
    'unrepresentable-resistance': 'diodeFailureResistance',
    'missing-selection': 'diodeFailureSelection',
  };
  return translate(reasons[code] ?? 'statusNotSupported');
}
