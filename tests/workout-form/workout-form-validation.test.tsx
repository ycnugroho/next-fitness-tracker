// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WorkoutDraft } from "@/components/workout-form/form-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn(), back: vi.fn(), forward: vi.fn() }),
}));
vi.mock("@/components/workout-form/workout-form-action-header", () => ({
  default: () => <button type="submit">Save Workout</button>,
}));
vi.mock("@/components/workout-form/exercise-selector", () => ({
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void; exercises: string[]; openOnMount?: boolean; hideTriggerWhenOpen?: boolean; onOpenChange?: (o: boolean) => void }) => (
    <input aria-label="Exercise name" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock("@/components/workout-form/exercise-actions-menu", () => ({ default: () => null }));
vi.mock("@/components/workout-form/save-workout", () => ({ saveWorkout: vi.fn() }));

import WorkoutForm from "@/components/workout-form/workout-form";
import { saveWorkout } from "@/components/workout-form/save-workout";

const mockSave = saveWorkout as Mock;
const TODAY = "2026-06-17";

const VALID: WorkoutDraft = {
  name: "Push Day", date: TODAY, notes: "", durationMinutes: null,
  exercises: [{ name: "Bench Press", notes: "", supersetGroupId: null, sets: [{ weight: "80", reps: "8", rpe: "7" }] }],
};
const BLANK_EXERCISE: WorkoutDraft = {
  name: "Push Day", date: TODAY, notes: "", durationMinutes: null,
  exercises: [{ name: "", notes: "", supersetGroupId: null, sets: [{ weight: "", reps: "", rpe: "" }] }],
};

function renderCreate(initial = VALID) {
  const user = userEvent.setup();
  render(<WorkoutForm initialValues={initial} persistMode="create" exerciseNames={["Bench Press", "Squat"]} />);
  return { user };
}
function renderUpdate(initial: WorkoutDraft) {
  const user = userEvent.setup();
  render(<WorkoutForm initialValues={initial} persistMode="update" workoutId={1} exerciseNames={["Bench Press", "Squat"]} />);
  return { user };
}
const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Save Workout" }));
const alertsText = () => screen.queryAllByRole("alert").map((a) => a.textContent).join(" ");

describe("WorkoutForm validation", () => {
  beforeEach(() => { mockSave.mockResolvedValue({ ok: true, workoutId: 1 }); });
  afterEach(() => { cleanup(); vi.clearAllMocks(); });

  it("blocks submit and shows name + date errors when both are missing (update mode)", async () => {
    const { user } = renderUpdate({ ...VALID, name: "", date: "" });
    await submit(user);
    const text = alertsText();
    expect(text).toMatch(/workout name/i);
    expect(text).toMatch(/date/i);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("clears name error after typing a name", async () => {
    const { user } = renderUpdate({ ...VALID, name: "" });
    await submit(user);
    expect(alertsText()).toMatch(/workout name/i);
    await user.type(screen.getByLabelText("Workout Name"), "Leg Day");
    expect(alertsText()).not.toMatch(/workout name/i);
  });

  it("shows duration error for invalid values (0, negative) and accepts valid / empty", async () => {
    // invalid: 0
    const { user: u1 } = renderCreate(VALID);
    const dur1 = screen.getByLabelText("Workout Duration");
    await u1.clear(dur1); await u1.type(dur1, "0"); await submit(u1);
    expect(alertsText()).toMatch(/duration/i);
    cleanup();

    // invalid: negative
    const { user: u2 } = renderCreate(VALID);
    const dur2 = screen.getByLabelText("Workout Duration");
    await u2.clear(dur2); await u2.type(dur2, "-5"); await submit(u2);
    expect(alertsText()).toMatch(/duration/i);
    cleanup();

    // valid: positive
    const { user: u3 } = renderCreate(VALID);
    const dur3 = screen.getByLabelText("Workout Duration");
    await u3.clear(dur3); await u3.type(dur3, "45"); await submit(u3);
    expect(alertsText()).not.toMatch(/duration/i);
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("shows exercise name error when empty, clears after typing and resubmitting", async () => {
    const { user } = renderCreate(BLANK_EXERCISE);
    await submit(user);
    expect(alertsText()).toMatch(/exercise/i);
    await user.type(screen.getByLabelText("Exercise name"), "Squat");
    await submit(user);
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("blocks submit when name exceeds 50 characters, accepts exactly 50", async () => {
    const { user: u1 } = renderUpdate({ ...VALID, name: "A".repeat(51) });
    await submit(u1);
    expect(mockSave).not.toHaveBeenCalled();
    cleanup();

    const { user: u2 } = renderCreate({ ...VALID, name: "A".repeat(50) });
    await submit(u2);
    expect(mockSave).toHaveBeenCalledOnce();
  });

  it("valid submit: calls saveWorkout with correct payload, no alerts", async () => {
    const { user } = renderCreate(VALID);
    await submit(user);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expect(mockSave).toHaveBeenCalledOnce();
    const [arg] = mockSave.mock.calls[0];
    expect(arg.persistMode).toBe("create");
    expect(arg.values.name).toBe("Push Day");
    expect(arg.values.date).toBe(TODAY);
    expect(arg.values.exercises[0].name).toBe("Bench Press");
    expect(arg.values.exercises[0].sets[0]).toMatchObject({ weight: "80", reps: "8", rpe: "7" });
  });

  it("set operations: add set includes it in payload; delete all sets still submits", async () => {
    // add second set
    const { user: u1 } = renderCreate(VALID);
    await u1.click(screen.getByRole("button", { name: "Add set" }));
    await u1.type(screen.getByLabelText("Set 2 weight"), "85");
    await u1.type(screen.getByLabelText("Set 2 reps"), "6");
    await submit(u1);
    expect(mockSave.mock.calls[0][0].values.exercises[0].sets).toHaveLength(2);
    cleanup(); mockSave.mockClear();

    // delete all sets
    const { user: u2 } = renderCreate(VALID);
    await u2.click(screen.getByRole("button", { name: "Delete set 1" }));
    await submit(u2);
    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockSave.mock.calls[0][0].values.exercises[0].sets).toHaveLength(0);
  });

  it("Add Exercise button renders and adds a blank exercise row", async () => {
    const { user } = renderCreate(BLANK_EXERCISE);
    expect(screen.getAllByLabelText("Exercise name")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Add Exercise" }));
    expect(screen.getAllByLabelText("Exercise name")).toHaveLength(2);
  });
});
