# Duplicate Workout History Prefetch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prefetch exercise history only for duplicate workout forms so opening history usually reads from SWR cache without changing modal behavior.

**Architecture:** Move the existing exercise history SWR key and fetcher into a shared helper module used by both the modal and the new duplicate prefetch component. Extend duplicate form seeds with optional prefetch exercise names, render a no-UI client prefetcher from `WorkoutForm` only when that metadata exists, and keep create/edit forms unchanged.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Clerk `useAuth`, SWR `useSWR`/`useSWRConfig`, Vitest, React Testing Library.

---

## File Structure

- Create: `components/exercise/exercise-history-data.ts`
  - Owns the shared SWR key builder and `/api/exercises/history` fetcher.
- Modify: `components/exercise/exercise-history-modal.tsx`
  - Imports the shared key builder and fetcher; preserves existing modal behavior.
- Create: `components/workout-form/duplicate-history-prefetch.tsx`
  - Renderless client component that dedupes duplicate-form exercise names and warms SWR cache.
- Modify: `components/workout-form/form-types.ts`
  - Adds optional `historyPrefetchExerciseNames?: string[]` to workout form seed and prop types.
- Modify: `components/workout-form/form-model.ts`
  - Sets `historyPrefetchExerciseNames` only in `buildDuplicateWorkoutFormSeed()`.
- Modify: `components/workout-form/workout-form.tsx`
  - Renders the prefetch helper only when duplicate prefetch names are present.
- Modify: `tests/workout-form/form-model.test.ts`
  - Verifies duplicate seeds include prefetch names and create/edit seeds omit them.
- Create: `tests/workout-form/duplicate-history-prefetch.test.tsx`
  - Verifies prefetch dedupe, cache key sharing, cached-key skipping, and best-effort failure handling.
- Modify: `tests/components/exercise-history-modal.test.tsx`
  - Keeps existing modal tests passing after helper extraction; no expected behavior changes.

## Task 1: Extract Shared Exercise History Data Helpers

**Files:**
- Create: `components/exercise/exercise-history-data.ts`
- Modify: `components/exercise/exercise-history-modal.tsx`
- Test: `tests/components/exercise-history-modal.test.tsx`

- [ ] **Step 1: Write the new helper module**

Create `components/exercise/exercise-history-data.ts`:

```ts
import type { ExerciseHistoryEntry } from "@/lib/types";
import { exerciseHistoryEntrySchema } from "@/lib/types";
import { errorResponseSchema, parseJsonResponse } from "@/lib/json-response";

export function getExerciseHistoryKey({
  exerciseName,
  userId,
}: {
  exerciseName: string;
  userId: string | null | undefined;
}) {
  return ["exercise-history", userId ?? "signed-out", exerciseName] as const;
}

export async function getExerciseHistory(
  exerciseName: string,
): Promise<ExerciseHistoryEntry[]> {
  const response = await fetch(
    `/api/exercises/history?name=${encodeURIComponent(exerciseName)}`,
  );

  if (!response.ok) {
    let errorMessage = `Failed to fetch data: ${response.status} ${response.statusText}`;

    try {
      const errorBody = await parseJsonResponse(response, errorResponseSchema);
      if (errorBody.error) {
        errorMessage = errorBody.error;
      }
    } catch (jsonError) {
      console.error("Failed to parse error JSON:", jsonError);
    }

    throw new Error(errorMessage);
  }

  return parseJsonResponse(response, exerciseHistoryEntrySchema.array());
}
```

- [ ] **Step 2: Update the modal to import the helper**

In `components/exercise/exercise-history-modal.tsx`, replace the local key/fetcher/schema imports with shared helper imports:

```ts
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@clerk/nextjs";
import { useState } from "react";
import useSWR from "swr";
import type { ExerciseHistoryEntry } from "@/lib/types";
import ExerciseInstanceItem from "./exercise-instance-item";
import { Spinner } from "@/components/ui/spinner";
import {
  getExerciseHistory,
  getExerciseHistoryKey,
} from "@/components/exercise/exercise-history-data";
```

Remove these local declarations from the modal because the helper now owns them:

```ts
import { exerciseHistoryEntrySchema } from "@/lib/types";
import { errorResponseSchema, parseJsonResponse } from "@/lib/json-response";

function getExerciseHistoryKey(...) { ... }

async function getExerciseHistory(...) { ... }
```

Keep the `useSWR(...)` call unchanged except that it now uses the imported functions:

```ts
const { data, error, isLoading } = useSWR(
  open ? getExerciseHistoryKey({ exerciseName, userId }) : null,
  () => getExerciseHistory(exerciseName),
  {
    dedupingInterval: 0,
  },
);
```

- [ ] **Step 3: Run modal tests to prove behavior stayed unchanged**

Run:

```bash
pnpm test tests/components/exercise-history-modal.test.tsx
```

Expected: PASS. Existing tests for revalidation, user scoping, filtering, empty state, and errors should continue to pass without expectation changes.

- [ ] **Step 4: Commit helper extraction**

```bash
git add components/exercise/exercise-history-data.ts components/exercise/exercise-history-modal.tsx tests/components/exercise-history-modal.test.tsx
git commit -m "refactor: share exercise history fetch helpers"
```

## Task 2: Add Duplicate-Only Prefetch Metadata To Form Seeds

**Files:**
- Modify: `components/workout-form/form-types.ts`
- Modify: `components/workout-form/form-model.ts`
- Modify: `tests/workout-form/form-model.test.ts`

- [ ] **Step 1: Write failing form-model expectations**

In `tests/workout-form/form-model.test.ts`, update the duplicate seed expectation in `"builds a duplicate form seed from the helper pipeline"` to include:

```ts
historyPrefetchExerciseNames: ["Bench Press"],
```

The full expected duplicate object should become:

```ts
{
  persistMode: "create",
  exerciseNames: exerciseNamesFixture,
  historyPrefetchExerciseNames: ["Bench Press"],
  initialValues: {
    name: "Copy of Push Day",
    date: "",
    notes: "",
    durationMinutes: null,
    exercises: [
      {
        name: "Bench Press",
        notes: "",
        supersetGroupId: "superset-a",
        sets: [
          { weight: "", reps: "", rpe: "" },
          { weight: "", reps: "", rpe: "" },
        ],
      },
    ],
  },
  templateValuesByExerciseName: {
    "Bench Press": {
      name: "Bench Press",
      notes: "",
      supersetGroupId: "superset-a",
      sets: [
        { weight: "225", reps: "5", rpe: "8" },
        { weight: "235", reps: "3", rpe: "9" },
      ],
    },
  },
}
```

In `"builds a blank create seed with one empty exercise row"`, add this assertion after the existing `toEqual(...)`:

```ts
expect(
  buildBlankWorkoutFormSeed(exerciseNamesFixture),
).not.toHaveProperty("historyPrefetchExerciseNames");
```

In `"builds an edit seed that preserves the workout values and id"`, add this assertion after the existing `toEqual(...)`:

```ts
expect(
  buildEditWorkoutFormSeed(workoutFixture, exerciseNamesFixture),
).not.toHaveProperty("historyPrefetchExerciseNames");
```

In `"returns empty template values when there are no exercises"`, add:

```ts
expect(duplicateSeed.historyPrefetchExerciseNames).toEqual([]);
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
pnpm test tests/workout-form/form-model.test.ts
```

Expected: FAIL because `historyPrefetchExerciseNames` is not part of the seed types or duplicate seed return value yet.

- [ ] **Step 3: Add the optional type property**

In `components/workout-form/form-types.ts`, update `WorkoutFormSeed`:

```ts
export type WorkoutFormSeed = {
  initialValues: WorkoutDraft;
  persistMode: PersistMode;
  exerciseNames: string[];
  workoutId?: number;
  templateValuesByExerciseName?: ExerciseTemplateValuesByName;
  historyPrefetchExerciseNames?: string[];
};
```

Add a shared prop base so both sides of the `WorkoutFormProps` union expose the optional property to TypeScript:

```ts
type BaseWorkoutFormProps = {
  initialValues: WorkoutDraft;
  exerciseNames: string[];
  templateValuesByExerciseName?: ExerciseTemplateValuesByName;
  historyPrefetchExerciseNames?: string[];
};

type CreateWorkoutFormProps = BaseWorkoutFormProps & {
  persistMode: "create";
};
```

Update `UpdateWorkoutFormProps` to include the base props while preventing update callers from supplying prefetch names:

```ts
export type UpdateWorkoutFormProps = BaseWorkoutFormProps & {
  persistMode: "update";
  workoutId: number;
  historyPrefetchExerciseNames?: never;
};
```

This keeps update/edit forms structurally separate from duplicate prefetch metadata while allowing `WorkoutForm` to safely destructure `historyPrefetchExerciseNames`.

- [ ] **Step 4: Populate the duplicate seed only**

In `components/workout-form/form-model.ts`, update `buildDuplicateWorkoutFormSeed()`:

```ts
export function buildDuplicateWorkoutFormSeed(
  workout: Workout,
  exerciseNames: string[] = [],
): CreateWorkoutFormSeed {
  const workoutTemplate = toDuplicateWorkoutDraft(workout);

  return {
    persistMode: "create",
    exerciseNames,
    historyPrefetchExerciseNames: workoutTemplate.exercises.map(
      (exercise) => exercise.name,
    ),
    initialValues: zeroWorkoutSetValues(workoutTemplate),
    templateValuesByExerciseName: toTemplateValuesByExerciseName(
      workoutTemplate.exercises,
    ),
  };
}
```

Do not add `historyPrefetchExerciseNames` to `buildBlankWorkoutFormSeed()` or `buildEditWorkoutFormSeed()`.

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```bash
pnpm test tests/workout-form/form-model.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit seed metadata**

```bash
git add components/workout-form/form-types.ts components/workout-form/form-model.ts tests/workout-form/form-model.test.ts
git commit -m "feat: mark duplicate workout history prefetch targets"
```

## Task 3: Build The Renderless Duplicate History Prefetch Component

**Files:**
- Create: `components/workout-form/duplicate-history-prefetch.tsx`
- Create: `tests/workout-form/duplicate-history-prefetch.test.tsx`

- [ ] **Step 1: Write failing prefetch component tests**

Create `tests/workout-form/duplicate-history-prefetch.test.tsx`:

```tsx
// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { SWRConfig, unstable_serialize } from "swr";
import {
  getExerciseHistoryKey,
  type ExerciseHistoryKey,
} from "@/components/exercise/exercise-history-data";

const { authState } = vi.hoisted(() => ({
  authState: {
    userId: "user-1" as string | null,
    isLoaded: true,
  },
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    userId: authState.userId,
    isLoaded: authState.isLoaded,
  }),
}));

import DuplicateWorkoutHistoryPrefetch from "@/components/workout-form/duplicate-history-prefetch";

function historyResponse(workoutName: string) {
  return new Response(
    JSON.stringify([
      {
        date: "2026-04-04",
        notes: "History notes",
        workoutId: 10,
        workoutName,
        sets: [],
      },
    ]),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

function serializedHistoryKey(exerciseName: string) {
  return unstable_serialize(
    getExerciseHistoryKey({
      exerciseName,
      userId: authState.userId,
    }) satisfies ExerciseHistoryKey,
  );
}

describe("DuplicateWorkoutHistoryPrefetch", () => {
  beforeEach(() => {
    authState.userId = "user-1";
    authState.isLoaded = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "/api/exercises/history?name=Bench%20Press") {
          return historyResponse("Bench History");
        }

        if (url === "/api/exercises/history?name=Squat") {
          return historyResponse("Squat History");
        }

        throw new Error(`Unexpected fetch request: ${url}`);
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("dedupes non-blank exercise names and warms the SWR cache", async () => {
    const cache = new Map();

    render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch
          exerciseNames={[" Bench Press ", "Bench Press", "", "Squat"]}
        />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    expect(fetch).toHaveBeenCalledWith(
      "/api/exercises/history?name=Bench%20Press",
    );
    expect(fetch).toHaveBeenCalledWith("/api/exercises/history?name=Squat");

    await waitFor(() => {
      expect(
        cache.get(serializedHistoryKey("Bench Press"))?.data,
      ).toEqual([
        expect.objectContaining({ workoutName: "Bench History" }),
      ]);
      expect(cache.get(serializedHistoryKey("Squat"))?.data).toEqual([
        expect.objectContaining({ workoutName: "Squat History" }),
      ]);
    });
  });

  it("does not refetch a history key that is already cached", async () => {
    const cache = new Map();
    cache.set(serializedHistoryKey("Bench Press"), {
      data: [
        {
          date: "2026-04-01",
          notes: "Cached",
          workoutId: 9,
          workoutName: "Cached Bench",
          sets: [],
        },
      ],
    });

    render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  it("waits until Clerk auth has loaded before prefetching", async () => {
    authState.isLoaded = false;
    const cache = new Map();

    const { rerender } = render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    expect(fetch).not.toHaveBeenCalled();

    authState.isLoaded = true;
    rerender(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  it("treats prefetch failures as best-effort background work", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network failed"));

    render(
      <SWRConfig value={{ provider: () => new Map() }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
pnpm test tests/workout-form/duplicate-history-prefetch.test.tsx
```

Expected: FAIL because `components/workout-form/duplicate-history-prefetch.tsx` does not exist and `ExerciseHistoryKey` is not exported yet.

- [ ] **Step 3: Export the key type from the shared helper**

In `components/exercise/exercise-history-data.ts`, add:

```ts
export type ExerciseHistoryKey = ReturnType<typeof getExerciseHistoryKey>;
```

Place it after `getExerciseHistoryKey()`.

- [ ] **Step 4: Implement the prefetch component**

Create `components/workout-form/duplicate-history-prefetch.tsx`:

```tsx
"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useMemo, useRef } from "react";
import { unstable_serialize, useSWRConfig } from "swr";
import {
  getExerciseHistory,
  getExerciseHistoryKey,
} from "@/components/exercise/exercise-history-data";

function getUniqueExerciseNames(exerciseNames: string[]): string[] {
  const seen = new Set<string>();
  const uniqueNames: string[] = [];

  for (const exerciseName of exerciseNames) {
    const trimmedName = exerciseName.trim();

    if (!trimmedName || seen.has(trimmedName)) {
      continue;
    }

    seen.add(trimmedName);
    uniqueNames.push(trimmedName);
  }

  return uniqueNames;
}

export default function DuplicateWorkoutHistoryPrefetch({
  exerciseNames,
}: {
  exerciseNames: string[];
}) {
  const { isLoaded, userId } = useAuth();
  const { cache, mutate } = useSWRConfig();
  const requestedCacheKeysRef = useRef(new Set<string>());
  const uniqueExerciseNames = useMemo(
    () => getUniqueExerciseNames(exerciseNames),
    [exerciseNames],
  );

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    for (const exerciseName of uniqueExerciseNames) {
      const historyKey = getExerciseHistoryKey({ exerciseName, userId });
      const serializedKey = unstable_serialize(historyKey);

      if (
        requestedCacheKeysRef.current.has(serializedKey) ||
        cache.get(serializedKey) !== undefined
      ) {
        continue;
      }

      requestedCacheKeysRef.current.add(serializedKey);
      void mutate(historyKey, getExerciseHistory(exerciseName), {
        populateCache: true,
        revalidate: false,
        throwOnError: false,
      }).catch(() => undefined);
    }
  }, [cache, isLoaded, mutate, uniqueExerciseNames, userId]);

  return null;
}
```

- [ ] **Step 5: Run the new test and verify it passes**

Run:

```bash
pnpm test tests/workout-form/duplicate-history-prefetch.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit prefetch component**

```bash
git add components/exercise/exercise-history-data.ts components/workout-form/duplicate-history-prefetch.tsx tests/workout-form/duplicate-history-prefetch.test.tsx
git commit -m "feat: prefetch duplicate workout exercise history"
```

## Task 4: Render Prefetch Only From Duplicate Workout Forms

**Files:**
- Modify: `components/workout-form/workout-form.tsx`
- Modify: `tests/workout-form/workout-form-promotion.test.tsx`

- [ ] **Step 1: Write failing render-gating tests**

In `tests/workout-form/workout-form-promotion.test.tsx`, add this mock above `import WorkoutForm ...`:

```tsx
const { duplicateHistoryPrefetchMock } = vi.hoisted(() => ({
  duplicateHistoryPrefetchMock: vi.fn(),
}));

vi.mock("@/components/workout-form/duplicate-history-prefetch", () => ({
  default: ({ exerciseNames }: { exerciseNames: string[] }) => {
    duplicateHistoryPrefetchMock(exerciseNames);
    return <div data-testid="duplicate-history-prefetch" />;
  },
}));
```

Inside `beforeEach()`, reset it:

```ts
duplicateHistoryPrefetchMock.mockReset();
```

Add these tests near the date initialization tests:

```tsx
it("renders duplicate history prefetch when duplicate prefetch names are provided", () => {
  render(
    <WorkoutForm
      initialValues={buildWorkoutDraft({ date: "" })}
      persistMode="create"
      exerciseNames={exerciseNamesFixture}
      historyPrefetchExerciseNames={["Bench Press", "Squat"]}
      templateValuesByExerciseName={{
        "Bench Press": {
          name: "Bench Press",
          notes: "",
          supersetGroupId: null,
          sets: [{ weight: "200", reps: "6", rpe: "7" }],
        },
      }}
    />,
  );

  expect(screen.getByTestId("duplicate-history-prefetch")).toBeTruthy();
  expect(duplicateHistoryPrefetchMock).toHaveBeenCalledWith([
    "Bench Press",
    "Squat",
  ]);
});

it("does not render duplicate history prefetch for ordinary create forms", () => {
  render(
    <WorkoutForm
      initialValues={buildWorkoutDraft({ date: "" })}
      persistMode="create"
      exerciseNames={exerciseNamesFixture}
    />,
  );

  expect(screen.queryByTestId("duplicate-history-prefetch")).toBeNull();
  expect(duplicateHistoryPrefetchMock).not.toHaveBeenCalled();
});

it("does not render duplicate history prefetch for update forms", () => {
  render(
    <WorkoutForm
      initialValues={buildWorkoutDraft()}
      persistMode="update"
      workoutId={42}
      exerciseNames={exerciseNamesFixture}
    />,
  );

  expect(screen.queryByTestId("duplicate-history-prefetch")).toBeNull();
  expect(duplicateHistoryPrefetchMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused form test and verify it fails**

Run:

```bash
pnpm test tests/workout-form/workout-form-promotion.test.tsx
```

Expected: FAIL because `WorkoutForm` does not render the prefetch helper yet.

- [ ] **Step 3: Render the helper from WorkoutForm**

In `components/workout-form/workout-form.tsx`, add the import:

```ts
import DuplicateWorkoutHistoryPrefetch from "@/components/workout-form/duplicate-history-prefetch";
```

Destructure the optional prop:

```ts
const {
  initialValues,
  persistMode,
  templateValuesByExerciseName,
  exerciseNames,
  historyPrefetchExerciseNames,
} = props;
```

Render the helper at the top of the form body, before the visible form controls:

```tsx
return (
  <form noValidate onSubmit={handleSubmit(onSubmit)} aria-busy={isSubmitting}>
    {historyPrefetchExerciseNames?.length ? (
      <DuplicateWorkoutHistoryPrefetch
        exerciseNames={historyPrefetchExerciseNames}
      />
    ) : null}

    <WorkoutFormActionHeader saveStatus={saveStatus} />
```

- [ ] **Step 4: Run the focused form test and verify it passes**

Run:

```bash
pnpm test tests/workout-form/workout-form-promotion.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit WorkoutForm integration**

```bash
git add components/workout-form/workout-form.tsx tests/workout-form/workout-form-promotion.test.tsx
git commit -m "feat: wire duplicate history prefetch into workout form"
```

## Task 5: Full Verification

**Files:**
- Verify all files touched by Tasks 1-4.

- [ ] **Step 1: Run focused behavior tests**

Run:

```bash
pnpm test tests/workout-form/form-model.test.ts tests/workout-form/duplicate-history-prefetch.test.tsx tests/workout-form/workout-form-promotion.test.tsx tests/components/exercise-history-modal.test.tsx
```

Expected: PASS for all four test files.

- [ ] **Step 2: Run route history regression test**

Run:

```bash
pnpm test tests/routes/exercise-history-route.test.ts
```

Expected: PASS. The `/api/exercises/history` contract should remain unchanged.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS with no ESLint errors.

- [ ] **Step 4: Inspect final diff for scope**

Run:

```bash
git diff --stat HEAD~4..HEAD
```

Expected: only the planned helper, prefetch component, form seed/form integration, and tests changed.

- [ ] **Step 5: Final commit if verification required formatting fixes**

If lint or tests required small follow-up edits, commit them:

```bash
git add components/exercise/exercise-history-data.ts components/exercise/exercise-history-modal.tsx components/workout-form/duplicate-history-prefetch.tsx components/workout-form/form-types.ts components/workout-form/form-model.ts components/workout-form/workout-form.tsx tests/workout-form/form-model.test.ts tests/workout-form/duplicate-history-prefetch.test.tsx tests/workout-form/workout-form-promotion.test.tsx tests/components/exercise-history-modal.test.tsx
git commit -m "test: verify duplicate workout history prefetch"
```

## Self-Review

- Spec coverage: Tasks 2 and 4 make prefetch duplicate-only. Task 3 dedupes names, skips blanks, uses the same SWR key/fetcher, waits for auth, avoids cached-key refetches, and treats failures as best-effort. Task 1 preserves modal behavior through helper extraction. Task 5 verifies focused tests, route regression, and lint.
- Placeholder scan: This plan contains no placeholder markers or vague deferred-work steps. Code snippets and commands are explicit.
- Type consistency: The plan uses `historyPrefetchExerciseNames?: string[]` consistently in seed types, duplicate seed creation, `WorkoutForm`, and tests. The shared history helper exports `getExerciseHistoryKey`, `getExerciseHistory`, and `ExerciseHistoryKey`, which match the prefetch test and implementation.
