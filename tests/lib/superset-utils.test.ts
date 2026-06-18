import { describe, expect, it } from "vitest";
import {
  groupExercisesForDisplay,
  joinSupersetWithPrevious,
  moveExerciseBlock,
  removeExerciseAtIndex,
  removeExerciseFromSuperset,
  startSupersetWithNext,
} from "@/lib/superset-utils";

type Ex = { name: string; supersetGroupId: string | null };
const ex = (name: string, supersetGroupId: string | null = null): Ex => ({ name, supersetGroupId });
const names = (arr: Ex[]) => arr.map((e) => e.name);

// ─── groupExercisesForDisplay ─────────────────────────────────────────────────

describe("groupExercisesForDisplay", () => {
  it("empty list → empty blocks", () => {
    expect(groupExercisesForDisplay([])).toEqual([]);
  });

  it("single exercise → single block with correct indices", () => {
    const [b] = groupExercisesForDisplay([ex("Squat")]);
    expect(b).toMatchObject({ kind: "single", startIndex: 0, endIndex: 0 });
  });

  it("detects adjacent grouped exercises as superset block with correct indices", () => {
    const blocks = groupExercisesForDisplay([ex("Curl", "ss"), ex("Dip", "ss")]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ kind: "superset", supersetGroupId: "ss", startIndex: 0, endIndex: 1 });
    expect(blocks[0].exercises.map((e) => e.name)).toEqual(["Curl", "Dip"]);
  });

  it("complex layout: single → superset → single → superset → single", () => {
    const blocks = groupExercisesForDisplay([
      ex("S1"),
      ex("A", "ss1"), ex("B", "ss1"),
      ex("S2"),
      ex("C", "ss2"), ex("D", "ss2"),
      ex("S3"),
    ]);
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toMatchObject({ kind: "single" });
    expect(blocks[1]).toMatchObject({ kind: "superset", supersetGroupId: "ss1", startIndex: 1, endIndex: 2 });
    expect(blocks[2]).toMatchObject({ kind: "single" });
    expect(blocks[3]).toMatchObject({ kind: "superset", supersetGroupId: "ss2", startIndex: 4, endIndex: 5 });
    expect(blocks[4]).toMatchObject({ kind: "single" });
  });

  it("lone groupId with no adjacent match is treated as single block", () => {
    const blocks = groupExercisesForDisplay([ex("Lonely", "orphan"), ex("Normal")]);
    expect(blocks[0].kind).toBe("single");
    expect(blocks[1].kind).toBe("single");
  });
});

// ─── startSupersetWithNext ────────────────────────────────────────────────────

describe("startSupersetWithNext", () => {
  it("assigns groupId to target and next; no-op at last index; does not mutate", () => {
    const arr = [ex("A"), ex("B"), ex("C")];
    const result = startSupersetWithNext(arr, 0, "ss");
    expect(result[0].supersetGroupId).toBe("ss");
    expect(result[1].supersetGroupId).toBe("ss");
    expect(result[2].supersetGroupId).toBeNull();
    // no-op at last
    const noOp = startSupersetWithNext(arr, 2, "ss");
    expect(noOp.every((e) => e.supersetGroupId === null)).toBe(true);
    // immutable
    expect(arr[0].supersetGroupId).toBeNull();
  });
});

// ─── joinSupersetWithPrevious ─────────────────────────────────────────────────

describe("joinSupersetWithPrevious", () => {
  it("joins into existing group; creates new group when previous has none; no-op at index 0; does not mutate", () => {
    // inherit existing group
    const r1 = joinSupersetWithPrevious([ex("A", "ss"), ex("B", "ss"), ex("C")], 2, () => "new");
    expect(r1[2].supersetGroupId).toBe("ss");
    // create new group
    const r2 = joinSupersetWithPrevious([ex("A"), ex("B")], 1, () => "created");
    expect(r2[0].supersetGroupId).toBe("created");
    expect(r2[1].supersetGroupId).toBe("created");
    // no-op
    const arr = [ex("A"), ex("B")];
    joinSupersetWithPrevious(arr, 0, () => "x");
    expect(arr[0].supersetGroupId).toBeNull();
  });
});

// ─── removeExerciseFromSuperset ───────────────────────────────────────────────

describe("removeExerciseFromSuperset", () => {
  it("clears target's groupId; keeps remaining pair valid; strips both when 2-member group broken; does not mutate", () => {
    // clears target, keeps pair
    const r1 = removeExerciseFromSuperset([ex("A", "ss"), ex("B", "ss"), ex("C", "ss")], 0);
    expect(r1[0].supersetGroupId).toBeNull();
    expect(r1[1].supersetGroupId).toBe("ss");
    expect(r1[2].supersetGroupId).toBe("ss");
    // strips both when only 1 remains
    const r2 = removeExerciseFromSuperset([ex("A", "ss"), ex("B", "ss")], 0);
    expect(r2.every((e) => e.supersetGroupId === null)).toBe(true);
    // immutable
    const arr = [ex("A", "ss"), ex("B", "ss")];
    removeExerciseFromSuperset(arr, 0);
    expect(arr[0].supersetGroupId).toBe("ss");
  });
});

// ─── removeExerciseAtIndex ────────────────────────────────────────────────────

describe("removeExerciseAtIndex", () => {
  it("removes at index; strips singleton group; preserves valid group; does not mutate", () => {
    expect(names(removeExerciseAtIndex([ex("A"), ex("B"), ex("C")], 1))).toEqual(["A", "C"]);
    // strips singleton
    const r2 = removeExerciseAtIndex([ex("A", "ss"), ex("B", "ss"), ex("C")], 0);
    expect(r2[0].supersetGroupId).toBeNull(); // B is now alone
    // preserves valid group
    const r3 = removeExerciseAtIndex([ex("A", "ss"), ex("B", "ss"), ex("C", "ss")], 0);
    expect(r3[0].supersetGroupId).toBe("ss");
    expect(r3[1].supersetGroupId).toBe("ss");
    // immutable
    const arr = [ex("A"), ex("B")];
    removeExerciseAtIndex(arr, 0);
    expect(arr).toHaveLength(2);
  });
});

// ─── moveExerciseBlock ────────────────────────────────────────────────────────

describe("moveExerciseBlock", () => {
  it("moves single exercise up/down; no-op at boundaries; moves entire superset block; does not mutate", () => {
    expect(names(moveExerciseBlock([ex("A"), ex("B"), ex("C")], 1, "up"))).toEqual(["B", "A", "C"]);
    expect(names(moveExerciseBlock([ex("A"), ex("B"), ex("C")], 1, "down"))).toEqual(["A", "C", "B"]);
    // no-op at boundaries
    expect(names(moveExerciseBlock([ex("A"), ex("B")], 0, "up"))).toEqual(["A", "B"]);
    expect(names(moveExerciseBlock([ex("A"), ex("B")], 1, "down"))).toEqual(["A", "B"]);
    // moves superset block as unit
    const r = moveExerciseBlock([ex("Solo"), ex("A", "ss"), ex("B", "ss")], 1, "up");
    expect(names(r)).toEqual(["A", "B", "Solo"]);
    expect(r[0].supersetGroupId).toBe("ss");
    // immutable
    const arr = [ex("A"), ex("B")];
    moveExerciseBlock(arr, 0, "down");
    expect(arr[0].name).toBe("A");
  });
});

// ─── normalizeSupersetGroups (via mutations) ──────────────────────────────────

describe("normalizeSupersetGroups", () => {
  it("strips lone groupId after removal; restores valid group when gap is removed", () => {
    // lone after removal
    const withSS = startSupersetWithNext([ex("A"), ex("B")], 0, "ss");
    const result = removeExerciseFromSuperset(withSS, 0);
    expect(result[0].supersetGroupId).toBeNull();
    // gap removal makes group valid
    const gapped: Ex[] = [{ name: "A", supersetGroupId: "ss" }, { name: "B", supersetGroupId: null }, { name: "C", supersetGroupId: "ss" }];
    const fixed = removeExerciseAtIndex(gapped, 1);
    expect(fixed[0].supersetGroupId).toBe("ss");
    expect(fixed[1].supersetGroupId).toBe("ss");
  });
});
