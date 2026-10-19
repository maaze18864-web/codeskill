import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { VTable3, getQuestionRowKey } from "@/components/ui/v-table-3";

describe("VTable3 Stable Row Keys & Lifecycle (AUD-051)", () => {
  beforeEach(() => {
    window.matchMedia = jest.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));
  });

  describe("getQuestionRowKey deterministic key resolution", () => {
    it("returns explicit id when present", () => {
      expect(getQuestionRowKey({ id: "q-uuid-1", title: "Two Sum" })).toBe("q-uuid-1");
    });

    it("returns _id when present", () => {
      expect(getQuestionRowKey({ _id: "mongo-obj-id-1", title: "Two Sum" })).toBe("mongo-obj-id-1");
    });

    it("returns mongoId when id and _id are absent", () => {
      expect(getQuestionRowKey({ mongoId: "legacy-mongo-1", title: "Two Sum" })).toBe("legacy-mongo-1");
    });

    it("returns slug prefixed key when no database id is present", () => {
      expect(getQuestionRowKey({ slug: "reverse-linked-list", title: "Reverse" })).toBe("slug-reverse-linked-list");
    });

    it("assigns stable fallback key for an object without any id or slug across multiple calls", () => {
      const draftQuestion = { question: "What is React reconciliation?", questionType: "MCQ" };
      const key1 = getQuestionRowKey(draftQuestion);
      const key2 = getQuestionRowKey(draftQuestion);
      const key3 = getQuestionRowKey(draftQuestion);

      expect(key1).toMatch(/^question-fallback-\d+$/);
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });

    it("assigns unique, distinct fallback keys to different objects without ids", () => {
      const q1 = { question: "Q1" };
      const q2 = { question: "Q2" };
      const q3 = { question: "Q3" };

      const key1 = getQuestionRowKey(q1);
      const key2 = getQuestionRowKey(q2);
      const key3 = getQuestionRowKey(q3);

      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
      expect(key1).not.toBe(key3);
    });

    it("safely handles null, undefined, and non-object inputs", () => {
      expect(getQuestionRowKey(null)).toBe("");
      expect(getQuestionRowKey(undefined)).toBe("");
      expect(getQuestionRowKey("not an object")).toBe("");
    });
  });

  describe("Table rendering, DOM stability, and lifecycle", () => {
    const defaultProps = {
      loading: false,
      search: "",
      onSearchChange: jest.fn(),
      selectedTopic: "",
      onTopicChange: jest.fn(),
      selectedDifficulty: "",
      onDifficultyChange: jest.fn(),
      selectedType: "",
      onTypeChange: jest.fn(),
      selectedStatus: "",
      onStatusChange: jest.fn(),
      topicsList: [{ topic: "Arrays", total: 10 }],
      onSearchSubmit: jest.fn(),
      onClearFilters: jest.fn(),
      page: 1,
      totalPages: 3,
      onPageChange: jest.fn(),
      onView: jest.fn(),
      onEdit: jest.fn(),
      onApprove: jest.fn(),
      onReject: jest.fn(),
      onDelete: jest.fn(),
      selectedQuestionIds: [] as string[],
      onToggleQuestion: jest.fn(),
      onTogglePage: jest.fn(),
      onClearSelection: jest.fn(),
      onBulkDelete: jest.fn(),
      deletingQuestions: false,
    };

    it("renders rows with valid IDs and does not emit React duplicate key warnings", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      const questions = [
        { id: "q1", title: "Question 1", question: "Q1 details", difficulty: "easy", questionType: "MCQ" },
        { id: "q2", title: "Question 2", question: "Q2 details", difficulty: "medium", questionType: "MCQ" },
        { id: "q3", title: "Question 3", question: "Q3 details", difficulty: "hard", questionType: "MCQ" },
      ];

      render(<VTable3 {...defaultProps} questions={questions} />);

      expect(screen.getByText("Question 1")).toBeInTheDocument();
      expect(screen.getByText("Question 2")).toBeInTheDocument();
      expect(screen.getByText("Question 3")).toBeInTheDocument();

      const keyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === "string" && arg.includes("key"))
      );
      expect(keyWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it("handles rows with missing or duplicate identifiers gracefully without duplicate key errors", () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      // Deliberately include items with missing IDs and duplicate IDs
      const questionsWithDuplicates = [
        { id: "duplicate-id", title: "First Duplicate", questionType: "MCQ" },
        { id: "duplicate-id", title: "Second Duplicate", questionType: "MCQ" },
        { title: "No ID A", questionType: "MCQ" },
        { title: "No ID B", questionType: "MCQ" },
      ];

      render(<VTable3 {...defaultProps} questions={questionsWithDuplicates} />);

      expect(screen.getByText("First Duplicate")).toBeInTheDocument();
      expect(screen.getByText("Second Duplicate")).toBeInTheDocument();
      expect(screen.getByText("No ID A")).toBeInTheDocument();
      expect(screen.getByText("No ID B")).toBeInTheDocument();

      const keyWarnings = consoleErrorSpy.mock.calls.filter((call) =>
        call.some((arg) => typeof arg === "string" && (arg.includes("Encountered two children with the same key") || arg.includes('unique "key" prop')))
      );
      expect(keyWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it("preserves row DOM elements and avoids unmounting/remounting across re-renders", () => {
      const questions = [
        { id: "stable-q-1", title: "Stable Question 1", questionType: "MCQ" },
        { title: "Draft Question Without ID", questionType: "MCQ" },
      ];

      const { container, rerender } = render(<VTable3 {...defaultProps} questions={questions} search="" />);

      const initialRows = container.querySelectorAll(".question-row");
      expect(initialRows).toHaveLength(2);
      const firstRowBefore = initialRows[0];
      const secondRowBefore = initialRows[1];

      // Re-render with an unrelated prop change (e.g. search term changed or page prop updated)
      rerender(<VTable3 {...defaultProps} questions={questions} search="updated-search" />);

      const updatedRows = container.querySelectorAll(".question-row");
      expect(updatedRows).toHaveLength(2);

      // DOM nodes MUST be preserved (identical object reference in DOM tree)
      expect(updatedRows[0]).toBe(firstRowBefore);
      expect(updatedRows[1]).toBe(secondRowBefore);
    });

    it("preserves input focus across re-renders in selection mode", () => {
      const questions = [
        { id: "focus-q-1", title: "Question Focus 1", questionType: "MCQ" },
        { title: "Draft Question 2", questionType: "MCQ" },
      ];

      const { rerender } = render(<VTable3 {...defaultProps} questions={questions} />);

      // Enable selection mode
      const selectBtn = screen.getByRole("button", { name: "Select" });
      fireEvent.click(selectBtn);

      const checkboxes = screen.getAllByRole("checkbox");
      // First is "Select all on this page", next are the rows
      const firstRowCheckbox = checkboxes[1];
      firstRowCheckbox.focus();
      expect(document.activeElement).toBe(firstRowCheckbox);

      // Re-render with updated unrelated state (e.g. search prop)
      rerender(<VTable3 {...defaultProps} questions={questions} search="typing..." />);

      // Focus must not be lost to document.body
      expect(document.activeElement).toBe(firstRowCheckbox);
    });

    it("allows selecting individual questions and toggles selection callback with correct ID", () => {
      const onToggleQuestion = jest.fn();
      const questions = [
        { id: "q-toggle-1", title: "Selectable Question", questionType: "MCQ" },
      ];

      render(<VTable3 {...defaultProps} questions={questions} onToggleQuestion={onToggleQuestion} />);

      // Open selection mode
      fireEvent.click(screen.getByRole("button", { name: "Select" }));

      const rowCheckbox = screen.getByRole("checkbox", { name: "Select Selectable Question" });
      fireEvent.click(rowCheckbox);

      expect(onToggleQuestion).toHaveBeenCalledWith("q-toggle-1");
    });

    it("renders empty state and clear filters button correctly", () => {
      const onClearFilters = jest.fn();
      render(
        <VTable3
          {...defaultProps}
          questions={[]}
          search="something non-existent"
          onClearFilters={onClearFilters}
        />
      );

      expect(screen.getByText("No matching questions")).toBeInTheDocument();
      const clearBtn = screen.getByRole("button", { name: "Clear Filters" });
      fireEvent.click(clearBtn);
      expect(onClearFilters).toHaveBeenCalled();
    });

    it("supports pagination controls", () => {
      const onPageChange = jest.fn();
      const questions = [{ id: "page-q", title: "Page Question", questionType: "MCQ" }];

      render(
        <VTable3
          {...defaultProps}
          questions={questions}
          page={2}
          totalPages={5}
          onPageChange={onPageChange}
        />
      );

      const prevBtn = screen.getByRole("button", { name: "Previous" });
      const nextBtn = screen.getByRole("button", { name: "Next" });

      fireEvent.click(prevBtn);
      expect(onPageChange).toHaveBeenCalledWith(1);

      fireEvent.click(nextBtn);
      expect(onPageChange).toHaveBeenCalledWith(3);
    });
  });
});
