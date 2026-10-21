import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { SUPPORTED_SECTIONS, getStandardizedSectionOptions } from "@/lib/sections";

describe("Section Standardization Across Admin Workflows", () => {
  it("renders all 10 supported sections in student form select dropdown", () => {
    const handleSectionChange = jest.fn();
    const options = getStandardizedSectionOptions();

    render(
      <div>
        <label htmlFor="student-form-section">Section</label>
        <select
          id="student-form-section"
          value=""
          onChange={(e) => handleSectionChange(e.target.value)}
        >
          <option value="">Select Section (Optional)</option>
          {options.map((sec) => (
            <option key={sec} value={sec}>
              Section {sec}
            </option>
          ))}
        </select>
      </div>,
    );

    const select = screen.getByRole("combobox", { name: /section/i }) as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Verify option count and exact order
    const renderedOptions = Array.from(select.options).map((o) => o.value);
    expect(renderedOptions).toEqual([
      "",
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

    // Single-select behavior: change selection to B4
    fireEvent.change(select, { target: { value: "B4" } });
    expect(handleSectionChange).toHaveBeenCalledWith("B4");
  });

  it("preserves legacy section in edit mode while keeping all 10 standard options available", () => {
    const legacySection = "CSE-A";
    const options = getStandardizedSectionOptions([legacySection]);

    render(
      <select id="edit-student-section" defaultValue={legacySection}>
        <option value="">Select Section (Optional)</option>
        {options.map((sec) => (
          <option key={sec} value={sec}>
            Section {sec}
          </option>
        ))}
      </select>,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect(select.value).toBe("CSE-A");

    // All standard sections + legacy section are present
    expect(options).toEqual([
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

  it("verifies section values are stored as actual identifiers, not array indexes", () => {
    SUPPORTED_SECTIONS.forEach((sectionId) => {
      expect(typeof sectionId).toBe("string");
      expect(sectionId).toMatch(/^[A-C][1-4]$/);
      expect(Number.isNaN(Number(sectionId))).toBe(true);
    });
  });
});
