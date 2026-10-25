import "@testing-library/jest-dom";
import { useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { ProjectPreviewFrame } from "@/components/projects/ProjectPreviewFrame";
import { useProjectConsole } from "@/hooks/useProjectConsole";

const previewUrl = "http://localhost:5081/p/test/";
function Workspace({
  visible,
  generation = 0,
  ready = true,
}: {
  visible: boolean;
  generation?: number;
  ready?: boolean;
}) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const output = useProjectConsole(
    frame,
    ready ? previewUrl : null,
    generation,
  );
  return (
    <>
      <ProjectPreviewFrame
        frameRef={frame}
        url={ready ? previewUrl : null}
        generation={generation}
        visible={visible}
        busy={false}
      />
      <div role="log">
        {output.entries.map((entry) => entry.text).join("\n")}
      </div>
    </>
  );
}
function log(frame: HTMLIFrameElement, text: string) {
  act(() =>
    window.dispatchEvent(
      new MessageEvent("message", {
        source: frame.contentWindow,
        origin: new URL(previewUrl).origin,
        data: {
          channel: "codeskill:project-console",
          level: "log",
          args: [text],
        },
      }),
    ),
  );
}
describe("Persistent project preview", () => {
  it("continues receiving console messages while another output tab is open", () => {
    const { rerender } = render(<Workspace visible />);
    const frame = screen.getByTitle(
      "Project live preview",
    ) as HTMLIFrameElement;
    const window = frame.contentWindow;
    log(frame, "before switching tabs");
    rerender(<Workspace visible={false} />);
    expect(frame).not.toBeVisible();
    expect(frame.contentWindow).toBe(window);
    log(frame, "background timer message");
    expect(screen.getByRole("log")).toHaveTextContent(
      "background timer message",
    );
    rerender(<Workspace visible />);
    expect(screen.getByTitle("Project live preview")).toBe(frame);
    expect(frame).toBeVisible();
    expect(screen.getByRole("log")).toHaveTextContent("before switching tabs");
  });
  it("refreshes only when requested and stops the frame with the runtime", () => {
    const { rerender } = render(<Workspace visible />);
    const frame = screen.getByTitle(
      "Project live preview",
    ) as HTMLIFrameElement;
    log(frame, "previous run");
    expect(frame).toHaveAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-modals allow-downloads",
    );
    rerender(<Workspace visible generation={1} />);
    expect(screen.getByTitle("Project live preview")).not.toBe(frame);
    expect(screen.getByRole("log")).toBeEmptyDOMElement();
    rerender(<Workspace visible ready={false} />);
    expect(screen.queryByTitle("Project live preview")).toBeNull();
  });
});
