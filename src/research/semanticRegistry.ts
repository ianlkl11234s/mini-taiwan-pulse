import schools from "./contracts/tw-schools.semantic.json";
import news from "./contracts/tw-news-events.semantic.json";
import paddy from "./contracts/land-use-paddy-area-township.semantic.json";
import { assertValidSemanticCard, type SemanticCard } from "./contracts/semantic-validator.mjs";

const cards = [schools, news, paddy].map(card => assertValidSemanticCard(card) as SemanticCard);
export function describeDatasetSemantics(datasetId: string): SemanticCard | null {
  return structuredClone(cards.find(card => card.datasetId === datasetId) ?? null);
}
