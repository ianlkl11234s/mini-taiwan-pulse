import { useCallback, useEffect, useState } from "react";
import type { Flight } from "../types";
import {
  filterByAirport,
  getTimeRange,
  getTaiwanAirports,
  loadFlights,
  updateCachedFlights,
} from "../data/flightLoader";
import { mergeS3Updates } from "../data/s3Loader";

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
  const [selectedAirport, setSelectedAirport] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFlights().then((flights) => {
      setAllFlights(flights);
      setAirports(getTaiwanAirports(flights));
      setLoading(false);

      // 背景檢查 S3 是否有新資料
      mergeS3Updates(flights).then((merged) => {
        if (merged !== flights) {
          updateCachedFlights(merged);
          setAllFlights(merged);
          setAirports(getTaiwanAirports(merged));
        }
      });
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
