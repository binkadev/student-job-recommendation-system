import { describe, expect, it } from "vitest";
import { buildStudentSkillsPayload } from "./candidateProfileService";
const profile = {
  skills: {
    frontend: [{ id: "1", skillId: 7, name: "React", level: "Tốt", years: 2, source: "MANUAL" }],
    backend: [],
    tools: [{ id: "2", name: "Next.js", level: "Khá", years: 1, source: "MANUAL" }],
    soft: [],
  },
};

describe("student skill persistence payload", () => {
  it("uses skillId for catalog skills and skillName/category for custom skills", () => {
    expect(buildStudentSkillsPayload(profile, [{ id: 7, name: "React", normalizedName: "react", category: "Frontend" }])).toEqual([
      { skillId: 7, proficiencyLevel: "ADVANCED", yearsOfExperience: 2, source: "MANUAL" },
      { skillName: "Next.js", category: "Tools", proficiencyLevel: "INTERMEDIATE", yearsOfExperience: 1, source: "MANUAL" },
    ]);
  });
});
