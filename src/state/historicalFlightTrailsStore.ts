import { useSyncExternalStore } from 'react';
import { HISTORICAL_FLIGHT_ALL_AIRPORTS, type HistoricalFlightCountry } from '../data/historicalFlightTrailsTypes';

export interface HistoricalFlightStatus {
  state: 'idle' | 'loading' | 'ready' | 'unavailable' | 'error';
  message: string; count?: number;
}
const statuses: Record<HistoricalFlightCountry, HistoricalFlightStatus> = {
  TW: { state: 'idle', message: '' }, JP: { state: 'idle', message: '' },
};
const listeners = new Set<() => void>();
const selections: Record<HistoricalFlightCountry, { airport: string; date: string }> = {
  TW: { airport: HISTORICAL_FLIGHT_ALL_AIRPORTS, date: '2026-02-20' },
  JP: { airport: HISTORICAL_FLIGHT_ALL_AIRPORTS, date: '2026-02-18' },
};
const focusRequests = { TW: 0, JP: 0 };
const retryRevisions = { TW: 0, JP: 0 };
export function requestHistoricalFlightFocus(country: HistoricalFlightCountry) {
  focusRequests[country]++; listeners.forEach(listener => listener());
}
export function useHistoricalFlightFocusRequest(country: HistoricalFlightCountry) {
  return useSyncExternalStore(subscribe, () => focusRequests[country], () => focusRequests[country]);
}
export function retryHistoricalFlightSelection(country: HistoricalFlightCountry) {
  retryRevisions[country]++; listeners.forEach(listener => listener());
}
export function useHistoricalFlightRetryRevision(country: HistoricalFlightCountry) {
  return useSyncExternalStore(subscribe, () => retryRevisions[country], () => retryRevisions[country]);
}
export function setHistoricalFlightSelection(country: HistoricalFlightCountry, selection: { airport: string; date: string }) {
  selections[country] = selection;
  listeners.forEach(listener => listener());
}
export function useHistoricalFlightSelection(country: HistoricalFlightCountry) {
  return useSyncExternalStore(subscribe, () => selections[country], () => selections[country]);
}
export function setHistoricalFlightStatus(country: HistoricalFlightCountry, status: HistoricalFlightStatus) {
  statuses[country] = status;
  listeners.forEach(listener => listener());
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useHistoricalFlightStatus(country: HistoricalFlightCountry) {
  return useSyncExternalStore(subscribe, () => statuses[country], () => statuses[country]);
}
