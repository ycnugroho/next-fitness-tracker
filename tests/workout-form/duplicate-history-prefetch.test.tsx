// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import useSWR, { SWRConfig, unstable_serialize } from "swr";
import {
  getExerciseHistory,
  getExerciseHistoryKey,
  type ExerciseHistoryKey,
} from "@/components/exercise/exercise-history-data";
import DuplicateWorkoutHistoryPrefetch from "@/components/workout-form/duplicate-history-prefetch";

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

function historyResponse(workoutName: string) {
  return new Response(
    JSON.stringify([
      {
        date: "2026-04-02",
        notes: "",
        workoutId: 11,
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

function cacheKey(exerciseName: string) {
  const historyKey: ExerciseHistoryKey = getExerciseHistoryKey({
    exerciseName,
    userId: authState.userId,
  });

  return unstable_serialize(historyKey);
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
  });
}

function HistoryConsumer({ exerciseName }: { exerciseName: string }) {
  useSWR(
    getExerciseHistoryKey({ exerciseName, userId: authState.userId }),
    () => getExerciseHistory(exerciseName),
    {
      dedupingInterval: 0,
    },
  );

  return null;
}

describe("DuplicateWorkoutHistoryPrefetch", () => {
  beforeEach(() => {
    authState.userId = "user-1";
    authState.isLoaded = true;
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("dedupes, trims, skips blank exercise names, and warms exercise history cache", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(historyResponse("Bench History"))
      .mockResolvedValueOnce(historyResponse("Squat History"));
    const cache = new Map();

    render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch
          exerciseNames={[
            " Bench Press ",
            "",
            "Bench Press",
            "   ",
            "Squat",
          ]}
        />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(cache.get(cacheKey("Bench Press"))?.data).toEqual([
        {
          date: "2026-04-02",
          notes: "",
          workoutId: 11,
          workoutName: "Bench History",
          sets: [],
        },
      ]);
      expect(cache.get(cacheKey("Squat"))?.data).toEqual([
        {
          date: "2026-04-02",
          notes: "",
          workoutId: 11,
          workoutName: "Squat History",
          sets: [],
        },
      ]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/exercises/history?name=Bench%20Press",
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/exercises/history?name=Squat",
    );
  });

  it("does not refetch a history key that is already cached", async () => {
    const fetchMock = vi.mocked(fetch);
    const cache = new Map([
      [
        cacheKey("Bench Press"),
        {
          data: [
            {
              date: "2026-04-01",
              notes: "Existing",
              workoutId: 10,
              workoutName: "Cached Bench History",
              sets: [],
            },
          ],
        },
      ],
    ]);

    render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await flushEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.get(cacheKey("Bench Press"))?.data).toEqual([
      {
        date: "2026-04-01",
        notes: "Existing",
        workoutId: 10,
        workoutName: "Cached Bench History",
        sets: [],
      },
    ]);
  });

  it("waits until Clerk auth has loaded before prefetching", async () => {
    authState.isLoaded = false;
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(historyResponse("Bench History"));
    const cache = new Map();
    const { rerender } = render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await flushEffects();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.get(cacheKey("Bench Press"))).toBeUndefined();

    authState.isLoaded = true;
    rerender(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(cache.get(cacheKey("Bench Press"))?.data).toEqual([
        {
          date: "2026-04-02",
          notes: "",
          workoutId: 11,
          workoutName: "Bench History",
          sets: [],
        },
      ]);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares an in-flight prefetch with normal exercise history readers", async () => {
    const fetchMock = vi.mocked(fetch);
    const pendingHistory = new Promise<Response>(() => {});
    fetchMock.mockReturnValue(pendingHistory);
    const cache = new Map();

    const { rerender } = render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
        <HistoryConsumer exerciseName="Bench Press" />
      </SWRConfig>,
    );
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not refetch prefetched history on window focus or reconnect", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce(historyResponse("Bench History"))
      .mockResolvedValue(historyResponse("Unexpected Refetch"));
    const cache = new Map();
    let triggerFocus: (() => void) | undefined;
    let triggerReconnect: (() => void) | undefined;

    render(
      <SWRConfig
        value={{
          provider: () => cache,
          dedupingInterval: 0,
          initFocus: (callback) => {
            triggerFocus = callback;
            return () => {};
          },
          initReconnect: (callback) => {
            triggerReconnect = callback;
            return () => {};
          },
        }}
      >
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(cache.get(cacheKey("Bench Press"))?.data).toEqual([
        {
          date: "2026-04-02",
          notes: "",
          workoutId: 11,
          workoutName: "Bench History",
          sets: [],
        },
      ]);
    });

    await act(async () => {
      triggerFocus?.();
      triggerReconnect?.();
    });
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats fetch failures as best-effort background work", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        statusText: "Not Found",
        headers: {
          "Content-Type": "application/json",
        },
      }),
    );
    const cache = new Map();

    const { rerender } = render(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    rerender(
      <SWRConfig value={{ provider: () => cache }}>
        <DuplicateWorkoutHistoryPrefetch exerciseNames={["Bench Press"]} />
      </SWRConfig>,
    );
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.get(cacheKey("Bench Press"))?.data).toBeUndefined();
  });
});
