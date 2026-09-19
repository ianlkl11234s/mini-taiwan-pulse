export const SEMANTIC_SCHEMA_VERSION = 'semantic-card/0.1';
const CARD_KEYS = ['schemaVersion', 'semanticVersion', 'datasetId', 'datasetVersion', 'label', 'recordGrain', 'geometry', 'versions', 'requiredEvidence', 'concepts', 'allowedAnalyses', 'prohibitedClaims'];
const CONCEPT_KEYS = ['conceptId', 'kind', 'definition', 'method', 'scope', 'confidence', 'evidenceStatus', 'references', 'reviewSource', 'requiredEvidence', 'allowedAnalyses', 'prohibitedClaims'];
const KINDS = new Set(['observed', 'derived', 'proxy', 'hypothesis']), STATES = new Set(['observed', 'missing', 'suppressed', 'zero', 'unknown']);
const ID = /^[a-z][a-z0-9_-]{0,79}$/u, DATASET = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,159}$/u, SEMVER = /^\d+\.\d+\.\d+$/u, SHA = /^[a-f0-9]{64}$/u;
export function validateSemanticCard(card) {
    const errors = [], add = (path, code) => errors.push({ path, code });
    if (!object(card))
        return { valid: false, errors: [{ path: '$', code: 'TYPE' }] };
    exact(card, CARD_KEYS, '$', add);
    if (card.schemaVersion !== SEMANTIC_SCHEMA_VERSION)
        add('$.schemaVersion', 'SCHEMA_VERSION');
    if (!text(card.semanticVersion, SEMVER))
        add('$.semanticVersion', 'SEMANTIC_VERSION');
    if (!text(card.datasetId, DATASET) || !nullableText(card.datasetVersion) || !text(card.label) || !['place', 'event', 'admin_statistic'].includes(card.recordGrain))
        add('$', 'CARD_FIELDS');
    geometry(card.geometry, '$.geometry', add);
    const evidenceIds = requirements(card.requiredEvidence, add);
    versions(card, add);
    const concepts = new Set();
    if (!Array.isArray(card.concepts) || card.concepts.length === 0)
        add('$.concepts', 'CONCEPTS');
    else
        card.concepts.forEach((item, i) => concept(item, `$.concepts[${i}]`, evidenceIds, concepts, add));
    if (!texts(card.allowedAnalyses, false))
        add('$.allowedAnalyses', 'ALLOWED_ANALYSES');
    if (!texts(card.prohibitedClaims, true))
        add('$.prohibitedClaims', 'PROHIBITED_CLAIMS');
    return { valid: errors.length === 0, errors };
}
export function assertValidSemanticCard(card) { const result = validateSemanticCard(card); if (!result.valid) {
    const error = new Error(`SEMANTIC_CARD_INVALID: ${result.errors.map(({ path, code }) => `${path} ${code}`).join('; ')}`);
    error.code = 'SEMANTIC_CARD_INVALID';
    error.errors = result.errors;
    throw error;
} return card; }
/** Confidence is descriptive only: it never changes kind or satisfies required evidence. */
export function assessConcept(card, conceptId, evidence = []) {
    assertValidSemanticCard(card);
    const item = card.concepts.find((candidate) => candidate.conceptId === conceptId);
    if (!item)
        throw new Error('CONCEPT_NOT_FOUND');
    if (!Array.isArray(evidence))
        throw new Error('EVIDENCE_LIST_REQUIRED');
    const allowed = new Set(card.requiredEvidence.map(({ evidenceId }) => evidenceId)), submitted = new Map();
    for (const candidate of evidence) {
        const parsed = submission(candidate, allowed);
        if (candidate.evidenceStatus === 'observed' && card.datasetVersion !== null && candidate.datasetVersion !== card.datasetVersion)
            throw new Error('EVIDENCE_VERSION_MISMATCH');
        if (submitted.has(parsed.evidenceId))
            throw new Error(submitted.get(parsed.evidenceId) === parsed.fingerprint ? 'DUPLICATE_EVIDENCE' : 'CONFLICTING_EVIDENCE');
        submitted.set(parsed.evidenceId, parsed.fingerprint);
    }
    const missingEvidence = item.requiredEvidence.map((evidenceId) => ({ evidenceId, evidenceStatus: JSON.parse(submitted.get(evidenceId) ?? '{"evidenceStatus":"missing"}').evidenceStatus })).filter(({ evidenceStatus }) => evidenceStatus !== 'observed');
    return Object.freeze({ datasetId: card.datasetId, datasetVersion: card.datasetVersion, semanticVersion: card.semanticVersion, conceptId: item.conceptId, kind: item.kind, assessment: missingEvidence.length ? 'hypothesis' : 'supported', missingEvidence });
}
function submission(item, allowed) { if (!object(item))
    throw new Error('INVALID_EVIDENCE'); const error = (path, code) => { throw new Error(code); }; onlyKnown(item, ['evidenceId', 'evidenceStatus', 'reference', 'datasetVersion', 'checksumSha256', 'validatedBy', 'method', 'reviewer', 'confidence', 'value'], '$evidence', error); if (!text(item.evidenceId, ID))
    throw new Error('INVALID_EVIDENCE'); if (!allowed.has(item.evidenceId))
    throw new Error('UNKNOWN_EVIDENCE_ID'); if (!STATES.has(item.evidenceStatus))
    throw new Error('INVALID_EVIDENCE_STATUS'); if (item.evidenceStatus === 'observed' && (!text(item.reference) || !text(item.datasetVersion) || !(text(item.checksumSha256, SHA) || text(item.validatedBy)) || !method(item.method) || item.reviewer !== undefined && !text(item.reviewer) || item.confidence !== undefined && !confidence(item.confidence)))
    throw new Error('UNVERIFIED_EVIDENCE'); return { evidenceId: item.evidenceId, fingerprint: stable(item) }; }
function requirements(value, add) { const ids = new Set(); if (!Array.isArray(value) || !value.length) {
    add('$.requiredEvidence', 'REQUIRED_EVIDENCE');
    return ids;
} value.forEach((item, i) => { const path = `$.requiredEvidence[${i}]`; if (!object(item))
    return add(path, 'EVIDENCE'); exact(item, ['evidenceId', 'description'], path, add); if (!text(item.evidenceId, ID) || !text(item.description) || ids.has(item.evidenceId))
    add(path, 'EVIDENCE');
else
    ids.add(item.evidenceId); }); return ids; }
function versions(card, add) { if (!Array.isArray(card.versions) || !card.versions.length)
    return add('$.versions', 'VERSIONS'); const seen = new Set(); card.versions.forEach((item, i) => { const path = `$.versions[${i}]`; if (!object(item))
    return add(path, 'VERSION'); exact(item, ['datasetVersion', 'sourceVersion', 'freshness', 'note'], path, add); const key = `${item.datasetVersion}|${item.sourceVersion}`; if (!nullableText(item.datasetVersion) || !nullableText(item.sourceVersion) || !['current', 'stale', 'unknown'].includes(item.freshness) || !text(item.note) || seen.has(key) || card.datasetVersion !== null && item.datasetVersion !== card.datasetVersion)
    add(path, 'VERSION'); seen.add(key); }); }
function concept(item, path, evidenceIds, ids, add) { if (!object(item))
    return add(path, 'CONCEPT'); exact(item, CONCEPT_KEYS, path, add); if (!text(item.conceptId, ID) || ids.has(item.conceptId) || !KINDS.has(item.kind) || !text(item.definition) || !method(item.method) || !scope(item.scope) || !confidence(item.confidence) || !['requires_validation', 'reviewed'].includes(item.evidenceStatus) || !texts(item.references, true) || !text(item.reviewSource) || !texts(item.requiredEvidence, true) || !texts(item.allowedAnalyses, false) || !texts(item.prohibitedClaims, true))
    return add(path, 'CONCEPT'); ids.add(item.conceptId); if (item.requiredEvidence.some((id) => !evidenceIds.has(id)))
    add(`${path}.requiredEvidence`, 'UNKNOWN_EVIDENCE'); }
function geometry(item, path, add) { if (!object(item))
    return add(path, 'GEOMETRY'); exact(item, ['role', 'spatialAnalysisEligible', 'meaning'], path, add); if (!['actual', 'proxy', 'none'].includes(item.role) || typeof item.spatialAnalysisEligible !== 'boolean' || !text(item.meaning))
    add(path, 'GEOMETRY'); if (item.role !== 'actual' && item.spatialAnalysisEligible)
    add(`${path}.spatialAnalysisEligible`, 'GEOMETRY_SEMANTICS'); }
function method(value) { return object(value) && Object.keys(value).length === 2 && text(value.methodId, ID) && text(value.version, SEMVER); }
function scope(value) { return object(value) && Object.keys(value).length === 2 && text(value.spatialScale) && text(value.timeScale); }
function confidence(value) { return object(value) && Object.keys(value).length === 2 && ['unknown', 'low', 'medium', 'high'].includes(value.level) && text(value.rationale); }
function exact(value, keys, path, add) { onlyKnown(value, keys, path, add); for (const key of keys)
    if (!(key in value))
        add(`${path}.${key}`, 'REQUIRED'); }
function onlyKnown(value, keys, path, add) { for (const key of Object.keys(value))
    if (!keys.includes(key))
        add(`${path}.${key}`, 'UNKNOWN_PROPERTY'); }
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function text(value, pattern = null) { return typeof value === 'string' && value.length > 0 && value.length <= 2000 && (!pattern || pattern.test(value)); }
function nullableText(value) { return value === null || typeof value === 'string'; }
function texts(value, nonEmpty) { return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every((item) => text(item)); }
function stable(value) { if (value === null || typeof value !== "object")
    return JSON.stringify(value); if (Array.isArray(value))
    return `[${value.map(stable).join(",")}]`; return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`; }
