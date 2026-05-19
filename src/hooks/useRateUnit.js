import { useState } from "react";

// Returns [isPpm, setIsPpm] — persisted to localStorage
// isPpm=false → show Cases/Hour, isPpm=true → show Pops/Minute
export function useRateUnit() {
  const [isPpm, setIsPpmState] = useState(() => {
    return localStorage.getItem("rateUnit") === "ppm";
  });

  function setIsPpm(val) {
    setIsPpmState(val);
    localStorage.setItem("rateUnit", val ? "ppm" : "cph");
  }

  return [isPpm, setIsPpm];
}

// Convert cases/hour → pops/minute  (144 popsicles per case)
export function cphToPpm(cph) {
  return (cph * 144) / 60;
}

export function formatRate(cph, isPpm) {
  if (isPpm) {
    return { value: cphToPpm(cph).toFixed(2), label: "pops/min" };
  }
  return { value: Number(cph).toFixed(1), label: "cases/hr" };
}