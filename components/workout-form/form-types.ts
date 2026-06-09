import type { ExerciseThin, TWorkoutFormSchema } from "@/lib/types";

export type PersistMode = "create" | "update";
export type WorkoutFormSeedMode = "create" | "edit" | "duplicate";

export type WorkoutDraft = TWorkoutFormSchema;

export type ExerciseTemplateValues = ExerciseThin;
export type ExerciseTemplateValuesByName = Record<
  string,
  ExerciseTemplateValues
>;

export type WorkoutFormSeed = {
  initialValues: WorkoutDraft;
  persistMode: PersistMode;
  exerciseNames: string[];
  workoutId?: number;
  templateValuesByExerciseName?: ExerciseTemplateValuesByName;
  historyPrefetchExerciseNames?: string[];
};

export type CreateWorkoutFormSeed = Omit<WorkoutFormSeed, "persistMode"> & {
  persistMode: "create";
};

type BaseWorkoutFormProps = {
  initialValues: WorkoutDraft;
  exerciseNames: string[];
  templateValuesByExerciseName?: ExerciseTemplateValuesByName;
  historyPrefetchExerciseNames?: string[];
};

type CreateWorkoutFormProps = BaseWorkoutFormProps & {
  persistMode: "create";
};

export type UpdateWorkoutFormProps = BaseWorkoutFormProps & {
  persistMode: "update";
  workoutId: number;
  historyPrefetchExerciseNames?: never;
};

export type WorkoutFormProps = CreateWorkoutFormProps | UpdateWorkoutFormProps;
