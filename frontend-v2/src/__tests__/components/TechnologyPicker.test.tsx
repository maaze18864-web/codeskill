import "@testing-library/jest-dom";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  TechnologyPicker,
  TechnologySummary,
} from "@/components/projects/TechnologyPicker";
const stacks = [
  { id: "react", name: "React", description: "Components and hooks." },
  { id: "nextjs", name: "Next.js", description: "Pages and API routes." },
];
function Picker() {
  const [value, setValue] = useState("react");
  return (
    <>
      <TechnologyPicker
        kind="frontend"
        stacks={stacks}
        value={value}
        onChange={setValue}
      />
      <TechnologySummary frontend={value} backend="springboot" />
    </>
  );
}
it("selects a framework through accessible radio cards and updates the stack summary", () => {
  render(<Picker />);
  expect(screen.getByRole("radio", { name: /React/ })).toBeChecked();
  fireEvent.click(screen.getByRole("radio", { name: /Next.js/ }));
  expect(screen.getByRole("radio", { name: /Next.js/ })).toBeChecked();
  expect(screen.getByRole("radio", { name: /React/ })).not.toBeChecked();
  expect(screen.getByText("Java Spring Boot")).toBeInTheDocument();
});
