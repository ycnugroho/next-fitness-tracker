/**
 * tests/routes/export-route.test.ts
 *
 * Integration tests for GET /api/export
 * Uses a real SQLite DB — no query mocks.
 * Verifies actual CSV text output, not implementation details.
 *
 * Note on CSV format: the xlsx library serialises single-cell rows with a
 * trailing comma (e.g. "Squat,"). The csvRows() / findRow() helpers below
 * normalise each row by stripping trailing commas before matching, so
 * assertions can use plain strings like "Squat" and "Superset".
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createRouteTestDatabase,
  destroyRouteTestDatabase,
  seedWorkout,
  type RouteTestDatabase,
} from "@/tests/support/route-test-db";

// ─── Mocks (hoisted before db/drizzle.ts module load) ────────────────────────

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

// ─── Route handler (imported AFTER mocks) ────────────────────────────────────

import { GET } from "@/app/api/export/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setUserId(userId: number | null) {
  sessionState.isLoggedIn = userId !== null;
  sessionState.userId = userId ?? 0;
  sessionState.username = userId !== null ? `user-${userId}` : "";
}

function makeRequest(fileType?: string): NextRequest {
  const url = fileType
    ? `http://localhost/api/export?fileType=${fileType}`
    : "http://localhost/api/export";
  return new NextRequest(url);
}

async function asText(response: Response): Promise<string> {
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("utf-8");
}

/**
 * Normalise a raw CSV row by stripping a trailing comma that the xlsx library
 * adds to single-cell rows, then trim whitespace.
 */
function normaliseRow(raw: string): string {
  return raw.replace(/,+$/, "").trim();
}

/**
 * Split CSV text into normalised non-empty rows.
 * Use these strings for all assertions — they have no trailing commas.
 */
function csvRows(text: string): string[] {
  return text
    .split("\n")
    .map(normaliseRow)
    .filter(Boolean);
}

// ═════════════════════════════════════════════════════════════════════════════
// Suite
// ═════════════════════════════════════════════════════════════════════════════

describe("GET /api/export", () => {
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

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 for an unauthenticated request", async () => {
    setUserId(null);
    const res = await GET(makeRequest("csv"));
    expect(res.status).toBe(401);
  });

  // ── fileType validation ───────────────────────────────────────────────────

  it("returns 400 when fileType is missing", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 when fileType is unsupported", async () => {
    const res = await GET(makeRequest("pdf"));
    expect(res.status).toBe(400);
  });

  // ── CSV content-type ──────────────────────────────────────────────────────

  it("returns 200 with text/csv content-type for fileType=csv", async () => {
    const res = await GET(makeRequest("csv"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("sets Content-Disposition attachment header with csv filename", async () => {
    const res = await GET(makeRequest("csv"));
    expect(res.headers.get("Content-Disposition")).toBe(
      "attachment; filename=user_data.csv",
    );
  });

  // ── Empty workout list ────────────────────────────────────────────────────

  it("returns 200 with empty body when the user has no workouts", async () => {
    const res = await GET(makeRequest("csv"));
    expect(res.status).toBe(200);
    const text = await asText(res);
    expect(csvRows(text)).toHaveLength(0);
  });

  // ── Workout data included ─────────────────────────────────────────────────

  it("includes the workout name as the first row for that workout", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Leg Day",
      date: "2026-06-01",
    });

    const res = await GET(makeRequest("csv"));
    const rows = csvRows(await asText(res));

    expect(rows[0]).toBe("Leg Day");
  });

  it("includes all workout names when the user has multiple workouts", async () => {
    await seedWorkout(database, { userId: 1, name: "Push Day", date: "2026-06-01" });
    await seedWorkout(database, { userId: 1, name: "Pull Day", date: "2026-06-02" });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows).toContain("Push Day");
    expect(rows).toContain("Pull Day");
  });

  it("does not include workouts belonging to other users", async () => {
    await seedWorkout(database, { userId: 1, name: "My Workout",    date: "2026-06-01" });
    await seedWorkout(database, { userId: 2, name: "Their Workout", date: "2026-06-01" });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows).toContain("My Workout");
    expect(rows).not.toContain("Their Workout");
  });

  // ── Exercise data included ────────────────────────────────────────────────

  it("includes the exercise name after the workout name", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Push Day",
      date: "2026-06-01",
      exercises: [{ name: "Bench Press", notes: "", sets: [] }],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    const workoutIdx  = rows.indexOf("Push Day");
    const exerciseIdx = rows.indexOf("Bench Press");
    expect(exerciseIdx).toBeGreaterThan(workoutIdx);
  });

  it("includes set reps and weight on the same row", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Leg Day",
      date: "2026-06-01",
      exercises: [
        {
          name: "Squat",
          notes: "",
          sets: [
            { reps: "5", weight: "100", rpe: "8" },
            { reps: "5", weight: "105", rpe: "9" },
          ],
        },
      ],
    });

    const text = await asText(await GET(makeRequest("csv")));

    // Set rows are "reps,weight" — these are multi-column so no trailing comma
    expect(text).toContain("5,100");
    expect(text).toContain("5,105");
  });

  it("includes exercise notes row after the sets", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Push Day",
      date: "2026-06-01",
      exercises: [
        {
          name: "Overhead Press",
          notes: "Focus on lockout",
          sets: [{ reps: "5", weight: "60", rpe: "7" }],
        },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows).toContain("Focus on lockout");
    const setIdx   = rows.findIndex((r) => r.startsWith("5,60"));
    const notesIdx = rows.indexOf("Focus on lockout");
    expect(setIdx).toBeGreaterThanOrEqual(0);
    expect(notesIdx).toBeGreaterThan(setIdx);
  });

  it("includes multiple exercises from the same workout in order", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Full Body",
      date: "2026-06-01",
      exercises: [
        { name: "Squat",       notes: "", sets: [{ reps: "5", weight: "100", rpe: "8" }] },
        { name: "Bench Press", notes: "", sets: [{ reps: "8", weight: "80",  rpe: "7" }] },
        { name: "Deadlift",    notes: "", sets: [{ reps: "3", weight: "140", rpe: "9" }] },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    const sqIdx = rows.indexOf("Squat");
    const bpIdx = rows.indexOf("Bench Press");
    const dlIdx = rows.indexOf("Deadlift");

    expect(sqIdx).toBeGreaterThanOrEqual(0);
    expect(bpIdx).toBeGreaterThanOrEqual(0);
    expect(dlIdx).toBeGreaterThanOrEqual(0);
    expect(sqIdx).toBeLessThan(bpIdx);
    expect(bpIdx).toBeLessThan(dlIdx);
  });

  // ── Superset rows included ────────────────────────────────────────────────

  it("includes a 'Superset' marker row before grouped exercises", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Push Day",
      date: "2026-06-01",
      exercises: [
        { name: "Curl",       supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows).toContain("Superset");
    const ssIdx   = rows.indexOf("Superset");
    const curlIdx = rows.indexOf("Curl");
    expect(ssIdx).toBeGreaterThanOrEqual(0);
    expect(curlIdx).toBeGreaterThan(ssIdx);
  });

  it("includes both exercises from a superset block after the marker", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Push Day",
      date: "2026-06-01",
      exercises: [
        { name: "Curl",       supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    const ssIdx   = rows.indexOf("Superset");
    const curlIdx = rows.indexOf("Curl");
    const dipIdx  = rows.indexOf("Tricep Dip");

    expect(ssIdx).toBeGreaterThanOrEqual(0);
    expect(curlIdx).toBeGreaterThan(ssIdx);
    expect(dipIdx).toBeGreaterThan(ssIdx);
  });

  it("emits only one 'Superset' marker per superset block", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Push Day",
      date: "2026-06-01",
      exercises: [
        { name: "Curl",       supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows.filter((r) => r === "Superset")).toHaveLength(1);
  });

  it("emits separate 'Superset' markers for each distinct superset block", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Full Session",
      date: "2026-06-01",
      exercises: [
        { name: "Curl",       supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "15", rpe: "7" }] },
        { name: "Tricep Dip", supersetGroupId: "arms-ss", notes: "", sets: [{ reps: "12", weight: "0",  rpe: "7" }] },
        { name: "Squat",      supersetGroupId: "legs-ss", notes: "", sets: [{ reps: "8",  weight: "80", rpe: "8" }] },
        { name: "Leg Press",  supersetGroupId: "legs-ss", notes: "", sets: [{ reps: "10", weight: "60", rpe: "7" }] },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows.filter((r) => r === "Superset")).toHaveLength(2);
  });

  it("does not emit a 'Superset' marker for non-grouped exercises", async () => {
    await seedWorkout(database, {
      userId: 1,
      name: "Plain Workout",
      date: "2026-06-01",
      exercises: [
        { name: "Squat",       notes: "", sets: [{ reps: "5", weight: "100", rpe: "8" }] },
        { name: "Bench Press", notes: "", sets: [{ reps: "8", weight: "80",  rpe: "7" }] },
      ],
    });

    const rows = csvRows(await asText(await GET(makeRequest("csv"))));

    expect(rows).not.toContain("Superset");
  });

  // ── xlsx format ───────────────────────────────────────────────────────────

  it("returns 200 with xlsx content-type for fileType=xlsx", async () => {
    const res = await GET(makeRequest("xlsx"));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("sets Content-Disposition attachment header with xlsx filename", async () => {
    const res = await GET(makeRequest("xlsx"));
    expect(res.headers.get("Content-Disposition")).toBe(
      "attachment; filename=user_data.xlsx",
    );
  });
});