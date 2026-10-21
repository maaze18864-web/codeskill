"use client";

import React, { useState, useRef, useEffect } from "react";

export interface MultiSelectDropdownProps {
  id?: string;
  label: string;
  placeholder: string;
  options: string[];
  selected: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

function yearLabel(year: string) {
  const num = Number(year);
  const suffix =
    num % 10 === 1 && num !== 11
      ? "st"
      : num % 10 === 2 && num !== 12
      ? "nd"
      : num % 10 === 3 && num !== 13
      ? "rd"
      : "th";
  return `${year}${suffix} Year`;
}

export function formatDropdownOptionLabel(label: string, value: string): string {
  if (label === "Year") return yearLabel(value);
  if (label === "Semester") return `Semester ${value}`;
  return value;
}

export function MultiSelectDropdown({
  id,
  label,
  placeholder,
  options,
  selected,
  onChange,
  disabled = false,
}: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSelect = (option: string) => {
    onChange(option);
    setOpen(false);
  };

  const dropdownId =
    id || `dropdown-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div
      ref={containerRef}
      className="relative space-y-1.5"
      data-testid={`dropdown-${label.toLowerCase()}`}
    >
      <label htmlFor={`${dropdownId}-button`} className="text-xs font-semibold">
        {label}
      </label>
      <button
        id={`${dropdownId}-button`}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Choose ${label.toLowerCase()}`}
        onClick={() => setOpen((value) => !value)}
        className="w-full min-h-11 px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm text-left flex items-center justify-between gap-3 disabled:opacity-50 disabled:cursor-not-allowed focus:ring-1 focus:ring-primary"
      >
        <span
          className={
            selected.length
              ? "text-foreground truncate"
              : "text-muted-foreground truncate"
          }
        >
          {selected.length
            ? selected
                .map((value) => formatDropdownOptionLabel(label, value))
                .join(", ")
            : placeholder}
        </span>
        <span aria-hidden="true" className="text-muted-foreground">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open && !disabled && (
        <div
          id={`${dropdownId}-menu`}
          role="listbox"
          aria-multiselectable="true"
          className="absolute z-30 mt-1 w-full max-h-52 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg"
        >
          {options.length ? (
            options.map((option) => (
              <label
                key={option}
                role="option"
                aria-selected={selected.includes(option)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(option);
                  }
                }}
                onClick={(e) => {
                  e.preventDefault();
                  handleSelect(option);
                }}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(option)}
                  readOnly
                  tabIndex={-1}
                  className="rounded text-primary focus:ring-primary pointer-events-none"
                />
                <span>{formatDropdownOptionLabel(label, option)}</span>
              </label>
            ))
          ) : (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">
              No {label.toLowerCase()} options available.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
