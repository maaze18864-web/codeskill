import { canonicalEditorLanguage } from "@/lib/editor-languages";

interface Token {
  value: string;
  start: number;
  end: number;
}

export interface HiddenEntryPoint {
  visibleCode: string;
  hiddenCode: string;
  insertionOffset: number;
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (char === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index < 0) break;
      continue;
    }
    if (char === "/" && source[index + 1] === "*") {
      const close = source.indexOf("*/", index + 2);
      index = close < 0 ? source.length : close + 2;
      continue;
    }
    if (char === "#" && source.slice(source.lastIndexOf("\n", index - 1) + 1, index).trim() === "") {
      const newline = source.indexOf("\n", index + 1);
      index = newline < 0 ? source.length : newline + 1;
      continue;
    }

    // C++ raw strings and Java text blocks may contain braces and fake signatures.
    const rawString = source.slice(index).match(/^(?:u8|u|U|L)?R"([^ ()\\\t\r\n]{0,16})\(/);
    if (rawString) {
      const terminator = `)${rawString[1]}"`;
      const close = source.indexOf(terminator, index + rawString[0].length);
      index = close < 0 ? source.length : close + terminator.length;
      continue;
    }
    if (source.startsWith('"""', index)) {
      const close = source.indexOf('"""', index + 3);
      index = close < 0 ? source.length : close + 3;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      const quote = char;
      index += 1;
      while (index < source.length) {
        if (source[index] === "\\") {
          index += 2;
        } else if (source[index] === quote) {
          index += 1;
          break;
        } else {
          index += 1;
        }
      }
      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      const start = index;
      index += 1;
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index])) index += 1;
      tokens.push({ value: source.slice(start, index), start, end: index });
      continue;
    }

    tokens.push({ value: char, start: index, end: index + 1 });
    index += 1;
  }

  return tokens;
}

function matchingToken(tokens: Token[], start: number, open: string, close: string): number | undefined {
  if (tokens[start]?.value !== open) return undefined;
  let depth = 0;
  for (let index = start; index < tokens.length; index += 1) {
    if (tokens[index].value === open) depth += 1;
    if (tokens[index].value === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return undefined;
}

function braceDepth(tokens: Token[], before: number): number {
  let depth = 0;
  for (let index = 0; index < before; index += 1) {
    if (tokens[index].value === "{") depth += 1;
    if (tokens[index].value === "}") depth -= 1;
  }
  return depth;
}

function findCEntryPoint(tokens: Token[]): [number, number] | undefined {
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index].value !== "main" || tokens[index - 1].value !== "int") continue;
    if (braceDepth(tokens, index) !== 0 || tokens[index + 1]?.value !== "(") continue;
    const closeParameters = matchingToken(tokens, index + 1, "(", ")");
    if (closeParameters === undefined || tokens[closeParameters + 1]?.value !== "{") continue;
    const closeBody = matchingToken(tokens, closeParameters + 1, "{", "}");
    if (closeBody !== undefined) return [index - 1, closeBody];
  }
  return undefined;
}

function findJavaEntryPoint(tokens: Token[]): [number, number] | undefined {
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index].value !== "main" || tokens[index - 1].value !== "void") continue;
    if (braceDepth(tokens, index) !== 1 || tokens[index + 1]?.value !== "(") continue;

    let declarationStart = index - 1;
    let hasStatic = false;
    while (declarationStart > 0 && ![";", "{", "}"].includes(tokens[declarationStart - 1].value)) {
      declarationStart -= 1;
      if (tokens[declarationStart].value === "static") hasStatic = true;
    }
    if (!hasStatic) continue;

    const closeParameters = matchingToken(tokens, index + 1, "(", ")");
    if (closeParameters === undefined) continue;
    const parameters = tokens.slice(index + 2, closeParameters).map((token) => token.value);
    const hasStringArray = parameters.some((value, parameterIndex) =>
      value === "String" && (
        (parameters[parameterIndex + 1] === "[" && parameters[parameterIndex + 2] === "]") ||
        (parameters[parameterIndex + 1] === "." &&
          parameters[parameterIndex + 2] === "." &&
          parameters[parameterIndex + 3] === ".")
      ),
    );
    if (!hasStringArray) continue;
    let bodyStart = closeParameters + 1;
    while (bodyStart < tokens.length && !["{", ";", "}"].includes(tokens[bodyStart].value)) bodyStart += 1;
    if (tokens[bodyStart]?.value !== "{") continue;

    const closeBody = matchingToken(tokens, bodyStart, "{", "}");
    if (closeBody !== undefined) return [declarationStart, closeBody];
  }
  return undefined;
}

function findGoEntryPoint(tokens: Token[]): [number, number] | undefined {
  if (tokens[0]?.value !== "package" || tokens[1]?.value !== "main") return undefined;
  for (let index = 2; index < tokens.length; index += 1) {
    if (tokens[index].value !== "func" || tokens[index + 1]?.value !== "main") continue;
    if (braceDepth(tokens, index) !== 0 || tokens[index + 2]?.value !== "(") continue;
    const closeParameters = matchingToken(tokens, index + 2, "(", ")");
    if (closeParameters === undefined || tokens[closeParameters + 1]?.value !== "{") continue;
    const closeBody = matchingToken(tokens, closeParameters + 1, "{", "}");
    if (closeBody !== undefined) return [index, closeBody];
  }
  return undefined;
}

interface PythonToken extends Token {
  kind: "identifier" | "string" | "punctuation";
  line: number;
  column: number;
}

/**
 * Python has no main function syntax. The canonical `__main__` guard is its
 * reliable entry point, so recognize only a top-level guard with an indented
 * suite. Tokenizing strings/comments first prevents examples in either from
 * being mistaken for executable code.
 */
function tokenizePython(source: string): PythonToken[][] {
  const lines: PythonToken[][] = [];
  let currentLine: PythonToken[] = [];
  let index = 0;
  let line = 0;
  let lineStart = 0;
  const pushLine = () => {
    lines.push(currentLine);
    currentLine = [];
    line += 1;
  };

  while (index < source.length) {
    const char = source[index];
    if (char === "\n") {
      pushLine();
      index += 1;
      lineStart = index;
      continue;
    }
    if (char === "\r" || char === " " || char === "\t" || char === "\f") {
      index += 1;
      continue;
    }
    if (char === "#") {
      const newline = source.indexOf("\n", index);
      index = newline < 0 ? source.length : newline;
      continue;
    }

    const start = index;
    const column = index - lineStart;
    if (char === "'" || char === '"') {
      const quote = char;
      const triple = source.startsWith(quote.repeat(3), index);
      const delimiter = triple ? quote.repeat(3) : quote;
      index += delimiter.length;
      let value = "";
      let plain = true;
      while (index < source.length) {
        if (source[index] === "\\") {
          plain = false;
          index += 2;
          continue;
        }
        if (source.startsWith(delimiter, index)) {
          index += delimiter.length;
          break;
        }
        if (source[index] === "\n") {
          if (!triple) break;
          pushLine();
          index += 1;
          lineStart = index;
          value += "\n";
          continue;
        }
        value += source[index];
        index += 1;
      }
      currentLine.push({
        value: plain ? value : "",
        start,
        end: index,
        kind: "string",
        line,
        column,
      });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      index += 1;
      while (index < source.length && /[A-Za-z0-9_]/.test(source[index])) index += 1;
      currentLine.push({ value: source.slice(start, index), start, end: index, kind: "identifier", line, column });
      continue;
    }

    const twoCharacterOperator = source.slice(index, index + 2);
    if (["==", "!=", "<=", ">=", ":=", "->", "**", "//", "<<", ">>"].includes(twoCharacterOperator)) {
      index += 2;
      currentLine.push({ value: twoCharacterOperator, start, end: index, kind: "punctuation", line, column });
      continue;
    }
    index += 1;
    currentLine.push({ value: char, start, end: index, kind: "punctuation", line, column });
  }
  if (currentLine.length || !lines.length || source.endsWith("\n")) lines.push(currentLine);
  return lines;
}

function findPythonEntryPoint(source: string): [number, number] | undefined {
  const lines = tokenizePython(source);
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const tokens = lines[lineIndex];
    if (tokens.length !== 5 || tokens[0].column !== 0) continue;
    const isCanonicalGuard = tokens[0].value === "if" && (
      (tokens[1].value === "__name__" && tokens[2].value === "==" && tokens[3].kind === "string" && tokens[3].value === "__main__") ||
      (tokens[1].kind === "string" && tokens[1].value === "__main__" && tokens[2].value === "==" && tokens[3].value === "__name__")
    ) && tokens[4].value === ":";
    if (!isCanonicalGuard) continue;

    let firstBodyLine = lineIndex + 1;
    while (firstBodyLine < lines.length && lines[firstBodyLine].length === 0) firstBodyLine += 1;
    if (firstBodyLine === lines.length || lines[firstBodyLine][0].column === 0) continue;

    let endLine = firstBodyLine + 1;
    while (endLine < lines.length) {
      const nextTokens = lines[endLine];
      if (nextTokens.length && nextTokens[0].column === 0) break;
      endLine += 1;
    }
    const following = lines[endLine];
    // An `else`/`elif` must stay attached to its guard, so leave ambiguous
    // suites untouched rather than hiding only half of the driver.
    if (following?.[0]?.value === "else" || following?.[0]?.value === "elif") continue;

    const start = source.lastIndexOf("\n", tokens[0].start - 1) + 1;
    const end = endLine < lines.length && lines[endLine].length
      ? source.lastIndexOf("\n", lines[endLine][0].start - 1) + 1
      : source.length;
    return [start, end];
  }
  return undefined;
}

/** Hide only confidently recognized entry-point functions; all other source is unchanged. */
export function hideEntryPoint(source: string, language: string): HiddenEntryPoint | undefined {
  const tokens = tokenize(source);
  const canonical = canonicalEditorLanguage(language);
  const range = canonical === "cpp" || canonical === "c"
    ? findCEntryPoint(tokens)
    : canonical === "java"
      ? findJavaEntryPoint(tokens)
      : canonical === "go"
        ? findGoEntryPoint(tokens)
        : canonical === "python"
          ? findPythonEntryPoint(source)
        : undefined;

  if (!range) return undefined;
  const [startToken, endToken] = range;
  const start = canonical === "python" ? startToken : tokens[startToken].start;
  const end = canonical === "python" ? endToken : tokens[endToken].end;
  return {
    visibleCode: source.slice(0, start) + source.slice(end),
    hiddenCode: source.slice(start, end),
    insertionOffset: start,
  };
}

export function restoreEntryPoint(
  visibleCode: string,
  hiddenCode: string,
  insertionOffset: number,
): string {
  const offset = Math.max(0, Math.min(insertionOffset, visibleCode.length));
  return visibleCode.slice(0, offset) + hiddenCode + visibleCode.slice(offset);
}

/** Convert a visible-editor change back to the full source sent to execution. */
export function updateSourceFromVisibleEditor(
  previousSource: string,
  nextVisibleCode: string,
  language: string,
): string {
  const hidden = hideEntryPoint(previousSource, language);
  if (!hidden) return nextVisibleCode;
  const offset = moveInsertionOffset(hidden.visibleCode, nextVisibleCode, hidden.insertionOffset);
  return restoreEntryPoint(nextVisibleCode, hidden.hiddenCode, offset);
}

/** Keep the hidden-driver splice point stable as text is edited around it. */
export function moveInsertionOffset(previous: string, next: string, offset: number): number {
  let prefix = 0;
  while (prefix < previous.length && prefix < next.length && previous[prefix] === next[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < previous.length - prefix &&
    suffix < next.length - prefix &&
    previous[previous.length - suffix - 1] === next[next.length - suffix - 1]
  ) suffix += 1;

  const previousEnd = previous.length - suffix;
  const nextEnd = next.length - suffix;
  if (previousEnd <= offset) return Math.max(0, offset + nextEnd - previousEnd);
  if (prefix >= offset) return offset;
  return nextEnd;
}
