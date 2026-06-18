import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import {
  setupRouteTestDatabase,
  setRouteTestUserId,
  teardownRouteTestDatabase,
} from "@/tests/support/route-handler-test";
import { seedWorkout, type RouteTestDatabase } from "@/tests/support/route-test-db";
import { POST as createWorkout } from "@/app/api/workouts/route";
import {
  GET as getWorkout,
  PATCH as patchWorkout,
  DELETE as deleteWorkout,
} from "@/app/api/workouts/[id]/route";

const PAYLOAD = {
  name: "Push Day", notes: "Felt strong", durationMinutes: 60, date: "2026-06-01",
  exercises: [
    { name: "Bench Press", notes: "", supersetGroupId: null,
      sets: [{ weight: "80", reps: "10", rpe: "8" }, { weight: "85", reps: "8", rpe: "9" }] },
  ],
} as const;

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/workouts", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
const ctx = (id: string | number) => ({ params: Promise.resolve({ id: String(id) }) });

let database: RouteTestDatabase;
beforeAll(async () => { database = await setupRouteTestDatabase(); });
afterAll(async () => { await teardownRouteTestDatabase(database); });
beforeEach(() => { setRouteTestUserId("user-1"); });

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/workouts", () => {
  it("creates and persists a workout with exercises and sets", async () => {
    const res = await createWorkout(req("POST", PAYLOAD));
    expect(res.status).toBe(201);
    const { workoutId, message } = await res.json();
    expect(message).toBe("Workout created");
    expect(workoutId).toBeGreaterThan(0);

    const getRes = await getWorkout(req("GET"), ctx(workoutId));
    const workout = await getRes.json();
    expect(workout.name).toBe("Push Day");
    expect(workout.exercises[0].sets).toHaveLength(2);
  });

  it("persists multiple exercises in order", async () => {
    const payload = {
      ...PAYLOAD, name: "Full Push",
      exercises: [
        { name: "Bench Press", notes: "", supersetGroupId: null, sets: [{ weight: "80", reps: "10", rpe: "8" }] },
        { name: "OHP", notes: "", supersetGroupId: null, sets: [{ weight: "60", reps: "8", rpe: "7" }, { weight: "62.5", reps: "6", rpe: "8" }] },
      ],
    };
    const { workoutId } = await (await createWorkout(req("POST", payload))).json();
    const workout = await (await getWorkout(req("GET"), ctx(workoutId))).json();
    expect(workout.exercises[0].name).toBe("Bench Press");
    expect(workout.exercises[1].name).toBe("OHP");
    expect(workout.exercises[1].sets).toHaveLength(2);
  });

  it("persists valid superset and rejects invalid ones", async () => {
    // valid superset
    const validRes = await createWorkout(req("POST", {
      ...PAYLOAD,
      exercises: [
        { name: "Cable Fly", notes: "", supersetGroupId: "ss", sets: [{ weight: "30", reps: "12", rpe: "7" }] },
        { name: "Push-up",   notes: "", supersetGroupId: "ss", sets: [{ weight: "0",  reps: "20", rpe: "6" }] },
      ],
    }));
    expect(validRes.status).toBe(201);

    // lone superset member
    expect((await createWorkout(req("POST", {
      ...PAYLOAD,
      exercises: [{ name: "X", notes: "", supersetGroupId: "ss-solo", sets: [] }],
    }))).status).toBe(400);

    // non-adjacent
    expect((await createWorkout(req("POST", {
      ...PAYLOAD,
      exercises: [
        { name: "A", notes: "", supersetGroupId: "ss", sets: [] },
        { name: "B", notes: "", supersetGroupId: null,  sets: [] },
        { name: "C", notes: "", supersetGroupId: "ss", sets: [] },
      ],
    }))).status).toBe(400);
  });

  it("returns 400 for invalid payloads (missing name, date, exercises; empty name; bad date; bad JSON)", async () => {
    const { name: _n, ...noName } = PAYLOAD;
    expect((await createWorkout(req("POST", noName))).status).toBe(400);
    expect((await createWorkout(req("POST", { ...PAYLOAD, name: "" }))).status).toBe(400);
    expect((await createWorkout(req("POST", { ...PAYLOAD, name: "A".repeat(51) }))).status).toBe(400);
    const { date: _d, ...noDate } = PAYLOAD;
    expect((await createWorkout(req("POST", noDate))).status).toBe(400);
    expect((await createWorkout(req("POST", { ...PAYLOAD, date: "01/06/2026" }))).status).toBe(400);
    const { exercises: _e, ...noEx } = PAYLOAD;
    expect((await createWorkout(req("POST", noEx))).status).toBe(400);
    expect((await createWorkout(new NextRequest("http://localhost/api/workouts", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: "{ not json }",
    }))).status).toBe(400);
  });

  it("returns 401 when unauthenticated", async () => {
    setRouteTestUserId(null);
    const res = await createWorkout(req("POST", PAYLOAD));
    expect(res.status).toBe(401);
  });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/workouts/[id]", () => {
  it("returns full workout with exercises, sets, and supersetGroupId for owner", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1, name: "Leg Day", date: "2026-06-10",
      exercises: [
        { name: "Squat", notes: "ATG", supersetGroupId: null, sets: [{ reps: "5", weight: "100", rpe: "8" }, { reps: "5", weight: "100", rpe: "9" }] },
        { name: "Curl",  notes: "", supersetGroupId: "arms", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Dip",   notes: "", supersetGroupId: "arms", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
      ],
    });
    const workout = await (await getWorkout(req("GET"), ctx(workoutId))).json();
    expect(workout).toMatchObject({ id: workoutId, name: "Leg Day", date: "2026-06-10", userId: 1 });
    expect(workout.exercises[0].sets).toHaveLength(2);
    expect(workout.exercises[0].sets[0]).toMatchObject({ weight: "100", reps: "5", rpe: "8" });
    expect(workout.exercises[1].supersetGroupId).toBe("arms");
    expect(workout.exercises[2].supersetGroupId).toBe("arms");
  });

  it("returns 404 for non-existent workout and for another user's workout", async () => {
    expect((await getWorkout(req("GET"), ctx(99999))).status).toBe(404);

    const workoutId = await seedWorkout(database, { userId: 1, name: "Mine", date: "2026-06-12" });
    setRouteTestUserId("user-2");
    expect((await getWorkout(req("GET"), ctx(workoutId))).status).toBe(404);
  });

  it("returns 400 for invalid ids and 401 when unauthenticated", async () => {
    expect((await getWorkout(req("GET"), ctx("abc"))).status).toBe(400);
    expect((await getWorkout(req("GET"), ctx("0"))).status).toBe(400);
    expect((await getWorkout(req("GET"), ctx("-5"))).status).toBe(400);
    setRouteTestUserId(null);
    expect((await getWorkout(req("GET"), ctx(1))).status).toBe(401);
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe("PATCH /api/workouts/[id]", () => {
  it("updates metadata and replaces exercises; returns { message: 'Workout updated' }", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1, name: "Old", notes: "old", date: "2026-06-01",
      exercises: [{ name: "Old Exercise", notes: "", sets: [{ reps: "10", weight: "50", rpe: "7" }] }],
    });

    const res = await patchWorkout(req("PATCH", {
      name: "New Name", notes: "new", durationMinutes: 75, date: "2026-06-15",
      exercises: [
        { name: "New A", notes: "", supersetGroupId: null, sets: [{ weight: "60", reps: "8", rpe: "8" }] },
        { name: "New B", notes: "", supersetGroupId: null, sets: [{ weight: "40", reps: "12", rpe: "6" }, { weight: "42.5", reps: "10", rpe: "7" }] },
      ],
    }), ctx(workoutId));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ message: "Workout updated" });

    const updated = await (await getWorkout(req("GET"), ctx(workoutId))).json();
    expect(updated).toMatchObject({ name: "New Name", notes: "new", durationMinutes: 75, date: "2026-06-15" });
    const names = updated.exercises.map((e: { name: string }) => e.name);
    expect(names).not.toContain("Old Exercise");
    expect(names).toContain("New A");
    expect(names).toContain("New B");
    expect(updated.exercises.find((e: { name: string }) => e.name === "New B").sets).toHaveLength(2);
  });

  it("updates superset membership and clears all exercises when array is empty", async () => {
    const wId = await seedWorkout(database, { userId: 1, name: "W", date: "2026-06-02" });

    // add superset
    await patchWorkout(req("PATCH", {
      name: "W", notes: "", durationMinutes: null, date: "2026-06-02",
      exercises: [
        { name: "Pull-up",   notes: "", supersetGroupId: "back", sets: [{ weight: "0",  reps: "8",  rpe: "8" }] },
        { name: "Face Pull", notes: "", supersetGroupId: "back", sets: [{ weight: "20", reps: "15", rpe: "6" }] },
      ],
    }), ctx(wId));
    const withSS = await (await getWorkout(req("GET"), ctx(wId))).json();
    expect(withSS.exercises[0].supersetGroupId).toBe("back");

    // clear exercises
    await patchWorkout(req("PATCH", { name: "W", notes: "", durationMinutes: null, date: "2026-06-02", exercises: [] }), ctx(wId));
    expect((await (await getWorkout(req("GET"), ctx(wId))).json()).exercises).toHaveLength(0);
  });

  it("returns 400 for invalid payloads and invalid superset config", async () => {
    const wId = await seedWorkout(database, { userId: 1, date: "2026-06-01" });
    expect((await patchWorkout(req("PATCH", { ...PAYLOAD, name: "" }), ctx(wId))).status).toBe(400);
    expect((await patchWorkout(req("PATCH", { ...PAYLOAD, exercises: [{ name: "X", notes: "", supersetGroupId: "solo", sets: [] }] }), ctx(wId))).status).toBe(400);
    expect((await patchWorkout(req("PATCH", { ...PAYLOAD, exercises: [
      { name: "A", notes: "", supersetGroupId: "ss", sets: [] },
      { name: "B", notes: "", supersetGroupId: null, sets: [] },
      { name: "C", notes: "", supersetGroupId: "ss", sets: [] },
    ] }), ctx(wId))).status).toBe(400);
    expect((await patchWorkout(req("PATCH", PAYLOAD), ctx("not-a-number"))).status).toBe(400);
  });

  it("returns 404 for non-existent / other user's workout, 401 when unauthenticated", async () => {
    expect((await patchWorkout(req("PATCH", PAYLOAD), ctx(99999))).status).toBe(404);

    const wId = await seedWorkout(database, { userId: 1, name: "Mine", date: "2026-06-01" });
    setRouteTestUserId("user-2");
    expect((await patchWorkout(req("PATCH", PAYLOAD), ctx(wId))).status).toBe(404);

    setRouteTestUserId(null);
    expect((await patchWorkout(req("PATCH", PAYLOAD), ctx(1))).status).toBe(401);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/workouts/[id]", () => {
  it("deletes workout and cascades to exercises/sets; subsequent GET returns 404", async () => {
    const workoutId = await seedWorkout(database, {
      userId: 1, name: "To Delete", date: "2026-06-01",
      exercises: [{ name: "Squat", notes: "", sets: [{ reps: "5", weight: "100", rpe: "9" }, { reps: "5", weight: "100", rpe: "9" }] }],
    });

    const res = await deleteWorkout(req("DELETE"), ctx(workoutId));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Workout successfully deleted");
    expect((await getWorkout(req("GET"), ctx(workoutId))).status).toBe(404);
  });

  it("ownership enforced: other user gets 404 but original owner can still access", async () => {
    const workoutId = await seedWorkout(database, { userId: 1, name: "Not Yours", date: "2026-06-01" });
    setRouteTestUserId("user-2");
    expect((await deleteWorkout(req("DELETE"), ctx(workoutId))).status).toBe(404);
    setRouteTestUserId("user-1");
    expect((await getWorkout(req("GET"), ctx(workoutId))).status).toBe(200);
  });

  it("returns 404 for non-existent, 400 for invalid ids, 401 when unauthenticated", async () => {
    expect((await deleteWorkout(req("DELETE"), ctx(99999))).status).toBe(404);
    expect((await deleteWorkout(req("DELETE"), ctx("bad-id"))).status).toBe(400);
    expect((await deleteWorkout(req("DELETE"), ctx("0"))).status).toBe(400);
    setRouteTestUserId(null);
    expect((await deleteWorkout(req("DELETE"), ctx(1))).status).toBe(401);
  });
});
