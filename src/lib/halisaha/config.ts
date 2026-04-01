import type { HalisahaPositionKey, HalisahaTeamSide } from "@prisma/client";

export const HALISAHA_MATCH_SINGLETON_KEY = "active";
export const HALISAHA_TIMEZONE = "Europe/Istanbul";
export const HALISAHA_TITLE = "RayNET Matchday Show";
export const HALISAHA_DEFAULT_HOME_TEAM = "RayNET Glory";
export const HALISAHA_DEFAULT_AWAY_TEAM = "Flexera Club";
export const HALISAHA_DEFAULT_VENUE = "HITABSPOR Arena";

export type HalisahaPitchSpot = {
  key: HalisahaPositionKey;
  label: string;
  displayOrder: number;
  home: { x: number; y: number };
  away: { x: number; y: number };
};

export const HALISAHA_POSITION_SLOTS: HalisahaPitchSpot[] = [
  {
    key: "goalkeeper",
    label: "Goalkeeper",
    displayOrder: 10,
    home: { x: 47, y: 310 },
    away: { x: 953, y: 310 },
  },
  {
    key: "left_defender",
    label: "Left defender",
    displayOrder: 20,
    home: { x: 198, y: 186 },
    away: { x: 802, y: 186 },
  },
  {
    key: "right_defender",
    label: "Right defender",
    displayOrder: 30,
    home: { x: 198, y: 444 },
    away: { x: 802, y: 444 },
  },
  {
    key: "left_wing",
    label: "Left wing",
    displayOrder: 40,
    home: { x: 340, y: 162 },
    away: { x: 660, y: 162 },
  },
  {
    key: "center_midfield",
    label: "Center midfield",
    displayOrder: 50,
    home: { x: 292, y: 310 },
    away: { x: 708, y: 310 },
  },
  {
    key: "right_wing",
    label: "Right wing",
    displayOrder: 60,
    home: { x: 340, y: 458 },
    away: { x: 660, y: 458 },
  },
  {
    key: "striker",
    label: "Striker",
    displayOrder: 70,
    home: { x: 388, y: 310 },
    away: { x: 612, y: 310 },
  },
];

export const HALISAHA_TEAM_SIDE_OPTIONS: Array<{
  value: HalisahaTeamSide;
  label: string;
}> = [
  { value: "home", label: "Home team" },
  { value: "away", label: "Away team" },
];

export function getHalisahaPositionLabel(positionKey: HalisahaPositionKey) {
  return (
    HALISAHA_POSITION_SLOTS.find((slot) => slot.key === positionKey)?.label ??
    positionKey
  );
}

export function getHalisahaPositionDisplayOrder(positionKey: HalisahaPositionKey) {
  return (
    HALISAHA_POSITION_SLOTS.find((slot) => slot.key === positionKey)?.displayOrder ??
    999
  );
}

export function getPitchSpot(
  teamSide: HalisahaTeamSide,
  positionKey: HalisahaPositionKey,
) {
  const slot = HALISAHA_POSITION_SLOTS.find((item) => item.key === positionKey);
  if (!slot) return null;
  return teamSide === "home" ? slot.home : slot.away;
}

export function createIstanbulDateFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
) {
  return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
}

export function createIstanbulDateFromInputs(dateInput: string, timeInput: string) {
  const [year, month, day] = dateInput.split("-").map(Number);
  const [hour, minute] = timeInput.split(":").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    return null;
  }

  return createIstanbulDateFromParts(year, month, day, hour, minute);
}

function getIstanbulParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: HALISAHA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

export function toIstanbulDateInput(date: Date) {
  const parts = getIstanbulParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function toIstanbulTimeInput(date: Date) {
  const parts = getIstanbulParts(date);
  return `${parts.hour}:${parts.minute}`;
}

export function formatHalisahaDateTime(
  date: Date,
  locale = "tr-TR",
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat(locale, {
    timeZone: HALISAHA_TIMEZONE,
    dateStyle: "short",
    timeStyle: "short",
    ...options,
  }).format(date);
}

export function formatHalisahaKickoffLabel(date: Date) {
  const day = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALISAHA_TIMEZONE,
    day: "2-digit",
  }).format(date);
  const month = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALISAHA_TIMEZONE,
    month: "short",
  })
    .format(date)
    .replace(".", "");
  const year = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALISAHA_TIMEZONE,
    year: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: HALISAHA_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${day} ${month} ${year}  |  ${time}`;
}
