import { PredictionValue } from "@prisma/client";

/** Display/API: "1" | "X" | "2" */
export type PredictionDisplay = "1" | "X" | "2";

const TO_DISPLAY: Record<PredictionValue, PredictionDisplay> = {
  ONE: "1",
  X: "X",
  TWO: "2",
};

const FROM_DISPLAY: Record<PredictionDisplay, PredictionValue> = {
  "1": "ONE",
  X: "X",
  "2": "TWO",
};

export function toDisplay(value: PredictionValue): PredictionDisplay {
  return TO_DISPLAY[value];
}

export function fromDisplay(display: PredictionDisplay): PredictionValue {
  return FROM_DISPLAY[display];
}

export function isValidDisplay(s: string): s is PredictionDisplay {
  return s === "1" || s === "X" || s === "2";
}
