// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

vi.mock("@/components/exercise/exercise-instance-item", () => ({
  default: ({ exercise }: { exercise: { workoutName?: string | null } }) =>
    <div>{exercise.workoutName}</div>,
}));

vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const Ctx = React.createContext<{ open: boolean; onOpenChange?: (o: boolean) => void }>({ open: false });
  return {
    Dialog: ({ open, onOpenChange, children }: { open: boolean; onOpenChange?: (o: boolean) => void; children: React.ReactNode }) => (
      <Ctx.Provider value={{ open, onOpenChange }}><div>{children}</div></Ctx.Provider>
    ),
    DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => {
      const ctx = React.useContext(Ctx);
      if (asChild && React.isValidElement(children))
        return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, { onClick: () => ctx.onOpenChange?.(true) });
      return <button type="button" onClick={() => ctx.onOpenChange?.(true)}>{children}</button>;
    },
    DialogContent: ({ children }: { children: React.ReactNode }) => {
      const ctx = React.useContext(Ctx);
      if (!ctx.open) return null;
      return <div>{children}<button type="button" onClick={() => ctx.onOpenChange?.(false)}>Close dialog</button></div>;
    },
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

import ExerciseHistoryModal from "@/components/exercise/exercise-history-modal";

const HISTORY = [
  { date: "2026-05-10", notes: "", workoutId: 1, workoutName: "Push Day",   sets: [] },
  { date: "2026-05-03", notes: "", workoutId: 2, workoutName: "Upper Body", sets: [] },
];

// Each call must return a fresh Response — body can only be read once
const ok  = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });
const err = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function renderModal(props: Partial<React.ComponentProps<typeof ExerciseHistoryModal>> & { exerciseName: string }) {
  const user = userEvent.setup();
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <ExerciseHistoryModal {...props}><button type="button">Open history</button></ExerciseHistoryModal>
    </SWRConfig>,
  );
  return { user };
}
const open  = (u: ReturnType<typeof userEvent.setup>) => u.click(screen.getByRole("button", { name: "Open history" }));
const close = (u: ReturnType<typeof userEvent.setup>) => u.click(screen.getByRole("button", { name: "Close dialog" }));

describe("ExerciseHistoryModal", () => {
  beforeEach(() => {
    // mockImplementation so each call returns a NEW Response object
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => ok(HISTORY)));
  });
  afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("does not fetch or show content until opened; shows title and history when opened; hides on close", async () => {
    const { user } = renderModal({ exerciseName: "Bench Press" });
    expect(screen.queryByText("Bench Press History")).toBeNull();
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    await open(user);
    expect(screen.getByText("Bench Press History")).toBeTruthy();
    expect(await screen.findByText("Push Day")).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith("/api/exercises/history?name=Bench%20Press");

    await close(user);
    expect(screen.queryByText("Bench Press History")).toBeNull();
  });

  it("encodes exercise name in fetch URL", async () => {
    const { user } = renderModal({ exerciseName: "Romanian Deadlift" });
    await open(user);
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "/api/exercises/history?name=Romanian%20Deadlift",
    ));
  });

  it("filterOutWorkoutId: excludes the specified entry", async () => {
    const { user } = renderModal({ exerciseName: "Bench Press", filterOutWorkoutId: 1 });
    await open(user);
    await waitFor(() => expect(screen.getByText("Upper Body")).toBeTruthy());
    expect(screen.queryByText("Push Day")).toBeNull();
  });

  it("filterOutWorkoutId: shows all entries when not provided", async () => {
    const { user } = renderModal({ exerciseName: "Bench Press" });
    await open(user);
    expect(await screen.findByText("Push Day")).toBeTruthy();
    expect(screen.getByText("Upper Body")).toBeTruthy();
  });

  it("filterOutWorkoutId: shows 'no history' when the only entry is filtered out", async () => {
    vi.mocked(fetch).mockImplementation(() => ok([HISTORY[0]]));
    const { user } = renderModal({ exerciseName: "Bench Press", filterOutWorkoutId: 1 });
    await open(user);
    expect(await screen.findByText(/no history found/i)).toBeTruthy();
  });

  it("shows error state for network errors and API errors with message", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
    const { user: u1 } = renderModal({ exerciseName: "Bench Press" });
    await open(u1);
    expect(await screen.findByText(/unable to load history/i)).toBeTruthy();
    cleanup();

    vi.mocked(fetch).mockImplementation(() => err(404, { error: "Exercise not found" }));
    const { user: u2 } = renderModal({ exerciseName: "Bench Press" });
    await open(u2);
    expect(await screen.findByText("Exercise not found")).toBeTruthy();
  });

  it("re-fetches on reopen and shows updated data", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockImplementationOnce(() => ok(HISTORY))
      .mockImplementationOnce(() => ok([{ date: "2026-06-01", notes: "", workoutId: 99, workoutName: "Newest Workout", sets: [] }]));

    const { user } = renderModal({ exerciseName: "Bench Press" });
    await open(user);
    expect(await screen.findByText("Push Day")).toBeTruthy();
    await close(user);
    await open(user);
    await waitFor(() => expect(screen.getByText("Newest Workout")).toBeTruthy());
    expect(screen.queryByText("Push Day")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
