import { describe, expect, it } from "vitest";
import { isCvDeleteAvailable, isCvInUseError } from "./cvDeletion";

describe("CV deletability", () => {
  it("uses the Backend deletable flag instead of active status", () => {
    expect(isCvDeleteAvailable({ deletable: true })).toBe(true);
    expect(isCvDeleteAvailable({ deletable: false })).toBe(false);
  });

  it("recognizes a CV_IN_USE race response", () => {
    expect(isCvInUseError({ response: { data: { errorCode: "CV_IN_USE" } } })).toBe(true);
  });
});
