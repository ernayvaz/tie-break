import { createProviderAttempt } from "./types";

const SCOREBAT_LIVE_SCORES_WIDGET_URL = "https://www.scorebat.com/embed/livescore/";

export type ScoreBatWidgetResolution = {
  provider: "scorebat.com";
  available: boolean;
  src: string | null;
  reason: string;
};

export function resolveScoreBatStructuredAttempt(
  sectionLabel: string
): ReturnType<typeof createProviderAttempt> {
  return createProviderAttempt(
    "scorebat.com",
    "unsupported",
    `ScoreBat does not provide a supported structured ${sectionLabel} fallback in this project.`
  );
}

export function resolveScoreBatWidget(widgetLabel: string): ScoreBatWidgetResolution {
  return {
    provider: "scorebat.com",
    available: false,
    src: null,
    reason: `ScoreBat does not provide a supported ${widgetLabel} widget for this panel.`,
  };
}

export function resolveScoreBatLiveScoresWidget(): ScoreBatWidgetResolution {
  return {
    provider: "scorebat.com",
    available: true,
    src: SCOREBAT_LIVE_SCORES_WIDGET_URL,
    reason: "ScoreBat public livescore widget is available as the tertiary live fallback.",
  };
}
