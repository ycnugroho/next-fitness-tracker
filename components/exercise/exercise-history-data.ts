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

export type ExerciseHistoryKey = ReturnType<typeof getExerciseHistoryKey>;

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
