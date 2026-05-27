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
