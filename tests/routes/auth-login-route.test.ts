import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  foundUser: [
    {
      id: 1,
      username: "vanya",
      passwordHash: "hashed-password",
    },
  ],

  session: {
    userId: 0,
    username: "",
    isLoggedIn: false,
    save: vi.fn(),
  },

  compare: vi.fn(),
  getIronSession: vi.fn(),
  limit: vi.fn(),
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
  },
}));

vi.mock("@/db/schema", () => ({
  user: {
    username: "username",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.compare,
  },
}));

vi.mock("iron-session", () => ({
  getIronSession: mocks.getIronSession,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock("@/lib/session", () => ({
  sessionOptions: {},
}));

import { POST } from "@/app/api/auth/login/route";

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mocks.limit.mockResolvedValue(mocks.foundUser);

    mocks.compare.mockResolvedValue(true);

    mocks.session.userId = 0;
    mocks.session.username = "";
    mocks.session.isLoggedIn = false;

    mocks.session.save.mockResolvedValue(undefined);

    mocks.getIronSession.mockResolvedValue(mocks.session);
  });

  it("logs in successfully with valid credentials", async () => {
    const response = await POST(
      makeRequest({
        username: "vanya",
        password: "password123",
      }),
    );

    expect(response.status).toBe(200);

    const body = await response.json();

    expect(body.message).toBe("Login successful");
    expect(body.user.username).toBe("vanya");

    expect(mocks.session.userId).toBe(1);
    expect(mocks.session.username).toBe("vanya");
    expect(mocks.session.isLoggedIn).toBe(true);
  });

  it("returns 400 when credentials are missing", async () => {
    const response = await POST(makeRequest({}));

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: "Username and password are required",
    });
  });

  it("returns 401 when user does not exist", async () => {
    mocks.limit.mockResolvedValue([]);

    const response = await POST(
      makeRequest({
        username: "unknown",
        password: "password123",
      }),
    );

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid username or password",
    });
  });

  it("returns 401 when password is invalid", async () => {
    mocks.compare.mockResolvedValue(false);

    const response = await POST(
      makeRequest({
        username: "vanya",
        password: "wrong-password",
      }),
    );

    expect(response.status).toBe(401);

    await expect(response.json()).resolves.toEqual({
      error: "Invalid username or password",
    });
  });

  it("calls session.save after successful login", async () => {
    await POST(
      makeRequest({
        username: "vanya",
        password: "password123",
      }),
    );

    expect(mocks.session.save).toHaveBeenCalledTimes(1);
  });
});