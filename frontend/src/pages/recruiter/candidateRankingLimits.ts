export function isValidCandidateRankingLimits(primaryLimit: number, fallbackLimit: number) {
  return Number.isInteger(primaryLimit) && Number.isInteger(fallbackLimit)
    && primaryLimit >= 0 && primaryLimit <= 100
    && fallbackLimit >= 0 && fallbackLimit <= 100
    && primaryLimit + fallbackLimit >= 1 && primaryLimit + fallbackLimit <= 100;
}
