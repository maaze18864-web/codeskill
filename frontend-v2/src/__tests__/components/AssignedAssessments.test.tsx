import React from "react";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { AssignedAssessments } from "@/components/landing/AssignedAssessments";
import { studentAssessmentsAPI } from "@/config/api";
import { useAuth } from "@/context/AuthContext";

jest.mock("@/config/api", () => ({ studentAssessmentsAPI: { getMyAssessments: jest.fn() } }));
jest.mock("@/context/AuthContext", () => ({ useAuth: jest.fn() }));
const load = jest.mocked(studentAssessmentsAPI.getMyAssessments);
const auth = jest.mocked(useAuth);
beforeEach(() => {
  jest.resetAllMocks();
  auth.mockReturnValue({ user: { id: "student" }, loading: false } as ReturnType<typeof useAuth>);
});

it("shows actual assigned assessments and their canonical candidate links on Home", async () => {
  load.mockResolvedValue({ data: { assessments: [{
    id: "assessment-uuid", _id: "legacy-id", title: "Live coding exam", code: "EXAM-1234",
    status: "published", durationMinutes: 30, questionCount: 4,
  }] } });
  render(<AssignedAssessments />);
  expect(await screen.findByRole("heading", { name: "Live coding exam" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "View assessment" })).toHaveAttribute("href", "/assessments/assessment-uuid");
});

it("does not request another candidate's data when signed out", () => {
  auth.mockReturnValue({ user: null, loading: false } as ReturnType<typeof useAuth>);
  render(<AssignedAssessments />);
  expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  expect(load).not.toHaveBeenCalled();
});

it("retries a failed request and distinguishes an empty assignment list", async () => {
  load.mockRejectedValueOnce({ response: { status: 500 } }).mockResolvedValue({ data: { assessments: [] } });
  render(<AssignedAssessments />);
  expect(await screen.findByRole("alert")).toHaveTextContent("couldn’t be loaded");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No assessments assigned yet. Your next test will appear here.")).toBeInTheDocument();
});
