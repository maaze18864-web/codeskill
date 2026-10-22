import {
  hideEntryPoint,
  moveInsertionOffset,
  restoreEntryPoint,
  updateSourceFromVisibleEditor,
} from "@/lib/hidden-entry-point";

describe("hidden entry point handling", () => {
  it("hides only a C++ main function with nested braces and ignores comments and strings", () => {
    const source = [
      "#include <string>",
      "int helperBefore() { return 1; }",
      'const char* label = "main() { not an entry point }";',
      "// int main() { this is a comment }",
      "int solve() { return 2; }",
      "int main(int argc, char** argv) {",
      "  if (argc > 0) { if (argv) { return solve(); } }",
      "  return 0;",
      "}",
      "int helperAfter() { return 3; }",
      "",
    ].join("\n");

    const hidden = hideEntryPoint(source, "cpp");

    expect(hidden).toBeDefined();
    expect(hidden?.visibleCode).toContain("int helperBefore()");
    expect(hidden?.visibleCode).toContain("int solve()");
    expect(hidden?.visibleCode).toContain("int helperAfter()");
    expect(hidden?.visibleCode).not.toContain("\nint main(int argc");
    expect(hidden?.visibleCode).toContain("// int main() { this is a comment }");
    expect(hidden?.hiddenCode).toContain("int main(int argc");
    expect(restoreEntryPoint(hidden!.visibleCode, hidden!.hiddenCode, hidden!.insertionOffset)).toBe(source);
  });

  it("supports C main and leaves JavaScript/TypeScript unchanged without a reliable entry point", () => {
    const cSource = "#include <stdio.h>\nint solve(void) { return 4; }\nint main(void) { printf(\"%d\", solve()); }\n";
    const cHidden = hideEntryPoint(cSource, "c");
    expect(cHidden?.visibleCode).toContain("int solve(void)");
    expect(cHidden?.visibleCode).not.toContain("int main(void)");
    expect(restoreEntryPoint(cHidden!.visibleCode, cHidden!.hiddenCode, cHidden!.insertionOffset)).toBe(cSource);

    const javascript = "function solve() { return 1; }\nconsole.log(solve());\n";
    const typescript = "function solve(): number { return 1; }\nconsole.log(solve());\n";
    expect(hideEntryPoint(javascript, "javascript")).toBeUndefined();
    expect(hideEntryPoint(typescript, "typescript")).toBeUndefined();
  });

  it("hides a Java main method but leaves its class and other methods visible", () => {
    const source = [
      "public class Main {",
      '  String label = "main() { not a method }";',
      "  // public static void main(String[] args) { comment only }",
      "  int solve() { return 7; }",
      "  public static void main(String[] args) {",
      "    if (args.length > 0) { System.out.println(args[0]); }",
      "  }",
      "  int helperAfter() { return 8; }",
      "}",
    ].join("\n");

    const hidden = hideEntryPoint(source, "java");

    expect(hidden).toBeDefined();
    expect(hidden?.visibleCode).toContain("public class Main");
    expect(hidden?.visibleCode).toContain("int solve()");
    expect(hidden?.visibleCode).toContain("int helperAfter()");
    expect(hidden?.visibleCode).not.toContain("\n  public static void main(String[] args)");
    expect(hidden?.visibleCode).toContain("// public static void main(String[] args) { comment only }");
    expect(restoreEntryPoint(hidden!.visibleCode, hidden!.hiddenCode, hidden!.insertionOffset)).toBe(source);
  });

  it("does not alter code when no supported entry point is confidently found", () => {
    const python = 'def solve():\n    return "main()"\n';
    const javaHelperOnly = "class Helper { void main() { work(); } }";

    expect(hideEntryPoint(python, "python")).toBeUndefined();
    expect(hideEntryPoint(javaHelperOnly, "java")).toBeUndefined();
  });

  it("hides only a canonical Python main guard suite and preserves surrounding helpers", () => {
    const source = [
      "def before():",
      "    return 1",
      "",
      "if __name__ == '__main__':",
      "    if before():",
      "        print({\"value\": [1, 2]})",
      "    else:",
      "        print(0)",
      "",
      "def after():",
      "    return 2",
      "",
    ].join("\n");

    const hidden = hideEntryPoint(source, "python3");

    expect(hidden).toBeDefined();
    expect(hidden?.visibleCode).toContain("def before():");
    expect(hidden?.visibleCode).toContain("def after():");
    expect(hidden?.visibleCode).not.toContain("if __name__ == '__main__':");
    expect(hidden?.hiddenCode).toContain("print({\"value\": [1, 2]})");
    expect(restoreEntryPoint(hidden!.visibleCode, hidden!.hiddenCode, hidden!.insertionOffset)).toBe(source);
  });

  it("ignores Python main text in comments, strings, and nested guards", () => {
    const misleading = [
      "# if __name__ == '__main__':",
      "message = \"if __name__ == '__main__':\"",
      "def solve():",
      "    if __name__ == '__main__':",
      "        return 1",
    ].join("\n");
    const ambiguousElse = "if __name__ == '__main__':\n    run()\nelse:\n    fallback()\n";

    expect(hideEntryPoint(misleading, "python")).toBeUndefined();
    expect(hideEntryPoint(ambiguousElse, "python")).toBeUndefined();
  });

  it("recognizes Go main only in a package main source file", () => {
    const source = "package main\nfunc solve() int { return 1 }\nfunc main() { if solve() > 0 { println(1) } }\n";
    const hidden = hideEntryPoint(source, "go");
    expect(hidden?.visibleCode).toContain("func solve()");
    expect(hidden?.visibleCode).not.toContain("func main()");
    expect(restoreEntryPoint(hidden!.visibleCode, hidden!.hiddenCode, hidden!.insertionOffset)).toBe(source);
    expect(hideEntryPoint(source.replace("package main", "package helper"), "go")).toBeUndefined();
  });

  it("keeps the hidden driver at its splice point as visible code changes", () => {
    const previous = "int solve() { return 1; }\nint after() { return 2; }";
    const next = "int solve() { return 123; }\nint after() { return 2; }";
    const insertionOffset = previous.indexOf("\nint after");
    const movedOffset = moveInsertionOffset(previous, next, insertionOffset);

    expect(restoreEntryPoint(next, "int main() { return solve(); }", movedOffset)).toBe(
      "int solve() { return 123; }int main() { return solve(); }\nint after() { return 2; }",
    );
  });

  it("restores the preserved driver exactly once after editing visible code", () => {
    const original = "int solve() { return 1; }\nint main() { return solve(); }\n";
    const editedVisible = "int solve() { return 42; }\n";
    const submitted = updateSourceFromVisibleEditor(original, editedVisible, "cpp");

    expect(submitted).toContain("return 42;");
    expect(submitted.match(/int main\s*\(/g)).toHaveLength(1);
    expect(submitted).toContain("return solve();");
  });
});
