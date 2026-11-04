import { act, renderHook } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { useGenerationRecovery } from "./useGenerationRecovery";

it("requires an explicit successful run read-back and keeps blocked while processing", async () => {
  const read = vi.fn().mockResolvedValueOnce([{ status: "PROCESSING" }]).mockResolvedValueOnce([{ status: "SUCCESS" }]);
  const reload = vi.fn();
  const hook = renderHook(() => useGenerationRecovery(read, reload));
  act(() => hook.result.current.requireReadBack());
  expect(hook.result.current.blocked).toBe(true); expect(read).not.toHaveBeenCalled();
  await act(async () => hook.result.current.readBack());
  expect(hook.result.current.blocked).toBe(true);
  await act(async () => hook.result.current.readBack());
  expect(hook.result.current.blocked).toBe(false); expect(reload).toHaveBeenCalledTimes(2);
});

it("failed read-back preserves the mutation block", async () => {
  const reload = vi.fn();
  const hook = renderHook(() => useGenerationRecovery(() => Promise.reject(new Error("Offline")), reload));
  act(() => hook.result.current.requireReadBack());
  await act(async () => hook.result.current.readBack());
  expect(hook.result.current.blocked).toBe(true); expect(hook.result.current.reading).toBe(false);
  expect(reload).not.toHaveBeenCalled();
});
