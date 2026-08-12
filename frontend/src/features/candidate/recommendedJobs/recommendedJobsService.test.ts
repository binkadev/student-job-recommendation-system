import { beforeEach, describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../services/api/httpClient";
import { generateRecommendations } from "./recommendedJobsService";

vi.mock("../../../services/api/httpClient", () => ({ httpClient: { post: vi.fn(), get: vi.fn() } }));

describe("student recommendation request", () => {
  beforeEach(() => vi.resetAllMocks());

  it("serializes exactly cvId, threshold, and limit", async () => {
    vi.mocked(httpClient.post).mockResolvedValueOnce({ data: { data: {} } });
    await generateRecommendations({ cvId: "12", threshold: 0.1, limit: 20 });
    expect(httpClient.post).toHaveBeenCalledWith("/students/me/recommendations/generate", { cvId: 12, threshold: 0.1, limit: 20 });
  });
});
