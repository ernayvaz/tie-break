import type {
  HalisahaFormation,
  HalisahaPositionKey,
  HalisahaTeamSide,
} from "@prisma/client";

export const HALISAHA_MATCH_SINGLETON_KEY = "active";
export const HALISAHA_TIMEZONE = "Europe/Istanbul";
export const HALISAHA_TITLE = "RayNET Matchday Show";
export const HALISAHA_DEFAULT_HOME_TEAM = "RayNET Glory";
export const HALISAHA_DEFAULT_AWAY_TEAM = "Flexera Club";
export const HALISAHA_DEFAULT_VENUE = "HITABSPOR Arena";
export const HALISAHA_DEFAULT_FORMATION: HalisahaFormation = "f1_2_3_1";

export type HalisahaPositionLineGroup =
  | "goalkeeper"
  | "defense"
  | "midfield"
  | "attack";

export type HalisahaPitchCoordinate = {
  x: number;
  y: number;
};

export type HalisahaPitchSpot = {
  key: HalisahaPositionKey;
  label: string;
  displayOrder: number;
  lineGroup: HalisahaPositionLineGroup;
  home: HalisahaPitchCoordinate;
  away: HalisahaPitchCoordinate;
};

export type HalisahaFormationDefinition = {
  key: HalisahaFormation;
  label: string;
  slots: HalisahaPitchSpot[];
};

function mirrorPitchCoordinate(spot: HalisahaPitchCoordinate): HalisahaPitchCoordinate {
  return {
    x: 1000 - spot.x,
    y: spot.y,
  };
}

function createPitchSpot(input: {
  key: HalisahaPositionKey;
  label: string;
  displayOrder: number;
  lineGroup: HalisahaPositionLineGroup;
  home: HalisahaPitchCoordinate;
}): HalisahaPitchSpot {
  return {
    ...input,
    away: mirrorPitchCoordinate(input.home),
  };
}

export const HALISAHA_FORMATIONS: HalisahaFormationDefinition[] = [
  {
    key: "f1_2_3_1",
    label: "1-2-3-1",
    slots: [
      createPitchSpot({
        key: "goalkeeper",
        label: "Goalkeeper",
        displayOrder: 10,
        lineGroup: "goalkeeper",
        home: { x: 47, y: 310 },
      }),
      createPitchSpot({
        key: "left_defender",
        label: "Left defender",
        displayOrder: 20,
        lineGroup: "defense",
        home: { x: 198, y: 186 },
      }),
      createPitchSpot({
        key: "right_defender",
        label: "Right defender",
        displayOrder: 30,
        lineGroup: "defense",
        home: { x: 198, y: 444 },
      }),
      createPitchSpot({
        key: "left_wing",
        label: "Left wing",
        displayOrder: 40,
        lineGroup: "midfield",
        home: { x: 340, y: 162 },
      }),
      createPitchSpot({
        key: "center_midfield",
        label: "Center midfield",
        displayOrder: 50,
        lineGroup: "midfield",
        home: { x: 292, y: 310 },
      }),
      createPitchSpot({
        key: "right_wing",
        label: "Right wing",
        displayOrder: 60,
        lineGroup: "midfield",
        home: { x: 340, y: 458 },
      }),
      createPitchSpot({
        key: "striker",
        label: "Striker",
        displayOrder: 70,
        lineGroup: "attack",
        home: { x: 388, y: 310 },
      }),
    ],
  },
  {
    key: "f1_3_2_1",
    label: "1-3-2-1",
    slots: [
      createPitchSpot({
        key: "goalkeeper",
        label: "Goalkeeper",
        displayOrder: 10,
        lineGroup: "goalkeeper",
        home: { x: 47, y: 310 },
      }),
      createPitchSpot({
        key: "left_defender",
        label: "Left defender",
        displayOrder: 20,
        lineGroup: "defense",
        home: { x: 198, y: 148 },
      }),
      createPitchSpot({
        key: "center_defender",
        label: "Center defender",
        displayOrder: 30,
        lineGroup: "defense",
        home: { x: 208, y: 310 },
      }),
      createPitchSpot({
        key: "right_defender",
        label: "Right defender",
        displayOrder: 40,
        lineGroup: "defense",
        home: { x: 198, y: 472 },
      }),
      createPitchSpot({
        key: "left_midfielder",
        label: "Left midfielder",
        displayOrder: 50,
        lineGroup: "midfield",
        home: { x: 326, y: 220 },
      }),
      createPitchSpot({
        key: "right_midfielder",
        label: "Right midfielder",
        displayOrder: 60,
        lineGroup: "midfield",
        home: { x: 326, y: 400 },
      }),
      createPitchSpot({
        key: "striker",
        label: "Striker",
        displayOrder: 70,
        lineGroup: "attack",
        home: { x: 388, y: 310 },
      }),
    ],
  },
  {
    key: "f1_3_3",
    label: "1-3-3",
    slots: [
      createPitchSpot({
        key: "goalkeeper",
        label: "Goalkeeper",
        displayOrder: 10,
        lineGroup: "goalkeeper",
        home: { x: 47, y: 310 },
      }),
      createPitchSpot({
        key: "left_defender",
        label: "Left defender",
        displayOrder: 20,
        lineGroup: "defense",
        home: { x: 198, y: 148 },
      }),
      createPitchSpot({
        key: "center_defender",
        label: "Center defender",
        displayOrder: 30,
        lineGroup: "defense",
        home: { x: 208, y: 310 },
      }),
      createPitchSpot({
        key: "right_defender",
        label: "Right defender",
        displayOrder: 40,
        lineGroup: "defense",
        home: { x: 198, y: 472 },
      }),
      createPitchSpot({
        key: "left_forward",
        label: "Left forward",
        displayOrder: 50,
        lineGroup: "attack",
        home: { x: 388, y: 168 },
      }),
      createPitchSpot({
        key: "striker",
        label: "Striker",
        displayOrder: 60,
        lineGroup: "attack",
        home: { x: 404, y: 310 },
      }),
      createPitchSpot({
        key: "right_forward",
        label: "Right forward",
        displayOrder: 70,
        lineGroup: "attack",
        home: { x: 388, y: 452 },
      }),
    ],
  },
  {
    key: "f1_2_2_2",
    label: "1-2-2-2",
    slots: [
      createPitchSpot({
        key: "goalkeeper",
        label: "Goalkeeper",
        displayOrder: 10,
        lineGroup: "goalkeeper",
        home: { x: 47, y: 310 },
      }),
      createPitchSpot({
        key: "left_defender",
        label: "Left defender",
        displayOrder: 20,
        lineGroup: "defense",
        home: { x: 198, y: 186 },
      }),
      createPitchSpot({
        key: "right_defender",
        label: "Right defender",
        displayOrder: 30,
        lineGroup: "defense",
        home: { x: 198, y: 444 },
      }),
      createPitchSpot({
        key: "left_midfielder",
        label: "Left midfielder",
        displayOrder: 40,
        lineGroup: "midfield",
        home: { x: 314, y: 222 },
      }),
      createPitchSpot({
        key: "right_midfielder",
        label: "Right midfielder",
        displayOrder: 50,
        lineGroup: "midfield",
        home: { x: 314, y: 398 },
      }),
      createPitchSpot({
        key: "left_forward",
        label: "Left forward",
        displayOrder: 60,
        lineGroup: "attack",
        home: { x: 404, y: 224 },
      }),
      createPitchSpot({
        key: "right_forward",
        label: "Right forward",
        displayOrder: 70,
        lineGroup: "attack",
        home: { x: 404, y: 396 },
      }),
    ],
  },
  {
    key: "f1_3_1_2",
    label: "1-3-1-2",
    slots: [
      createPitchSpot({
        key: "goalkeeper",
        label: "Goalkeeper",
        displayOrder: 10,
        lineGroup: "goalkeeper",
        home: { x: 47, y: 310 },
      }),
      createPitchSpot({
        key: "left_defender",
        label: "Left defender",
        displayOrder: 20,
        lineGroup: "defense",
        home: { x: 198, y: 148 },
      }),
      createPitchSpot({
        key: "center_defender",
        label: "Center defender",
        displayOrder: 30,
        lineGroup: "defense",
        home: { x: 208, y: 310 },
      }),
      createPitchSpot({
        key: "right_defender",
        label: "Right defender",
        displayOrder: 40,
        lineGroup: "defense",
        home: { x: 198, y: 472 },
      }),
      createPitchSpot({
        key: "center_midfield",
        label: "Center midfield",
        displayOrder: 50,
        lineGroup: "midfield",
        home: { x: 308, y: 310 },
      }),
      createPitchSpot({
        key: "left_forward",
        label: "Left forward",
        displayOrder: 60,
        lineGroup: "attack",
        home: { x: 404, y: 224 },
      }),
      createPitchSpot({
        key: "right_forward",
        label: "Right forward",
        displayOrder: 70,
        lineGroup: "attack",
        home: { x: 404, y: 396 },
      }),
    ],
  },
  {
    key: "f1_2_1_3",
    label: "1-2-1-3",
    slots: [
      createPitchSpot({
        key: "goalkeeper",
        label: "Goalkeeper",
        displayOrder: 10,
        lineGroup: "goalkeeper",
        home: { x: 47, y: 310 },
      }),
      createPitchSpot({
        key: "left_defender",
        label: "Left defender",
        displayOrder: 20,
        lineGroup: "defense",
        home: { x: 198, y: 186 },
      }),
      createPitchSpot({
        key: "right_defender",
        label: "Right defender",
        displayOrder: 30,
        lineGroup: "defense",
        home: { x: 198, y: 444 },
      }),
      createPitchSpot({
        key: "center_midfield",
        label: "Center midfield",
        displayOrder: 40,
        lineGroup: "midfield",
        home: { x: 308, y: 310 },
      }),
      createPitchSpot({
        key: "left_forward",
        label: "Left forward",
        displayOrder: 50,
        lineGroup: "attack",
        home: { x: 404, y: 168 },
      }),
      createPitchSpot({
        key: "striker",
        label: "Striker",
        displayOrder: 60,
        lineGroup: "attack",
        home: { x: 420, y: 310 },
      }),
      createPitchSpot({
        key: "right_forward",
        label: "Right forward",
        displayOrder: 70,
        lineGroup: "attack",
        home: { x: 404, y: 452 },
      }),
    ],
  },
];

const halisahaFormationMap = new Map(
  HALISAHA_FORMATIONS.map((formation) => [formation.key, formation]),
);

export const HALISAHA_FORMATION_OPTIONS: Array<{
  value: HalisahaFormation;
  label: string;
}> = HALISAHA_FORMATIONS.map((formation) => ({
  value: formation.key,
  label: formation.label,
}));

export const HALISAHA_POSITION_SLOTS: HalisahaPitchSpot[] =
  halisahaFormationMap.get(HALISAHA_DEFAULT_FORMATION)?.slots ?? [];

export const HALISAHA_TEAM_SIDE_OPTIONS: Array<{
  value: HalisahaTeamSide;
  label: string;
}> = [
  { value: "home", label: "Home team" },
  { value: "away", label: "Away team" },
];

function getHalisahaFormationDefinition(
  formation: HalisahaFormation = HALISAHA_DEFAULT_FORMATION,
) {
  return (
    halisahaFormationMap.get(formation) ??
    halisahaFormationMap.get(HALISAHA_DEFAULT_FORMATION)!
  );
}

function findHalisahaPitchSpot(
  formation: HalisahaFormation,
  positionKey: HalisahaPositionKey,
) {
  return getHalisahaFormationDefinition(formation).slots.find(
    (slot) => slot.key === positionKey,
  );
}

function findAnyHalisahaPitchSpot(positionKey: HalisahaPositionKey) {
  for (const formation of HALISAHA_FORMATIONS) {
    const slot = formation.slots.find((entry) => entry.key === positionKey);
    if (slot) {
      return slot;
    }
  }

  return null;
}

export function getHalisahaFormationLabel(formation: HalisahaFormation) {
  return getHalisahaFormationDefinition(formation).label;
}

export function getHalisahaFormationSlots(
  formation: HalisahaFormation = HALISAHA_DEFAULT_FORMATION,
) {
  return getHalisahaFormationDefinition(formation).slots;
}

export function getHalisahaFormationPositionOptions(
  formation: HalisahaFormation = HALISAHA_DEFAULT_FORMATION,
) {
  return getHalisahaFormationSlots(formation).map((slot) => ({
    value: slot.key,
    label: slot.label,
    displayOrder: slot.displayOrder,
  }));
}

export function isHalisahaPositionAllowed(
  formation: HalisahaFormation,
  positionKey: HalisahaPositionKey | null | undefined,
) {
  if (!positionKey) {
    return false;
  }

  return Boolean(findHalisahaPitchSpot(formation, positionKey));
}

export function getHalisahaPositionLineGroup(
  formation: HalisahaFormation,
  positionKey: HalisahaPositionKey,
) {
  return findHalisahaPitchSpot(formation, positionKey)?.lineGroup ?? null;
}

export function getHalisahaStackedLineGroups(
  formation: HalisahaFormation = HALISAHA_DEFAULT_FORMATION,
) {
  const grouped = new Map<HalisahaPositionLineGroup, HalisahaPositionKey[]>();

  for (const slot of getHalisahaFormationSlots(formation)) {
    if (!grouped.has(slot.lineGroup)) {
      grouped.set(slot.lineGroup, []);
    }
    grouped.get(slot.lineGroup)?.push(slot.key);
  }

  return ["defense", "midfield", "attack"]
    .map((group) => grouped.get(group as HalisahaPositionLineGroup) ?? [])
    .filter((group) => group.length > 1);
}

export function getHalisahaPositionLabel(
  positionKey: HalisahaPositionKey,
  formation: HalisahaFormation = HALISAHA_DEFAULT_FORMATION,
) {
  return (
    findHalisahaPitchSpot(formation, positionKey)?.label ??
    findAnyHalisahaPitchSpot(positionKey)?.label ??
    positionKey
  );
}

export function getHalisahaPositionDisplayOrder(
  positionKey: HalisahaPositionKey,
  formation: HalisahaFormation = HALISAHA_DEFAULT_FORMATION,
) {
  return (
    findHalisahaPitchSpot(formation, positionKey)?.displayOrder ??
    findAnyHalisahaPitchSpot(positionKey)?.displayOrder ??
    999
  );
}

export function getPitchSpot(
  teamSide: HalisahaTeamSide,
  formationOrPositionKey: HalisahaFormation | HalisahaPositionKey,
  maybePositionKey?: HalisahaPositionKey,
) {
  const formation = maybePositionKey
    ? (formationOrPositionKey as HalisahaFormation)
    : HALISAHA_DEFAULT_FORMATION;
  const positionKey = maybePositionKey ?? (formationOrPositionKey as HalisahaPositionKey);
  const slot = findHalisahaPitchSpot(formation, positionKey);
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
