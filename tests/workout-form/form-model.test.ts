/**
 * tests/workout-form/form-model.test.ts
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/drizzle", () => ({ db: {} }));
vi.mock("iron-session", () => ({ getIronSession: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/session", () => ({ sessionOptions: {} }));

import {
  buildBlankWorkoutFormSeed,
  buildDuplicateWorkoutFormSeed,
  buildEditWorkoutFormSeed,
} from "@/components/workout-form/form-model";
import type { Workout } from "@/lib/types";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: 42,
    userId: 1,
    name: "Leg Day",
    date: "2026-06-01",
    notes: "Felt strong today",
    durationMinutes: 75,
    exercises: [
      {
        id: 1,
        workoutId: 42,
        name: "Squat",
        notes: "ATG depth",
        supersetGroupId: null,
        sets: [
          { id: 1, exerciseId: 1, reps: "5", weight: "100", rpe: "8" },
          { id: 2, exerciseId: 1, reps: "5", weight: "105", rpe: "9" },
        ],
      },
      {
        id: 2,
        workoutId: 42,
        name: "Romanian Deadlift",
        notes: "Slow eccentric",
        supersetGroupId: null,
        sets: [{ id: 3, exerciseId: 2, reps: "8", weight: "80", rpe: "7" }],
      },
    ],
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════════
// buildBlankWorkoutFormSeed
// ═════════════════════════════════════════════════════════════════════════════

describe("buildBlankWorkoutFormSeed", () => {
  it("returns a create seed with empty fields and a single blank exercise", () => {
    const seed = buildBlankWorkoutFormSeed();
    expect(seed.persistMode).toBe("create");
    expect(seed.initialValues.name).toBe("");
    expect(seed.initialValues.date).toBe("");
    expect(seed.initialValues.notes).toBe("");
    expect(seed.initialValues.durationMinutes).toBeNull();
    expect(seed.initialValues.exercises).toHaveLength(1);
    expect(seed.initialValues.exercises[0].name).toBe("");
    expect(seed.templateValuesByExerciseName).toBeUndefined();
  });

  it("uses provided exerciseNames and defaults to empty array when omitted", () => {
    const names = ["Squat", "Bench Press"];
    expect(buildBlankWorkoutFormSeed(names).exerciseNames).toEqual(names);
    expect(buildBlankWorkoutFormSeed().exerciseNames).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildEditWorkoutFormSeed
// ═════════════════════════════════════════════════════════════════════════════

describe("buildEditWorkoutFormSeed", () => {
  it("returns an update seed with all original fields and exercises preserved", () => {
    const seed = buildEditWorkoutFormSeed(makeWorkout({ id: 99 }));
    expect(seed.persistMode).toBe("update");
    expect(seed.workoutId).toBe(99);
    expect(seed.initialValues.name).toBe("Leg Day");
    expect(seed.initialValues.date).toBe("2026-06-01");
    expect(seed.initialValues.notes).toBe("Felt strong today");
    expect(seed.initialValues.durationMinutes).toBe(75);
    expect(seed.initialValues.exercises).toHaveLength(2);
    expect(seed.initialValues.exercises[0].sets).toHaveLength(2);
    expect(seed.initialValues.exercises[1].sets).toHaveLength(1);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// buildDuplicateWorkoutFormSeed
// ═════════════════════════════════════════════════════════════════════════════

describe("buildDuplicateWorkoutFormSeed", () => {
  it("returns a create seed with name prefixed, date/notes/duration reset", () => {
    const seed = buildDuplicateWorkoutFormSeed(makeWorkout());
    expect(seed.persistMode).toBe("create");
    expect((seed as { workoutId?: number }).workoutId).toBeUndefined();
    expect(seed.initialValues.name).toBe("Copy of Leg Day");
    expect(seed.initialValues.date).toBe("");
    expect(seed.initialValues.notes).toBe("");
    expect(seed.initialValues.durationMinutes).toBeNull();
  });

  it("preserves exercise names, count, and supersetGroupId; clears set values and notes", () => {
    const workout = makeWorkout({
      exercises: [
        {
          id: 1, workoutId: 42, name: "Squat", notes: "ATG",
          supersetGroupId: "ss-1",
          sets: [{ id: 1, exerciseId: 1, reps: "5", weight: "100", rpe: "8" }],
        },
        {
          id: 2, workoutId: 42, name: "Lunge", notes: "Slow",
          supersetGroupId: "ss-1",
          sets: [{ id: 2, exerciseId: 2, reps: "10", weight: "40", rpe: "7" }],
        },
      ],
    });

    const seed = buildDuplicateWorkoutFormSeed(workout);
    const exs = seed.initialValues.exercises;

    expect(exs.map((e) => e.name)).toEqual(["Squat", "Lunge"]);
    expect(exs[0].supersetGroupId).toBe("ss-1");
    expect(exs[1].supersetGroupId).toBe("ss-1");

    const allSets = exs.flatMap((e) => e.sets);
    expect(allSets.every((s) => s.reps === "" && s.weight === "" && s.rpe === "")).toBe(true);
    expect(exs.every((e) => e.notes === "")).toBe(true);
  });

  it("templateValuesByExerciseName carries original set data keyed by exercise name", () => {
    const seed = buildDuplicateWorkoutFormSeed(makeWorkout());
    const tmpl = seed.templateValuesByExerciseName!;

    expect(Object.keys(tmpl)).toEqual(expect.arrayContaining(["Squat", "Romanian Deadlift"]));
    expect(tmpl["Squat"].sets[0]).toMatchObject({ reps: "5", weight: "100", rpe: "8" });
    expect(tmpl["Romanian Deadlift"].sets[0]).toMatchObject({ reps: "8", weight: "80", rpe: "7" });
  });

  it("uses first occurrence for duplicate exercise names in templateValues", () => {
    const workout = makeWorkout({
      exercises: [
        { id: 1, workoutId: 42, name: "Squat", notes: "", supersetGroupId: null,
          sets: [{ id: 1, exerciseId: 1, reps: "5", weight: "100", rpe: "8" }] },
        { id: 2, workoutId: 42, name: "Squat", notes: "", supersetGroupId: null,
          sets: [{ id: 2, exerciseId: 2, reps: "3", weight: "120", rpe: "9" }] },
      ],
    });
    const seed = buildDuplicateWorkoutFormSeed(workout);
    expect(Object.keys(seed.templateValuesByExerciseName!)).toHaveLength(1);
    expect(seed.templateValuesByExerciseName!["Squat"].sets[0].weight).toBe("100");
  });

  it("does not mutate the original workout", () => {
    const workout = makeWorkout();
    const originalReps = workout.exercises[0].sets[0].reps;
    buildDuplicateWorkoutFormSeed(workout);
    expect(workout.name).toBe("Leg Day");
    expect(workout.exercises[0].sets[0].reps).toBe(originalReps);
  });

  it("handles edge cases: no exercises, exercise with no sets", () => {
    const empty = buildDuplicateWorkoutFormSeed(makeWorkout({ exercises: [] }));
    expect(empty.initialValues.exercises).toHaveLength(0);
    expect(empty.templateValuesByExerciseName).toEqual({});

    const noSets = buildDuplicateWorkoutFormSeed(makeWorkout({
      exercises: [{
        id: 1, workoutId: 42, name: "Plank", notes: "", supersetGroupId: null, sets: [],
      }],
    }));
    expect(noSets.initialValues.exercises[0].sets).toHaveLength(0);
    expect(noSets.templateValuesByExerciseName!["Plank"].sets).toHaveLength(0);
  });
});
