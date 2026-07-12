import { getStorageItem, setStorageItem } from "../../../utils/localStorage";
import { withMockDelay } from "../../../utils/mockDelay";
import { candidatePreferencesOptions, defaultCandidatePreferences } from "./candidatePreferencesMockData";
import type { CandidateCareerPreferences } from "./candidatePreferencesTypes";

const PREFERENCES_KEY = "candidate-career-preferences";

export function getCandidateCareerPreferences() {
  return withMockDelay({
    preferences: getStorageItem<CandidateCareerPreferences>(PREFERENCES_KEY, defaultCandidatePreferences),
    options: candidatePreferencesOptions,
    defaults: defaultCandidatePreferences,
  });
}

export function updateCandidateCareerPreferences(preferences: CandidateCareerPreferences) {
  setStorageItem(PREFERENCES_KEY, preferences);
  return withMockDelay(preferences);
}
