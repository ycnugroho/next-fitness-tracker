# Duplicate Workout History Prefetch Design

## Purpose

When a user duplicates a workout, each copied exercise already appears in the form. Today, the first time the user opens history for any copied exercise, the history modal fetches from `/api/exercises/history` and shows a loading state. The goal is to preserve existing history behavior while warming the same client cache shortly after the duplicate form mounts, so opening history usually shows cached data immediately.

This change applies only to duplicate workout forms.

## Current Behavior

- `buildDuplicateWorkoutFormSeed()` creates a create-mode form seed from the source workout.
- `WorkoutForm` renders each copied exercise through `ExerciseItem` and `ExerciseActionsMenu`.
- `ExerciseHistoryModal` fetches history only after its dialog opens.
- The modal uses an SWR key scoped by signed-in user id and exercise name.
- The existing modal remains responsible for loading, empty, and error states.

## Requirements

- Duplicate workout forms should prefetch history for exercises copied from the duplicated workout.
- Create and edit workout forms should not prefetch history.
- The history shown in the modal must not change.
- The source workout must remain visible in history when it is part of the exercise history.
- Prefetch failures must not block or visually interrupt the form.
- Duplicate exercise names should produce one prefetch request per unique non-blank exercise name.
- The modal and prefetch code must share the same SWR key and fetcher behavior to avoid cache drift.

## Architecture

Add optional duplicate-only prefetch metadata to the workout form seed:

```ts
historyPrefetchExerciseNames?: string[];
```

Only `buildDuplicateWorkoutFormSeed()` will set this property. It will derive the list from the duplicated workout's exercises, preserving the existing source data and leaving create/edit seeds unchanged.

`WorkoutForm` will render a small client-side prefetch helper only when `historyPrefetchExerciseNames` is present and non-empty. This helper will:

- read the signed-in `userId` with Clerk, matching the history modal;
- trim and dedupe exercise names;
- skip blank names;
- warm SWR cache entries using the same key builder and fetcher used by the modal;
- run as a background best-effort effect after mount.

`ExerciseHistoryModal` will continue to fetch on open with the same SWR key. If prefetch completed, the modal should render cached history immediately. If prefetch is still in flight or failed, the modal keeps its current loading or error behavior.

## Components

### Shared Exercise History Helpers

Export the history SWR key builder and fetcher from the exercise history module or a nearby helper module. The modal and duplicate prefetch helper will both depend on these shared helpers.

The key must remain scoped by:

- a stable history namespace;
- the current Clerk user id, falling back to the current signed-out sentinel used by the modal;
- the exercise name.

### Duplicate History Prefetch Helper

Add a small component under `components/workout-form/` that accepts:

```ts
exerciseNames: string[];
```

It will use `useSWRConfig().mutate(...)` to populate each exercise history key. The helper renders nothing and owns no form state.

### Workout Form Seed And Props

Extend `WorkoutFormSeed`, `CreateWorkoutFormSeed`, and `WorkoutFormProps` to support the optional `historyPrefetchExerciseNames` property.

`buildDuplicateWorkoutFormSeed()` sets it from the source workout exercises. `buildBlankWorkoutFormSeed()` and `buildEditWorkoutFormSeed()` omit it.

## Error Handling

Prefetch is best-effort. Errors from background fetches should not show a toast, block form interaction, or alter save behavior. If the user opens history for an exercise whose prefetch failed, the existing modal fetch/error flow handles the failure.

## Performance

This design intentionally avoids a new batch API endpoint. A duplicate workout usually contains a small number of distinct exercise names, and this change limits background requests to duplicate forms only.

The prefetch helper should dedupe names before starting requests. It should also rely on SWR cache behavior so the modal and prefetch helper do not maintain separate caches.

## Tests

Add or update focused tests for:

- duplicate form seeds include copied exercise names in `historyPrefetchExerciseNames`;
- create and edit form seeds do not include prefetch names;
- duplicate names are deduped by the prefetch helper;
- the prefetch helper warms the same SWR key used by `ExerciseHistoryModal`;
- modal behavior remains unchanged for loading, cache, user scoping, filtering, and errors.

Existing route tests for `/api/exercises/history` should continue to pass unchanged because this design does not change the API contract.
