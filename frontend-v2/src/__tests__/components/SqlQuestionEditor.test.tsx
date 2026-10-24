import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SqlQuestionEditor } from "@/components/sql/SqlQuestionEditor";
import type { SqlPublicProblem, SqlFeedback } from "@/lib/sql-workspace";
jest.mock(
  "next/dynamic",
  () => () =>
    function Editor({
      value,
      onChange,
    }: {
      value: string;
      onChange: (value: string) => void;
    }) {
      return (
        <textarea
          aria-label="SQL editor"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    },
);
jest.mock("@/context/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));
const problem: SqlPublicProblem = {
  title: "List names",
  description: "Return names.",
  schemaSql: "CREATE TABLE students(name TEXT);",
  starterCode: "SELECT name FROM students;",
  orderMatters: true,
  samples: [
    {
      seedSql: "INSERT INTO students VALUES ('Ada');",
      expected: { columns: ["name"], rows: [["Ada"]] },
    },
  ],
};
const result: SqlFeedback = {
  status: "accepted",
  passedCount: 2,
  totalCount: 2,
  time: 0.01,
  results: [
    {
      id: 1,
      passed: true,
      isHidden: false,
      columns: ["name"],
      rows: [["Ada"]],
    },
    {
      id: 2,
      passed: true,
      isHidden: true,
      columns: ["secret"],
      rows: [["HIDDEN_VALUE"]],
    },
  ],
};
it("shows a SQL editor, schema, examples, and tabular run results", async () => {
  const execute = jest.fn().mockResolvedValue(result);
  render(<SqlQuestionEditor problem={problem} marks={10} execute={execute} />);
  expect(screen.getByRole("textbox", { name: "SQL editor" })).toHaveValue(
    problem.starterCode,
  );
  fireEvent.click(screen.getByRole("button", { name: "Run", exact: true }));
  await waitFor(() =>
    expect(execute).toHaveBeenCalledWith(problem.starterCode, false),
  );
  expect(await screen.findByText("2 / 2 datasets passed")).toBeVisible();
  expect(screen.queryByText("HIDDEN_VALUE")).not.toBeInTheDocument();
});
it("saves the typed draft and invokes verified submission with server results", async () => {
  const onDraftChange = jest.fn(),
    onVerified = jest.fn();
  render(
    <SqlQuestionEditor
      problem={problem}
      initialCode="SELECT 1;"
      marks={10}
      execute={jest.fn().mockResolvedValue(result)}
      onDraftChange={onDraftChange}
      onVerified={onVerified}
    />,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "SQL editor" }), {
    target: { value: "SELECT name FROM students ORDER BY name;" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Submit solution" }));
  await waitFor(() =>
    expect(onVerified).toHaveBeenCalledWith(
      "SELECT name FROM students ORDER BY name;",
      result,
    ),
  );
  expect(onDraftChange).toHaveBeenCalled();
});
it("preserves code and shows a useful execution error", async () => {
  render(
    <SqlQuestionEditor
      problem={problem}
      marks={10}
      execute={jest
        .fn()
        .mockRejectedValue({
          response: { data: { message: "SQL execution is busy" } },
        })}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Run", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "SQL execution is busy",
  );
  expect(screen.getByRole("textbox", { name: "SQL editor" })).toHaveValue(
    problem.starterCode,
  );
});
