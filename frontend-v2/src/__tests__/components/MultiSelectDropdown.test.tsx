import React, { useState } from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, within } from "@testing-library/react";
import {
  MultiSelectDropdown,
  formatDropdownOptionLabel,
} from "@/components/ui/MultiSelectDropdown";
import {
  SUPPORTED_SECTIONS,
  getStandardizedSectionOptions,
  isSupportedSection,
} from "@/lib/sections";

describe("MultiSelectDropdown Component & Section Standardization", () => {
  it("formats dropdown option labels correctly for Year, Semester, and Sections", () => {
    expect(formatDropdownOptionLabel("Year", "1")).toBe("1st Year");
    expect(formatDropdownOptionLabel("Year", "2")).toBe("2nd Year");
    expect(formatDropdownOptionLabel("Year", "3")).toBe("3rd Year");
    expect(formatDropdownOptionLabel("Year", "4")).toBe("4th Year");
    expect(formatDropdownOptionLabel("Semester", "1")).toBe("Semester 1");
    expect(formatDropdownOptionLabel("Semester", "6")).toBe("Semester 6");
    expect(formatDropdownOptionLabel("Section", "A1")).toBe("A1");
    expect(formatDropdownOptionLabel("Section", "B4")).toBe("B4");
  });

  it("verifies the 10 supported sections in the exact required order", () => {
    expect(SUPPORTED_SECTIONS).toEqual([
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
      "B4",
      "C1",
      "C2",
      "C3",
    ]);
    expect(isSupportedSection("A1")).toBe(true);
    expect(isSupportedSection("B4")).toBe(true);
    expect(isSupportedSection("C3")).toBe(true);
    expect(isSupportedSection("D1")).toBe(false);
    expect(isSupportedSection("random")).toBe(false);
  });

  it("getStandardizedSectionOptions produces all 10 options exactly once and preserves legacy values", () => {
    const defaultOptions = getStandardizedSectionOptions();
    expect(defaultOptions).toEqual([
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
      "B4",
      "C1",
      "C2",
      "C3",
    ]);

    const withLegacy = getStandardizedSectionOptions(["CSE-A", "B2"]);
    expect(withLegacy).toEqual([
      "A1",
      "A2",
      "A3",
      "B1",
      "B2",
      "B3",
      "B4",
      "C1",
      "C2",
      "C3",
      "CSE-A",
    ]);
  });

  it("closes the dropdown immediately when selecting a Year option and keeps selected value visible", () => {
    const handleChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        label="Year"
        placeholder="Choose student year(s)"
        options={["1", "2", "3", "4"]}
        selected={[]}
        onChange={handleChange}
      />,
    );

    const triggerButton = screen.getByRole("button", { name: /choose year/i });
    expect(triggerButton).toHaveTextContent("Choose student year(s)");
    expect(triggerButton).toHaveAttribute("aria-expanded", "false");

    // Open dropdown
    fireEvent.click(triggerButton);
    expect(triggerButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Select "1st Year" (option "1")
    const option1 = screen.getByText("1st Year");
    fireEvent.click(option1);

    // Verify onChange called with "1"
    expect(handleChange).toHaveBeenCalledWith("1");

    // Re-render with updated selected state
    rerender(
      <MultiSelectDropdown
        label="Year"
        placeholder="Choose student year(s)"
        options={["1", "2", "3", "4"]}
        selected={["1"]}
        onChange={handleChange}
      />,
    );

    // Dropdown is closed immediately
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose year/i })).toHaveTextContent("1st Year");
  });

  it("closes the dropdown immediately when selecting a Semester option", () => {
    const handleChange = jest.fn();
    const { rerender } = render(
      <MultiSelectDropdown
        label="Semester"
        placeholder="Choose semester(s)"
        options={["1", "2", "3", "4", "5", "6", "7", "8"]}
        selected={[]}
        onChange={handleChange}
      />,
    );

    const triggerButton = screen.getByRole("button", { name: /choose semester/i });
    fireEvent.click(triggerButton);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Select Semester 4
    fireEvent.click(screen.getByText("Semester 4"));
    expect(handleChange).toHaveBeenCalledWith("4");

    // Re-render with selected
    rerender(
      <MultiSelectDropdown
        label="Semester"
        placeholder="Choose semester(s)"
        options={["1", "2", "3", "4", "5", "6", "7", "8"]}
        selected={["4"]}
        onChange={handleChange}
      />,
    );

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose semester/i })).toHaveTextContent("Semester 4");
  });

  it("allows reopening dropdown, preserves previous multi-select items, and selects another item", () => {
    function ControlledTestComponent() {
      const [selected, setSelected] = useState<string[]>(["A1"]);
      const options = getStandardizedSectionOptions();
      const toggle = (val: string) => {
        setSelected((curr) =>
          curr.includes(val) ? curr.filter((v) => v !== val) : [...curr, val],
        );
      };
      return (
        <MultiSelectDropdown
          label="Section"
          placeholder="Choose section(s)"
          options={options}
          selected={selected}
          onChange={toggle}
        />
      );
    }

    render(<ControlledTestComponent />);

    const triggerButton = screen.getByRole("button", { name: /choose section/i });
    expect(triggerButton).toHaveTextContent("A1");

    // Open dropdown
    fireEvent.click(triggerButton);
    const listbox = screen.getByRole("listbox");
    expect(listbox).toBeInTheDocument();

    // Verify all 10 options are rendered inside the listbox
    SUPPORTED_SECTIONS.forEach((sec) => {
      expect(within(listbox).getByText(sec)).toBeInTheDocument();
    });

    // Select B4
    fireEvent.click(within(listbox).getByText("B4"));

    // Menu closes immediately after selection
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Both A1 and B4 are selected and visible
    expect(triggerButton).toHaveTextContent("A1, B4");

    // Reopen dropdown
    fireEvent.click(triggerButton);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Unselect A1
    fireEvent.click(within(screen.getByRole("listbox")).getByText("A1"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(triggerButton).toHaveTextContent("B4");
  });

  it("closes dropdown on Escape key and on clicking outside", () => {
    render(
      <div>
        <div data-testid="outside">Outside Element</div>
        <MultiSelectDropdown
          label="Semester"
          placeholder="Choose semester"
          options={["1", "2"]}
          selected={[]}
          onChange={jest.fn()}
        />
      </div>,
    );

    const triggerButton = screen.getByRole("button", { name: /choose semester/i });

    // Open dropdown
    fireEvent.click(triggerButton);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Reopen and click outside
    fireEvent.click(triggerButton);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("supports keyboard selection with Enter key and closes dropdown", () => {
    const handleChange = jest.fn();
    render(
      <MultiSelectDropdown
        label="Section"
        placeholder="Choose section"
        options={["A1", "A2"]}
        selected={[]}
        onChange={handleChange}
      />,
    );

    const triggerButton = screen.getByRole("button", { name: /choose section/i });
    fireEvent.click(triggerButton);

    const optionA1 = screen.getByRole("option", { name: "A1" });
    fireEvent.keyDown(optionA1, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith("A1");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
