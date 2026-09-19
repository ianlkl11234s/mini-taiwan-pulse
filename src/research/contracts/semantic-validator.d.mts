export const SEMANTIC_SCHEMA_VERSION: 'semantic-card/0.1';
export type ConceptKind = 'observed' | 'derived' | 'proxy' | 'hypothesis';
export type EvidenceStatus = 'observed' | 'missing' | 'suppressed' | 'zero' | 'unknown';
export interface MethodRef {
    methodId: string;
    version: string;
}
export interface SemanticCard {
    schemaVersion: 'semantic-card/0.1';
    semanticVersion: string;
    datasetId: string;
    datasetVersion: string | null;
    label: string;
    recordGrain: 'place' | 'event' | 'admin_statistic';
    geometry: {
        role: 'actual' | 'proxy' | 'none';
        spatialAnalysisEligible: boolean;
        meaning: string;
    };
    versions: {
        datasetVersion: string | null;
        sourceVersion: string | null;
        freshness: 'current' | 'stale' | 'unknown';
        note: string;
    }[];
    requiredEvidence: {
        evidenceId: string;
        description: string;
    }[];
    concepts: {
        conceptId: string;
        kind: ConceptKind;
        definition: string;
        method: MethodRef;
        scope: {
            spatialScale: string;
            timeScale: string;
        };
        confidence: {
            level: 'unknown' | 'low' | 'medium' | 'high';
            rationale: string;
        };
        evidenceStatus: 'requires_validation' | 'reviewed';
        references: string[];
        reviewSource: string;
        requiredEvidence: string[];
        allowedAnalyses: string[];
        prohibitedClaims: string[];
    }[];
    allowedAnalyses: string[];
    prohibitedClaims: string[];
}
export interface EvidenceSubmission {
    evidenceId: string;
    evidenceStatus: EvidenceStatus;
    reference?: string;
    datasetVersion?: string | null;
    checksumSha256?: string | null;
    validatedBy?: string | null;
    method?: MethodRef;
    reviewer?: string;
    confidence?: {
        level: 'unknown' | 'low' | 'medium' | 'high';
        rationale: string;
    };
    value?: unknown;
}
export function validateSemanticCard(card: unknown): {
    valid: boolean;
    errors: {
        path: string;
        code: string;
    }[];
};
export function assertValidSemanticCard<T>(card: T): T;
export function assessConcept(card: SemanticCard, conceptId: string, evidence?: EvidenceSubmission[]): {
    datasetId: string;
    datasetVersion: string | null;
    semanticVersion: string;
    conceptId: string;
    kind: ConceptKind;
    assessment: 'supported' | 'hypothesis';
    missingEvidence: {
        evidenceId: string;
        evidenceStatus: EvidenceStatus;
    }[];
};
