import { describe, expect, it, vi } from "vitest";
import { httpClient } from "../../../services/api/httpClient";
import { makeDetail, rankingJob } from "../../../test/candidateRankingFixtures";
import {
  createCandidateRankingRun,
  getCandidateRankingJob,
  getCandidateRankingRun,
  getCandidateRankingRuns,
  openCandidateRankingCv,
  saveRankingCandidate,
  updateRankingApplicationStatus,
} from "./candidateRankingApi";

vi.mock("../../../services/api/httpClient", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedHttpClient = vi.mocked(httpClient);

describe("candidate ranking API", () => {
  it("gets job detail through the existing mapper", async () => {
    mockedHttpClient.get.mockResolvedValueOnce({ data: { data: { id: 42, title: "Frontend Engineer", status: "ACTIVE", location: null, jobType: null, workingModel: null } } });

    await expect(getCandidateRankingJob("42")).resolves.toEqual({
      ...rankingJob,
      location: "Chưa cập nhật",
      jobType: "Chưa cập nhật",
      workingModel: "Chưa cập nhật",
    });
    expect(mockedHttpClient.get).toHaveBeenCalledWith("/jobs/42");
  });

  it("creates a run with the exact V3 tier-limit body", async () => {
    mockedHttpClient.post.mockResolvedValueOnce({ data: { data: { id: 4, results: [] } } });

    await createCandidateRankingRun("42", { threshold: 0.3, primaryLimit: 50, fallbackLimit: 0 });

    expect(mockedHttpClient.post).toHaveBeenCalledWith(
      "/companies/me/jobs/42/candidate-ranking-runs",
      { threshold: 0.3, primaryLimit: 50, fallbackLimit: 0 },
    );
  });

  it("gets history with the real page and size and maps missing items to empty", async () => {
    mockedHttpClient.get.mockResolvedValueOnce({ data: { data: { items: null } } });

    await expect(getCandidateRankingRuns("42")).resolves.toEqual([]);
    expect(mockedHttpClient.get).toHaveBeenCalledWith(
      "/companies/me/jobs/42/candidate-ranking-runs",
      { params: { page: 1, size: 20 } },
    );
  });

  it("gets a run detail and passes its results through the mapper", async () => {
    mockedHttpClient.get.mockResolvedValueOnce({ data: { data: { id: 4, results: [{ applicationId: 8, rankPosition: 3 }] } } });

    const detail = await getCandidateRankingRun("42", "4");

    expect(detail.results[0].applicationId).toBe("8");
    expect(detail.results[0].rankPosition).toBe(3);
    expect(mockedHttpClient.get).toHaveBeenCalledWith("/companies/me/jobs/42/candidate-ranking-runs/4");
  });

  it("opens CV blobs safely and revokes their URL after the existing timeout", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => "blob:cv-1");
    const revokeObjectURL = vi.fn();
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    Object.defineProperty(window.URL, "createObjectURL", { configurable: true, value: createObjectURL });
    Object.defineProperty(window.URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
    mockedHttpClient.get.mockResolvedValueOnce({ data: new Blob(["cv"]) });

    await openCandidateRankingCv("101");

    expect(mockedHttpClient.get).toHaveBeenCalledWith(
      "/companies/me/applications/101/cv/file",
      { responseType: "blob" },
    );
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(open).toHaveBeenCalledWith("blob:cv-1", "_blank", "noopener,noreferrer");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:cv-1");
  });

  it("saves a candidate with a numeric applicationId and null note", async () => {
    mockedHttpClient.post.mockResolvedValueOnce({ data: { success: true } });

    await saveRankingCandidate("101");

    expect(mockedHttpClient.post).toHaveBeenCalledWith(
      "/companies/me/saved-candidates",
      { applicationId: 101, note: null },
    );
  });

  it("updates application status with the exact body", async () => {
    mockedHttpClient.patch.mockResolvedValueOnce({ data: { success: true } });

    await updateRankingApplicationStatus("101", "REVIEWED");

    expect(mockedHttpClient.patch).toHaveBeenCalledWith("/applications/101/status", { status: "REVIEWED" });
  });

  it("rejects failed HTTP calls instead of manufacturing success data", async () => {
    const error = new Error("network failed");
    mockedHttpClient.get.mockRejectedValueOnce(error);

    await expect(getCandidateRankingRuns("42")).rejects.toBe(error);
  });

  it("keeps result order from the mapped response", async () => {
    mockedHttpClient.get.mockResolvedValueOnce({ data: { data: { id: 4, results: [] } } });
    const detail = makeDetail({ results: [] });

    await getCandidateRankingRun("42", detail.run.id);

    expect(mockedHttpClient.get).toHaveBeenCalledWith("/companies/me/jobs/42/candidate-ranking-runs/run-1");
  });
});
