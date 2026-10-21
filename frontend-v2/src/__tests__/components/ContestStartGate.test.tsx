import React from "react";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { ContestStartGate } from "@/app/contests/[id]/attempt/_components/ContestStartGate";
it("requires consent and real fullscreen before starting", async () => {
  const accept = jest.fn(); const request = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  render(<ContestStartGate onAccept={accept} requestFullscreen={request} isFullscreen={false} hasRequestedFullscreen={false} />);
  expect(screen.getByRole("button", { name: "Enter Fullscreen & Start" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Agree to contest rules" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enter Fullscreen & Start" })));
  expect(request).toHaveBeenCalledTimes(1); expect(accept).not.toHaveBeenCalled();
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enter Fullscreen & Start" })));
  expect(accept).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
});
it("respects a contest configured without fullscreen", async () => {
  const accept = jest.fn(); const request = jest.fn();
  render(<ContestStartGate onAccept={accept} requestFullscreen={request} isFullscreen={false} hasRequestedFullscreen={false} requireFullscreen={false} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Agree to contest rules" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Start Contest" })));
  expect(accept).toHaveBeenCalledTimes(1); expect(request).not.toHaveBeenCalled();
});
it("shows rejected fullscreen requests and never starts the attempt", async () => {
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  const accept = jest.fn();
  render(<ContestStartGate onAccept={accept} requestFullscreen={jest.fn().mockRejectedValue(new Error("Fullscreen denied"))} isFullscreen={false} hasRequestedFullscreen={false} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Agree to contest rules" }));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Enter Fullscreen & Start" })));
  expect(screen.getByRole("alert")).toHaveTextContent("Fullscreen denied"); expect(accept).not.toHaveBeenCalled();
});
it("submits the start action only once when clicks arrive before React rerenders", async () => {
  let resolveAccept!: () => void;
  const accept = jest.fn(() => new Promise<void>((resolve) => { resolveAccept = resolve; }));
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.documentElement });
  render(<ContestStartGate onAccept={accept} requestFullscreen={jest.fn()} isFullscreen={true} hasRequestedFullscreen={true} />);
  fireEvent.click(screen.getByRole("checkbox", { name: "Agree to contest rules" }));
  const button = screen.getByRole("button", { name: "Enter Fullscreen & Start" });
  fireEvent.click(button);
  fireEvent.click(button);
  expect(accept).toHaveBeenCalledTimes(1);
  await act(async () => resolveAccept());
  Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
});
