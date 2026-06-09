import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    userId: 0,
    username: "",
    isLoggedIn: false,
  },
  getIronSession: vi.fn(),
}));

vi.mock("iron-session", () => ({
  getIronSession: mocks.getIronSession,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({})),
}));

vi.mock("@/lib/session", () => ({
  sessionOptions: {},
  defaultSession: {
    userId: 0,
    username: "",
    isLoggedIn: false,
  },
}));

import { GET } from "@/app/api/auth/me/route";

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    mocks.session.userId = 0;
    mocks.session.username = "";
    mocks.session.isLoggedIn = false;

    mocks.getIronSession.mockResolvedValue(mocks.session);
  });

  it("returns default session when user is not logged in", async () => {
    const response = await GET();

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      userId: 0,
      username: "",
      isLoggedIn: false,
    });
  });

  it("returns session data when user is logged in", async () => {
    mocks.session.userId = 1;
    mocks.session.username = "vanya";
    mocks.session.isLoggedIn = true;

    const response = await GET();

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      userId: 1,
      username: "vanya",
      isLoggedIn: true,
    });
  });
});
