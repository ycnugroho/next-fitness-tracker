// @vitest-environment jsdom
/**
 * tests/components/theme-toggle.test.tsx
 *
 * Tests for <ThemeToggle />:
 * - light mode selectable
 * - dark mode selectable
 * - system mode selectable
 */

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ─── Mock next-themes ─────────────────────────────────────────────────────────

const mockSetTheme = vi.fn();
let mockTheme = "system";

vi.mock("next-themes", () => ({
  useTheme: () => ({
    setTheme: mockSetTheme,
    theme: mockTheme,
  }),
}));

// ─── Subject ──────────────────────────────────────────────────────────────────

import { ThemeToggle } from "@/components/theme-toggle";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * ThemeToggle hides button labels behind a responsive class
 * (hidden min-[420px]:inline). In jsdom there is no CSS, so the <span>
 * text IS in the DOM — getByRole("button", { name }) works fine.
 *
 * The component also delays rendering the active theme until after mount
 * (useState + useEffect). After render the state is synchronous in jsdom,
 * so aria-pressed reflects the correct value immediately.
 */
function renderToggle() {
  const user = userEvent.setup();
  render(<ThemeToggle />);
  return { user };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("ThemeToggle", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockTheme = "system";
  });

  describe("renders correctly", () => {
    it("renders a group with aria-label 'Theme'", () => {
      renderToggle();
      expect(screen.getByRole("group", { name: "Theme" })).toBeTruthy();
    });

    it("renders Light, System, and Dark buttons", () => {
      renderToggle();
      expect(screen.getByRole("button", { name: "Light theme" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "System theme" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Dark theme" })).toBeTruthy();
    });
  });

  describe("light mode selectable", () => {
    it("calls setTheme('light') when the Light button is clicked", async () => {
      const { user } = renderToggle();
      await user.click(screen.getByRole("button", { name: "Light theme" }));
      expect(mockSetTheme).toHaveBeenCalledWith("light");
    });

    it("marks the Light button as pressed when theme is 'light'", () => {
      mockTheme = "light";
      renderToggle();
      const btn = screen.getByRole("button", { name: "Light theme" });
      expect(btn.getAttribute("aria-pressed")).toBe("true");
    });

    it("does not mark Light as pressed when theme is 'dark'", () => {
      mockTheme = "dark";
      renderToggle();
      const btn = screen.getByRole("button", { name: "Light theme" });
      expect(btn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("dark mode selectable", () => {
    it("calls setTheme('dark') when the Dark button is clicked", async () => {
      const { user } = renderToggle();
      await user.click(screen.getByRole("button", { name: "Dark theme" }));
      expect(mockSetTheme).toHaveBeenCalledWith("dark");
    });

    it("marks the Dark button as pressed when theme is 'dark'", () => {
      mockTheme = "dark";
      renderToggle();
      const btn = screen.getByRole("button", { name: "Dark theme" });
      expect(btn.getAttribute("aria-pressed")).toBe("true");
    });

    it("does not mark Dark as pressed when theme is 'light'", () => {
      mockTheme = "light";
      renderToggle();
      const btn = screen.getByRole("button", { name: "Dark theme" });
      expect(btn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("system mode selectable", () => {
    it("calls setTheme('system') when the System button is clicked", async () => {
      const { user } = renderToggle();
      await user.click(screen.getByRole("button", { name: "System theme" }));
      expect(mockSetTheme).toHaveBeenCalledWith("system");
    });

    it("marks the System button as pressed when theme is 'system'", () => {
      mockTheme = "system";
      renderToggle();
      const btn = screen.getByRole("button", { name: "System theme" });
      expect(btn.getAttribute("aria-pressed")).toBe("true");
    });

    it("does not mark System as pressed when theme is 'light'", () => {
      mockTheme = "light";
      renderToggle();
      const btn = screen.getByRole("button", { name: "System theme" });
      expect(btn.getAttribute("aria-pressed")).toBe("false");
    });
  });

  describe("only one theme is active at a time", () => {
    it("only the active theme button has aria-pressed='true'", () => {
      mockTheme = "dark";
      renderToggle();
      const pressed = screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
      expect(pressed[0].getAttribute("aria-label")).toBe("Dark theme");
    });
  });
});
