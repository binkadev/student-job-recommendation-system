import { withMockDelay } from "../../../utils/mockDelay";
import { getStorageItem, setStorageItem } from "../../../utils/localStorage";
import { candidateProfileData } from "./candidateProfileMockData";
import type { CandidateProfileData } from "./candidateProfileTypes";

const PROFILE_KEY = "candidate-profile-data";

export function getCandidateProfileData() {
  return withMockDelay(getStorageItem<CandidateProfileData>(PROFILE_KEY, candidateProfileData));
}

export function updateCandidateProfileData(profile: CandidateProfileData) {
  setStorageItem(PROFILE_KEY, profile);
  return withMockDelay(profile);
}
