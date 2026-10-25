import { act, renderHook } from "@testing-library/react";
import { useProjectConsole } from "@/hooks/useProjectConsole";

describe("Project browser console transport", () => {
  let frame: { current: HTMLIFrameElement | null };
  const origin = "http://localhost:5084";
  beforeEach(() => {
    frame = { current: document.createElement("iframe") };
    document.body.appendChild(frame.current!);
  });
  afterEach(() => {
    frame.current?.remove();
    jest.restoreAllMocks();
  });
  const emit = (data: unknown, options: Partial<MessageEventInit> = {}) => {
    act(() =>
      window.dispatchEvent(
        new MessageEvent("message", {
          origin,
          source: frame.current!.contentWindow,
          data,
          ...options,
        }),
      ),
    );
  };
  const message = (text: string) => ({
    channel: "codeskill:project-console",
    level: "log",
    args: [text],
  });

  it("accepts only the active preview window, exact origin, and bounded text payloads", () => {
    const { result } = renderHook(() =>
      useProjectConsole(frame, `${origin}/p/test/`, 0),
    );
    emit(message("foreign origin"), { origin: "https://other.example" });
    emit(message("foreign window"), { source: window });
    emit({ ...message("wrong channel"), channel: "other" });
    emit({ ...message("wrong level"), level: "execute" });
    emit({ ...message("not text"), args: [{ html: "<script>" }] });
    emit(message("x".repeat(4001)));
    expect(result.current.entries).toHaveLength(0);
    emit(message("<img onerror=alert(1)>"));
    expect(result.current.entries[0].text).toBe("<img onerror=alert(1)>");
  });

  it("retains only the latest 200 records, supports clear, and resets on preview refresh", () => {
    let now = 10000;
    jest.spyOn(Date, "now").mockImplementation(() => (now += 100));
    const { result, rerender } = renderHook(
      ({ generation }) =>
        useProjectConsole(frame, `${origin}/p/test/`, generation),
      { initialProps: { generation: 0 } },
    );
    for (let i = 0; i < 210; i++) emit(message(`Log ${i}`));
    expect(result.current.entries).toHaveLength(200);
    expect(result.current.entries[0].text).toBe("Log 10");
    emit({ channel: "codeskill:project-console", level: "clear", args: [] });
    expect(result.current.entries).toHaveLength(0);
    emit(message("before refresh"));
    rerender({ generation: 1 });
    expect(result.current.entries).toHaveLength(0);
  });

  it("limits message floods and removes its listener on unmount", () => {
    const remove = jest.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() =>
      useProjectConsole(frame, `${origin}/p/test/`, 0),
    );
    for (let i = 0; i < 80; i++) emit(message("flood"));
    expect(result.current.entries).toHaveLength(50);
    unmount();
    expect(remove).toHaveBeenCalledWith("message", expect.any(Function));
  });
});
