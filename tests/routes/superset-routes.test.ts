/**
 * tests/routes/superset-routes.test.ts
 *
 * Integration tests for superset persistence through the real route handlers.
 * Uses a real file-based SQLite DB (via createRouteTestDatabase) — no query mocks.
 *
 * Mocks registered here (must be inline — not via support file — so vi.mock
 * hoisting fires before db/drizzle.ts module-level createClient() runs):
 *   - @/db/drizzle   → getter that returns the test DB instance
 *   - iron-session   → returns sessionState
 *   - next/headers   → cookies() stub
 *   - @/lib/session  → sessionOptions stub
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createRouteTestDatabase,
  destroyRouteTestDatabase,
  seedWorkout,
  type RouteTestDatabase,
} from "@/tests/support/route-test-db";

// ─── DB / session mocks (hoisted) ────────────────────────────────────────────

const dbRef = { current: null as RouteTestDatabase["db"] | null };

const sessionState = { isLoggedIn: false, userId: 0, username: "" };

vi.mock("@/db/drizzle", () => ({
  get db() {
    if (!dbRef.current) throw new Error("Test DB not initialised");
    return dbRef.current;
  },
}));
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => ({
    isLoggedIn: sessionState.isLoggedIn,
    userId: sessionState.userId,
    username: sessionState.username,
    save: vi.fn(),
    destroy: vi.fn(),
  })),
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("@/lib/session", () => ({ sessionOptions: {} }));

// ─── Route handlers (imported AFTER mocks) ────────────────────────────────────

import { POST as createWorkout } from "@/app/api/workouts/route";
import {
  GET as getWorkout,
  PATCH as patchWorkout,
} from "@/app/api/workouts/[id]/route";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setUserId(userId: number | null) {
  sessionState.isLoggedIn = userId !== null;
  sessionState.userId = userId ?? 0;
  sessionState.username = userId !== null ? `user-${userId}` : "";
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/workouts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patchRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/workouts/1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function getRequest(): NextRequest {
  return new NextRequest("http://localhost/api/workouts/1");
}

function idCtx(id: number | string) {
  return { params: Promise.resolve({ id: String(id) }) };
}

// ─── Shared superset payload ──────────────────────────────────────────────────

const SUPERSET_PAYLOAD = {
  name: "Superset Workout",
  notes: "",
  durationMinutes: null,
  date: "2026-06-10",
  exercises: [
    {
      name: "Curl",
      notes: "",
      supersetGroupId: "arms-ss",
      sets: [{ reps: "12", weight: "15", rpe: "7" }],
    },
    {
      name: "Tricep Dip",
      notes: "",
      supersetGroupId: "arms-ss",
      sets: [{ reps: "12", weight: "0", rpe: "7" }],
    },
  ],
};

// ═════════════════════════════════════════════════════════════════════════════
// Suite
// ═════════════════════════════════════════════════════════════════════════════

describe("Superset integration — route handlers", () => {
  let database: RouteTestDatabase;

  beforeEach(async () => {
    database = await createRouteTestDatabase();
    dbRef.current = database.db;
    setUserId(1);
  });

  afterEach(async () => {
    dbRef.current = null;
    setUserId(null);
    await destroyRouteTestDatabase(database);
  });

  // ── save workout with supersets ─────────────────────────────────────────

  it("saves a workout with a valid 2-exercise superset and returns 201", async () => {
    const res = await createWorkout(postRequest(SUPERSET_PAYLOAD));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workoutId).toBeGreaterThan(0);
  });

  it("saves a 3-exercise superset correctly", async () => {
    const payload = {
      ...SUPERSET_PAYLOAD,
      exercises: [
        { name: "A", notes: "", supersetGroupId: "triple-ss", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
        { name: "B", notes: "", supersetGroupId: "triple-ss", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
        { name: "C", notes: "", supersetGroupId: "triple-ss", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
      ],
    };
    const res = await createWorkout(postRequest(payload));
    expect(res.status).toBe(201);
  });

  it("saves a workout with multiple distinct superset groups", async () => {
    const payload = {
      ...SUPERSET_PAYLOAD,
      exercises: [
        { name: "Curl",       notes: "", supersetGroupId: "arms-ss", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", notes: "", supersetGroupId: "arms-ss", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
        { name: "Squat",      notes: "", supersetGroupId: "legs-ss", sets: [{ reps: "8",  weight: "80", rpe: "8" }] },
        { name: "Leg Press",  notes: "", supersetGroupId: "legs-ss", sets: [{ reps: "10", weight: "60", rpe: "7" }] },
      ],
    };
    const res = await createWorkout(postRequest(payload));
    expect(res.status).toBe(201);
  });

  // ── retrieve workout with supersets ────────────────────────────────────

  it("retrieves a workout with supersetGroupId preserved on exercises", async () => {
    const createRes = await createWorkout(postRequest(SUPERSET_PAYLOAD));
    const { workoutId } = await createRes.json();

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    expect(getRes.status).toBe(200);

    const workout = await getRes.json();
    expect(workout.exercises).toHaveLength(2);
    expect(workout.exercises[0].supersetGroupId).toBe("arms-ss");
    expect(workout.exercises[1].supersetGroupId).toBe("arms-ss");
  });

  it("retrieves non-superset exercises with supersetGroupId as null", async () => {
    const payload = {
      ...SUPERSET_PAYLOAD,
      exercises: [
        { name: "Solo A", notes: "", supersetGroupId: null, sets: [{ reps: "5", weight: "100", rpe: "8" }] },
        { name: "Solo B", notes: "", supersetGroupId: null, sets: [{ reps: "8", weight: "60",  rpe: "7" }] },
      ],
    };
    const createRes = await createWorkout(postRequest(payload));
    const { workoutId } = await createRes.json();

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();

    expect(workout.exercises[0].supersetGroupId).toBeNull();
    expect(workout.exercises[1].supersetGroupId).toBeNull();
  });

  it("retrieves multiple superset groups with correct groupIds", async () => {
    const payload = {
      ...SUPERSET_PAYLOAD,
      exercises: [
        { name: "Curl",       notes: "", supersetGroupId: "arms-ss", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", notes: "", supersetGroupId: "arms-ss", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
        { name: "Squat",      notes: "", supersetGroupId: "legs-ss", sets: [{ reps: "8",  weight: "80", rpe: "8" }] },
        { name: "Leg Press",  notes: "", supersetGroupId: "legs-ss", sets: [{ reps: "10", weight: "60", rpe: "7" }] },
      ],
    };
    const createRes = await createWorkout(postRequest(payload));
    const { workoutId } = await createRes.json();

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();

    expect(workout.exercises[0].supersetGroupId).toBe("arms-ss");
    expect(workout.exercises[1].supersetGroupId).toBe("arms-ss");
    expect(workout.exercises[2].supersetGroupId).toBe("legs-ss");
    expect(workout.exercises[3].supersetGroupId).toBe("legs-ss");
  });

  it("retrieves exercises in insertion order (sets also ordered)", async () => {
    const createRes = await createWorkout(postRequest(SUPERSET_PAYLOAD));
    const { workoutId } = await createRes.json();

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();

    expect(workout.exercises[0].name).toBe("Curl");
    expect(workout.exercises[1].name).toBe("Tricep Dip");
    expect(workout.exercises[0].sets[0]).toMatchObject({ reps: "12", weight: "15", rpe: "7" });
  });

  // ── update supersets ────────────────────────────────────────────────────

  it("updates a workout to add supersets where there were none", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1,
      name: "Plain Workout",
      date: "2026-06-01",
      exercises: [
        { name: "Squat",  sets: [{ reps: "5", weight: "100", rpe: "8" }] },
        { name: "Lunge",  sets: [{ reps: "10", weight: "40", rpe: "7" }] },
      ],
    });

    const patchRes = await patchWorkout(
      patchRequest({
        name: "Plain Workout",
        notes: "",
        durationMinutes: null,
        date: "2026-06-01",
        exercises: [
          { name: "Squat", notes: "", supersetGroupId: "legs-ss", sets: [{ reps: "5", weight: "100", rpe: "8" }] },
          { name: "Lunge", notes: "", supersetGroupId: "legs-ss", sets: [{ reps: "10", weight: "40", rpe: "7" }] },
        ],
      }),
      idCtx(workoutId),
    );
    expect(patchRes.status).toBe(200);

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();
    expect(workout.exercises[0].supersetGroupId).toBe("legs-ss");
    expect(workout.exercises[1].supersetGroupId).toBe("legs-ss");
  });

  it("updates a workout to remove supersets (set groupId to null)", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1,
      name: "Superset Workout",
      date: "2026-06-01",
      exercises: [
        { name: "Curl",       supersetGroupId: "arms-ss", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", supersetGroupId: "arms-ss", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
      ],
    });

    const patchRes = await patchWorkout(
      patchRequest({
        name: "Superset Workout",
        notes: "",
        durationMinutes: null,
        date: "2026-06-01",
        exercises: [
          { name: "Curl",       notes: "", supersetGroupId: null, sets: [{ reps: "12", weight: "15", rpe: "7" }] },
          { name: "Tricep Dip", notes: "", supersetGroupId: null, sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
        ],
      }),
      idCtx(workoutId),
    );
    expect(patchRes.status).toBe(200);

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();
    expect(workout.exercises[0].supersetGroupId).toBeNull();
    expect(workout.exercises[1].supersetGroupId).toBeNull();
  });

  it("updates a workout to change which exercises are in the superset", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1,
      name: "Workout",
      date: "2026-06-01",
      exercises: [
        { name: "A", supersetGroupId: "ss-old", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
        { name: "B", supersetGroupId: "ss-old", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
        { name: "C", supersetGroupId: null,     sets: [{ reps: "10", weight: "20", rpe: "7" }] },
      ],
    });

    // Swap: C joins B in a new superset, A stands alone
    const patchRes = await patchWorkout(
      patchRequest({
        name: "Workout",
        notes: "",
        durationMinutes: null,
        date: "2026-06-01",
        exercises: [
          { name: "A", notes: "", supersetGroupId: null,     sets: [{ reps: "10", weight: "20", rpe: "7" }] },
          { name: "B", notes: "", supersetGroupId: "ss-new", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
          { name: "C", notes: "", supersetGroupId: "ss-new", sets: [{ reps: "10", weight: "20", rpe: "7" }] },
        ],
      }),
      idCtx(workoutId),
    );
    expect(patchRes.status).toBe(200);

    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();
    expect(workout.exercises[0].supersetGroupId).toBeNull();
    expect(workout.exercises[1].supersetGroupId).toBe("ss-new");
    expect(workout.exercises[2].supersetGroupId).toBe("ss-new");
  });

  // ── reject invalid superset configuration ──────────────────────────────

  it("rejects a workout where a superset group has only 1 exercise (returns 400)", async () => {
    const payload = {
      ...SUPERSET_PAYLOAD,
      exercises: [
        { name: "Lone Wolf", notes: "", supersetGroupId: "solo-ss", sets: [{ reps: "10", weight: "50", rpe: "8" }] },
      ],
    };
    const res = await createWorkout(postRequest(payload));
    expect(res.status).toBe(400);
  });

  it("rejects a workout where superset members are non-adjacent (returns 400)", async () => {
    const payload = {
      ...SUPERSET_PAYLOAD,
      exercises: [
        { name: "A", notes: "", supersetGroupId: "ss-gap", sets: [{ reps: "10", weight: "50", rpe: "8" }] },
        { name: "B", notes: "", supersetGroupId: null,     sets: [{ reps: "10", weight: "50", rpe: "8" }] },
        { name: "C", notes: "", supersetGroupId: "ss-gap", sets: [{ reps: "10", weight: "50", rpe: "8" }] },
      ],
    };
    const res = await createWorkout(postRequest(payload));
    expect(res.status).toBe(400);
  });

  it("rejects a PATCH with an invalid superset (lone groupId) and leaves the workout unchanged", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1,
      name: "Stable Workout",
      date: "2026-06-01",
      exercises: [
        { name: "Squat", sets: [{ reps: "5", weight: "100", rpe: "8" }] },
      ],
    });

    const patchRes = await patchWorkout(
      patchRequest({
        name: "Stable Workout",
        notes: "",
        durationMinutes: null,
        date: "2026-06-01",
        exercises: [
          { name: "Squat", notes: "", supersetGroupId: "lonely-ss", sets: [{ reps: "5", weight: "100", rpe: "8" }] },
        ],
      }),
      idCtx(workoutId),
    );
    expect(patchRes.status).toBe(400);

    // Original workout untouched
    const getRes = await getWorkout(getRequest(), idCtx(workoutId));
    const workout = await getRes.json();
    expect(workout.exercises[0].supersetGroupId).toBeNull();
  });

  it("rejects a PATCH with non-adjacent superset members", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1,
      name: "Workout",
      date: "2026-06-01",
    });

    const patchRes = await patchWorkout(
      patchRequest({
        name: "Workout",
        notes: "",
        durationMinutes: null,
        date: "2026-06-01",
        exercises: [
          { name: "A", notes: "", supersetGroupId: "ss",   sets: [] },
          { name: "B", notes: "", supersetGroupId: null,   sets: [] },
          { name: "C", notes: "", supersetGroupId: "ss",   sets: [] },
        ],
      }),
      idCtx(workoutId),
    );
    expect(patchRes.status).toBe(400);
  });
});