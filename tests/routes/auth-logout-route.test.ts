import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: {
    destroy: vi.fn(),
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
}));

import { POST } from "@/app/api/auth/logout/route";

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.session.destroy.mockReturnValue(undefined);
    mocks.getIronSession.mockResolvedValue(mocks.session);
  });

  it("logs out successfully", async () => {
    const response = await POST();

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      message: "Logged out successfully",
    });

    expect(mocks.session.destroy).toHaveBeenCalledTimes(1);
  });

  it("calls session.destroy()", async () => {
    await POST();

    expect(mocks.session.destroy).toHaveBeenCalledOnce();
  });

  it("returns 500 when getIronSession throws an error", async () => {
    mocks.getIronSession.mockRejectedValue(
      new Error("Failed to get session"),
    );

    const response = await POST();

    expect(response.status).toBe(500);

    await expect(response.json()).resolves.toEqual({
      error: "Internal server error",
    });
  });
});
