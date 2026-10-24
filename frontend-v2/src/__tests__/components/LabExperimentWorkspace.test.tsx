import React from "react";
import "@testing-library/jest-dom";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { LabExperimentWorkspace } from "@/components/labs/LabExperimentWorkspace";
import { runAPI, submissionAPI } from "@/config/api";

jest.mock("@/config/api", () => ({
  runAPI: { run: jest.fn(), getJob: jest.fn(), runtimes: jest.fn() },
  submissionAPI: { submit: jest.fn(), getResult: jest.fn() },
  studentLabsAPI: { recordProgress: jest.fn() },
}));
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({
    theme: "system",
    resolvedTheme: "dark",
    toggleTheme: jest.fn(),
  }),
}));
jest.mock("@monaco-editor/react", () => ({
  __esModule: true,
  default: ({
    value,
    onChange,
    theme,
  }: {
    value: string;
    onChange: (value: string) => void;
    theme: string;
  }) => (
    <textarea
      aria-label="Source code"
      data-theme={theme}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    variant: _variant,
    size: _size,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: string;
    size?: string;
  }) => <button {...props}>{children}</button>,
}));

const problem = {
  id: "link-one",
  problemMetadataId: "problem-one",
  title: "Sum of Two Numbers",
  difficulty: "Easy",
  maxScore: 5,
  statement: {
    description:
      '<p>Add <strong>two numbers</strong>.</p><script>alert("bad")</script><img src=x onerror="alert(1)">',
    inputFormat: "Two integers",
    outputFormat: "Their sum",
    samples: [{ input: "1 2", output: "3" }],
  },
  config: {
    supportedLanguages: ["c", "cpp", "python3"],
    defaultLanguage: "c",
    starterCode: {
      c: "C starter",
      cpp: "C++ starter",
      python3: "Python starter",
    },
    timeLimit: 2000,
    memoryLimit: 256,
    referenceSolution: { cpp: "private" },
  },
};
let loadWorkspace: jest.Mock;
let recordProgress: jest.Mock;
const runResult = {
  success: true,
  status: "accepted",
  passedCount: 1,
  totalCount: 1,
  results: [{ id: 1, passed: true, output: "3", expected: "3" }],
};

beforeEach(() => {
  jest.clearAllMocks();
  loadWorkspace = jest
    .fn()
    .mockResolvedValue({
      data: {
        lab: { title: "DSA Lab" },
        experiment: { title: "Sliding Window" },
        problems: [
          problem,
          { ...problem, id: "link-two", title: "Second problem" },
        ],
      },
    });
  recordProgress = jest
    .fn()
    .mockResolvedValue({ data: { status: "in_progress" } });
  jest.mocked(runAPI.runtimes).mockResolvedValue({
    data: [
      { language: "c", enabled: true },
      { language: "cpp", enabled: true },
      { language: "python", enabled: true },
    ],
  } as never);
  jest
    .mocked(runAPI.run)
    .mockResolvedValue({
      data: { status: "queued", jobId: "job-one" },
    } as never);
  jest.mocked(runAPI.getJob).mockResolvedValue({ data: runResult } as never);
  jest
    .mocked(submissionAPI.submit)
    .mockResolvedValue({
      data: { status: "queued", submissionId: "submission-one" },
    } as never);
  jest
    .mocked(submissionAPI.getResult)
    .mockResolvedValue({
      data: {
        status: "accepted",
        testResults: runResult.results,
        testCasesPassed: 1,
        totalTestCases: 1,
      },
    } as never);
});

async function open() {
  render(
    <LabExperimentWorkspace
      labId="lab"
      experimentId="experiment"
      backHref="/labs/lab"
      loadWorkspace={loadWorkspace}
      recordProgress={recordProgress}
    />,
  );
  await screen.findByRole("textbox", { name: "Source code" });
}

it("renders stored formatting safely and uses the resolved editor theme", async () => {
  await open();
  await waitFor(() =>
    expect(screen.getByText("two numbers").tagName).toBe("STRONG"),
  );
  expect(screen.getByRole("textbox", { name: "Source code" })).toHaveAttribute(
    "data-theme",
    "vs-dark",
  );
  expect(
    screen.getByRole("heading", { name: "Example 1" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("tabpanel").querySelector("script, img")).toBeNull();
  expect(screen.queryByText('alert("bad")')).not.toBeInTheDocument();
});

it("switches starters with languages and preserves independent language/problem drafts", async () => {
  await open();
  const editor = screen.getByRole("textbox", { name: "Source code" });
  fireEvent.change(editor, { target: { value: "my C draft" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Code language" }), {
    target: { value: "cpp" },
  });
  expect(editor).toHaveValue("C++ starter");
  fireEvent.change(editor, { target: { value: "my C++ draft" } });
  fireEvent.click(screen.getByRole("button", { name: /Second problem/ }));
  expect(editor).toHaveValue("C starter");
  fireEvent.click(screen.getByRole("button", { name: /Sum of Two Numbers/ }));
  expect(editor).toHaveValue("my C draft");
  fireEvent.change(screen.getByRole("combobox", { name: "Code language" }), {
    target: { value: "cpp" },
  });
  expect(editor).toHaveValue("my C++ draft");
});

it("waits for queued execution and displays the final verdict with valid request fields", async () => {
  await open();
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  expect(await screen.findByText("Waiting for a judge")).toBeInTheDocument();
  expect(
    await screen.findByText("Run successful", {}, { timeout: 3000 }),
  ).toBeInTheDocument();
  expect(runAPI.getJob).toHaveBeenCalledWith("job-one");
  const request = jest.mocked(runAPI.run).mock.calls[0][0];
  expect(request.testCases).toEqual([{ id: 1, input: "1 2", expected: "3" }]);
  expect(request.config).not.toHaveProperty("referenceSolution");
  expect(request.config).not.toHaveProperty("supportedLanguages");
  expect(
    within(screen.getByRole("tabpanel")).getByRole("progressbar"),
  ).toHaveAttribute("aria-valuenow", "1");
});

it("keeps edited code and selection after submission and records the real submission ID", async () => {
  await open();
  const editor = screen.getByRole("textbox", { name: "Source code" });
  fireEvent.click(screen.getByRole("button", { name: /Second problem/ }));
  fireEvent.change(editor, { target: { value: "my solution" } });
  recordProgress.mockResolvedValue({ data: { status: "solved", score: 5 } });
  fireEvent.click(screen.getByRole("button", { name: "Submit" }));
  expect(
    await screen.findByRole("heading", { name: "Accepted" }, { timeout: 3000 }),
  ).toBeInTheDocument();
  await waitFor(() =>
    expect(recordProgress).toHaveBeenCalledWith(
      "lab",
      expect.objectContaining({
        experimentProblemId: "link-two",
        submissionId: "submission-one",
        status: "solved",
      }),
    ),
  );
  expect(editor).toHaveValue("my solution");
  expect(
    screen.getByRole("button", { name: /Second problem/ }),
  ).toHaveAttribute("aria-current", "true");
  expect(loadWorkspace).toHaveBeenCalledTimes(1);
});

it("shows an actionable run error and leaves the student's code intact", async () => {
  await open();
  jest
    .mocked(runAPI.run)
    .mockRejectedValueOnce({
      response: { data: { message: "Execution queue is unavailable" } },
    });
  const editor = screen.getByRole("textbox", { name: "Source code" });
  fireEvent.change(editor, { target: { value: "preserved draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Run" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Execution queue is unavailable",
  );
  expect(editor).toHaveValue("preserved draft");
  expect(recordProgress).not.toHaveBeenCalled();
});
