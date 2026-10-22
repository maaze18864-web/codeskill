import { questionStarterCode } from "@/lib/editor-languages";

describe("questionStarterCode", () => {
  const uploaded = [
    { language: "cpp", code: "CUSTOM_CPP" },
    { language: "java", code: "CUSTOM_JAVA" },
    { language: "python3", code: "CUSTOM_PYTHON" },
  ];

  it.each([
    ["cpp", "CUSTOM_CPP"],
    ["java", "CUSTOM_JAVA"],
    ["python", "CUSTOM_PYTHON"],
  ])("selects the uploaded %s starter code", (language, expected) => {
    expect(questionStarterCode(uploaded, language)).toBe(expected);
  });

  it("preserves the existing single-template language behavior", () => {
    expect(questionStarterCode("legacy template", "python", "python3")).toBe("legacy template");
    expect(questionStarterCode("legacy template", "cpp", "python3")).toBeUndefined();
  });

  it("returns undefined for a language without a template so the caller can use its fallback", () => {
    expect(questionStarterCode(uploaded, "javascript")).toBeUndefined();
    expect(questionStarterCode(undefined, "python")).toBeUndefined();
  });
});
