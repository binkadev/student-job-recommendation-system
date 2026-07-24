import { getStorageItem, setStorageItem } from "../../../utils/localStorage";
import { withMockDelay } from "../../../utils/mockDelay";
import { defaultCandidateCvs } from "./candidateCvMockData";
import type { CandidateCvItem } from "./candidateCvTypes";

const CVS_KEY = "candidate-cvs";

export function getCandidateCvs() {
  return withMockDelay(getStorageItem<CandidateCvItem[]>(CVS_KEY, defaultCandidateCvs));
}

export function saveCandidateCvs(cvs: CandidateCvItem[]) {
  setStorageItem(CVS_KEY, cvs);
  return withMockDelay(cvs);
}
