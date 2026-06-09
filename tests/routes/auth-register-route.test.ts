
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
  returning: vi.fn(),
  hash: vi.fn(),
}));

vi.mock("@/db/drizzle", () => ({
  db: {
    select: vi.fn(() => ({
      from: () => ({
        where: () => ({
          limit: mocks.limit,
        }),
      }),
    })),

    insert: vi.fn(() => ({
      values: () => ({
        returning: mocks.returning,
      }),
    })),
  },
}));

vi.mock("@/db/schema", () => ({
  user: {
    id: "id",
    username: "username",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    hash: mocks.hash,
  },
}));

import { POST } from "@/app/api/auth/register/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // default: username belum terdaftar
    mocks.limit.mockResolvedValue([]);

    // default: hash berhasil
    mocks.hash.mockResolvedValue("hashed-password");

    // default: insert berhasil
    mocks.returning.mockResolvedValue([
      {
        id: 1,
        username: "vanya",
      },
    ]);
  });

  it("registers successfully with valid credentials", async () => {
    const response = await POST(
      makeRequest({
        username: "vanya",
        password: "password123",
      }),
    );

    expect(response.status).toBe(201);

    await expect(response.json()).resolves.toEqual({
      message: "User created successfully",
      user: {
        id: 1,
        username: "vanya",
      },
    });
  });

  it("returns 400 when username and password are missing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Username and password are required",
    });
  });

  it("returns 400 when username is too short", async () => {
    const response = await POST(
      makeRequest({
        username: "ab",
        password: "password123",
      }),
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Username must be at least 3 characters",
    });
  });

  it("returns 400 when password is too short", async () => {
    const response = await POST(
      makeRequest({
        username: "vanya",
        password: "12345",
      }),
    );

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Password must be at least 6 characters",
    });
  });

  it("returns 409 when username already exists", async () => {
    mocks.limit.mockResolvedValue([
      {
        id: 1,
        username: "vanya",
      },
    ]);

    const response = await POST(
      makeRequest({
        username: "vanya",
        password: "password123",
      }),
    );

    expect(response.status).toBe(409);

    await expect(response.json()).resolves.toEqual({
      error: "Username already taken",
    });
  });

  it("hashes the password before saving", async () => {
    await POST(
      makeRequest({
        username: "vanya",
        password: "password123",
      }),
    );

    expect(mocks.hash).toHaveBeenCalledTimes(1);
    expect(mocks.hash).toHaveBeenCalledWith("password123", 12);
  });

  it("returns 500 when an unexpected error occurs", async () => {
    mocks.limit.mockRejectedValue(new Error("Database error"));

    const response = await POST(
      makeRequest({
        username: "vanya",
        password: "password123",
      }),
    );

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});
