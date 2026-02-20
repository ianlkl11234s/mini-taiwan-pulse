import { useCallback, useEffect, useState } from "react";
import type { Flight } from "../types";
import {
  filterByAirport,
  getTimeRange,
  getTaiwanAirports,
  loadFlights,
} from "../data/flightLoader";

interface UseFlightDataReturn {
  allFlights: Flight[];
  filteredFlights: Flight[];
  airports: string[];
  selectedAirport: string;
  setSelectedAirport: (icao: string) => void;
  timeRange: { start: number; end: number };
  loading: boolean;
}

export function useFlightData(): UseFlightDataReturn {
  const [allFlights, setAllFlights] = useState<Flight[]>([]);
  const [airports, setAirports] = useState<string[]>([]);
  const [selectedAirport, setSelectedAirport] = useState("RCTP");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlights().then((flights) => {
      setAllFlights(flights);
      setAirports(getTaiwanAirports(flights));
      setLoading(false);
    });
  }, []);

  const filteredFlights = filterByAirport(allFlights, selectedAirport);
  const timeRange = filteredFlights.length
    ? getTimeRange(filteredFlights)
    : { start: 0, end: 0 };

  const handleSetAirport = useCallback((icao: string) => {
    setSelectedAirport(icao);
  }, []);

  return {
    allFlights,
    filteredFlights,
    airports,
    selectedAirport,
    setSelectedAirport: handleSetAirport,
    timeRange,
    loading,
  };
}
