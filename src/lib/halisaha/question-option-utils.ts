import type { HalisahaQuestionKind, HalisahaQuestionOptionKind } from "@prisma/client";

export type ManagedHalisahaQuestionKind =
  | "standard"
  | "player_prediction"
  | "score_prediction"
  | "number_prediction";

export type ManagedHalisahaQuestionOptionInput = {
  label: string;
  kind: ManagedHalisahaQuestionKind;
};

export const CUSTOM_SCORE_OPTION_LABEL = "Your exact score";
export const CUSTOM_NUMBER_OPTION_LABEL = "Your number guess";
export const PLAYER_PICKER_OPTION_LABEL = "Choose player";

export function normalizeManagedHalisahaQuestionKind(
  kind: HalisahaQuestionKind,
): ManagedHalisahaQuestionKind {
  if (
    kind === "player_prediction" ||
    kind === "score_prediction" ||
    kind === "number_prediction"
  ) {
    return kind;
  }

  return "standard";
}

export function getManagedHalisahaQuestionKindLabel(kind: ManagedHalisahaQuestionKind) {
  if (kind === "player_prediction") return "Player picker";
  if (kind === "score_prediction") return "Two-number prediction";
  if (kind === "number_prediction") return "Single-number prediction";
  return "Standard multiple choice";
}

export function getManagedHalisahaQuestionOptionDefaultLabel(
  kind: ManagedHalisahaQuestionKind,
) {
  if (kind === "player_prediction") {
    return PLAYER_PICKER_OPTION_LABEL;
  }
  if (kind === "score_prediction") {
    return CUSTOM_SCORE_OPTION_LABEL;
  }
  if (kind === "number_prediction") {
    return CUSTOM_NUMBER_OPTION_LABEL;
  }
  return "";
}

export function normalizeManagedHalisahaQuestionOptionLabel(
  option: ManagedHalisahaQuestionOptionInput,
) {
  const trimmedLabel = option.label.trim();

  if (option.kind === "standard") {
    return trimmedLabel;
  }

  return trimmedLabel || getManagedHalisahaQuestionOptionDefaultLabel(option.kind);
}

export function deriveManagedHalisahaQuestionKindFromDrafts(
  drafts: ManagedHalisahaQuestionOptionInput[],
): ManagedHalisahaQuestionKind {
  const kinds = new Set(drafts.map((draft) => draft.kind));

  if (kinds.size === 1) {
    const [kind] = drafts;
    return kind?.kind ?? "standard";
  }

  return "standard";
}

type StoredOptionLike = {
  label: string;
  kind: HalisahaQuestionOptionKind;
  participantId?: string | null;
  sortOrder: number;
};

export function collapseStoredHalisahaQuestionOptionsToDrafts<T extends StoredOptionLike>(
  options: T[],
): ManagedHalisahaQuestionOptionInput[] {
  const drafts: ManagedHalisahaQuestionOptionInput[] = [];
  let addedPlayerPickerDraft = false;

  for (const option of [...options].sort((left, right) => left.sortOrder - right.sortOrder)) {
    if (option.kind === "player_picker") {
      drafts.push({
        label: PLAYER_PICKER_OPTION_LABEL,
        kind: "player_prediction",
      });
      addedPlayerPickerDraft = true;
      continue;
    }

    if (option.participantId) {
      if (!addedPlayerPickerDraft) {
        drafts.push({
          label: PLAYER_PICKER_OPTION_LABEL,
          kind: "player_prediction",
        });
        addedPlayerPickerDraft = true;
      }
      continue;
    }

    if (option.kind === "custom_score") {
      drafts.push({
        label: option.label,
        kind: "score_prediction",
      });
      continue;
    }

    if (option.kind === "custom_number") {
      drafts.push({
        label: option.label,
        kind: "number_prediction",
      });
      continue;
    }

    drafts.push({
      label: option.label,
      kind: "standard",
    });
  }

  return drafts;
}

type OptionLike = {
  kind: HalisahaQuestionOptionKind;
  participantId?: string | null;
};

type ResolvedOptionLike = OptionLike & {
  isCorrect?: boolean;
  resolvedScoreHome?: number | null;
  resolvedScoreAway?: number | null;
};

export function isHalisahaPlayerPickerPlaceholderOption(option: OptionLike) {
  return option.kind === "player_picker";
}

export function isHalisahaParticipantOption(option: OptionLike) {
  return Boolean(option.participantId);
}

export function isHalisahaFixedChoiceOption(option: OptionLike) {
  return option.kind === "standard";
}

export function isHalisahaNumericOptionKind(kind: HalisahaQuestionOptionKind) {
  return kind === "custom_score" || kind === "custom_number";
}

export function isHalisahaNumericOption(option: OptionLike) {
  return isHalisahaNumericOptionKind(option.kind);
}

export function hasHalisahaPlayerPickerOption(options: OptionLike[]) {
  return options.some(isHalisahaPlayerPickerPlaceholderOption) || options.some(isHalisahaParticipantOption);
}

export function hasHalisahaCustomScoreOption(options: OptionLike[]) {
  return options.some((option) => option.kind === "custom_score");
}

export function hasHalisahaCustomNumberOption(options: OptionLike[]) {
  return options.some((option) => option.kind === "custom_number");
}

export function getHalisahaParticipantOptions<T extends OptionLike>(options: T[]) {
  return options.filter(isHalisahaParticipantOption);
}

export function getHalisahaFixedChoiceOptions<T extends OptionLike>(options: T[]) {
  return options.filter(isHalisahaFixedChoiceOption);
}

export function getHalisahaQuestionTypeBadgesFromOptionKinds(
  drafts: ManagedHalisahaQuestionOptionInput[],
) {
  const kinds = [...new Set(drafts.map((draft) => draft.kind))];

  return kinds.map((kind) => ({
    kind,
    label: getManagedHalisahaQuestionKindLabel(kind),
  }));
}

export function hasResolvedHalisahaQuestionResult(options: ResolvedOptionLike[]) {
  const fixedChoiceOptions = getHalisahaFixedChoiceOptions(options);
  const customScoreOptions = options.filter((option) => option.kind === "custom_score");
  const customNumberOptions = options.filter((option) => option.kind === "custom_number");

  const fixedChoiceResolved =
    fixedChoiceOptions.length === 0 ||
    fixedChoiceOptions.filter((option) => option.isCorrect).length === 1;
  const customScoreResolved = customScoreOptions.every(
    (option) =>
      option.resolvedScoreHome !== null &&
      option.resolvedScoreHome !== undefined &&
      option.resolvedScoreAway !== null &&
      option.resolvedScoreAway !== undefined,
  );
  const customNumberResolved = customNumberOptions.every(
    (option) =>
      option.resolvedScoreHome !== null && option.resolvedScoreHome !== undefined,
  );

  return fixedChoiceResolved && customScoreResolved && customNumberResolved;
}
