import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createRouteTestDatabase,
  destroyRouteTestDatabase,
  seedWorkout,
  type RouteTestDatabase,
} from "@/tests/support/route-test-db";

const dbRef = { current: null as RouteTestDatabase["db"] | null };
const sessionState = { isLoggedIn: false, userId: 0, username: "" };

vi.mock("@/db/drizzle", () => ({
  get db() {
    if (!dbRef.current) throw new Error("Test DB not initialised");
    return dbRef.current;
  },
}));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({})) }));
vi.mock("iron-session", () => ({
  getIronSession: vi.fn(async () => ({
    isLoggedIn: sessionState.isLoggedIn,
    userId: sessionState.userId,
    username: sessionState.username,
    save: vi.fn(),
    destroy: vi.fn(),
  })),
}));
vi.mock("@/lib/session", () => ({ sessionOptions: {} }));

import { GET } from "@/app/api/exercises/history/route";

function makeRequest(name?: string): NextRequest {
  const url =
    name !== undefined
      ? `http://localhost/api/exercises/history?name=${encodeURIComponent(name)}`
      : "http://localhost/api/exercises/history";
  return new NextRequest(url);
}

function setUserId(userId: number | null) {
  sessionState.isLoggedIn = userId !== null;
  sessionState.userId = userId ?? 0;
  sessionState.username = userId !== null ? `user-${userId}` : "";
}

describe("GET /api/exercises/history", () => {
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

  it("returns 401 for unauthenticated requests", async () => {
    setUserId(null);
    expect((await GET(makeRequest("Squat"))).status).toBe(401);
  });

  it("returns 400 for missing, empty, or whitespace-only exercise name", async () => {
    expect((await GET(makeRequest())).status).toBe(400);
    expect((await GET(makeRequest(""))).status).toBe(400);
    expect((await GET(makeRequest("   "))).status).toBe(400);
  });

  it("returns history for the authenticated user in newest-first order", async () => {
    for (const [date, name] of [
      ["2026-03-01", "Old Push Day"],
      ["2026-05-15", "Recent Push Day"],
      ["2026-04-10", "Mid Push Day"],
    ]) {
      await seedWorkout(database, {
        userId: 1,
        date,
        name,
        exercises: [{ name: "Bench Press", sets: [{ reps: "5", weight: "80" }] }],
      });
    }

    const body = await (await GET(makeRequest("Bench Press"))).json();

    expect(body).toHaveLength(3);
    expect(body[0].date).toBe("2026-05-15");
    expect(body[1].date).toBe("2026-04-10");
    expect(body[2].date).toBe("2026-03-01");
  });

  it("excludes other users' data and other exercises in the same workout", async () => {
    await seedWorkout(database, {
      userId: 1,
      date: "2026-05-01",
      name: "My Workout",
      exercises: [
        { name: "Squat", sets: [{ reps: "5", weight: "100" }] },
        { name: "Lunge", sets: [{ reps: "10", weight: "40" }] },
      ],
    });
    await seedWorkout(database, {
      userId: 2,
      date: "2026-05-02",
      name: "Other User Workout",
      exercises: [{ name: "Squat", sets: [{ reps: "5", weight: "120" }] }],
    });

    const body = await (await GET(makeRequest("Squat"))).json();

    expect(body).toHaveLength(1);
    expect(body[0].workoutName).toBe("My Workout");
    // Only Squat's sets — Lunge sets must not appear
    expect(body[0].sets).toHaveLength(1);
  });

  it("returns an empty array when no history exists for the exercise", async () => {
    const body = await (await GET(makeRequest("Squat"))).json();
    expect(body).toEqual([]);
  });

  it("returns the correct response shape with sets in ascending id order", async () => {
    await seedWorkout(database, {
      userId: 1,
      date: "2026-06-01",
      name: "Upper A",
      exercises: [
        {
          name: "Overhead Press",
          notes: "Focus on lockout",
          sets: [
            { reps: "5", weight: "60", rpe: "7" },
            { reps: "5", weight: "60", rpe: "8" },
          ],
        },
      ],
    });

    const body = await (await GET(makeRequest("Overhead Press"))).json();
    const entry = body[0];

    expect(entry).toMatchObject({
      date: "2026-06-01",
      workoutName: "Upper A",
      notes: "Focus on lockout",
    });
    expect(typeof entry.workoutId).toBe("number");
    expect(entry.sets).toHaveLength(2);
    expect(entry.sets[0]).toMatchObject({ reps: "5", weight: "60", rpe: "7" });

    const ids: number[] = entry.sets.map((s: { id: number }) => s.id);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });
});
