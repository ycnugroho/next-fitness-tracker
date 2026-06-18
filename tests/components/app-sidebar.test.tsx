// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("next/link", () => {
  const MockLink = ({
    href,
    children,
    prefetch: _prefetch,
    ...props
  }: React.ComponentProps<"a"> & { href: string; prefetch?: boolean }) => (
    <a href={href} {...props}>{children}</a>
  );
  MockLink.displayName = "MockLink";
  return { default: MockLink };
});

vi.mock("@/components/ui/sidebar", () => {
  const pass =
    (tag: string) =>
    ({ children, ...props }: React.ComponentProps<"div">) =>
      React.createElement(tag, props, children);

  const SidebarMenuButton = ({
    children,
    asChild: _a,
    isActive: _i,
    size: _s,
    ...props
  }: React.ComponentProps<"div"> & {
    asChild?: boolean;
    isActive?: boolean;
    size?: string;
  }) => <div {...props}>{children}</div>;
  SidebarMenuButton.displayName = "SidebarMenuButton";

  return {
    Sidebar: pass("nav"),
    SidebarContent: pass("div"),
    SidebarFooter: pass("div"),
    SidebarGroup: pass("div"),
    SidebarGroupContent: pass("div"),
    SidebarGroupLabel: pass("div"),
    SidebarMenu: pass("ul"),
    SidebarMenuItem: pass("li"),
    SidebarMenuButton,
    useSidebar: () => ({ setOpenMobile: vi.fn(), isMobile: false }),
  };
});

vi.mock("@/components/theme-toggle", () => {
  const ThemeToggle = () => <div data-testid="theme-toggle" />;
  ThemeToggle.displayName = "ThemeToggle";
  return { ThemeToggle };
});

import { AppSidebar } from "@/components/app-sidebar";

const NAV_ITEMS = [
  { label: "Home",      href: "/" },
  { label: "Workouts",  href: "/workouts" },
  { label: "Exercises", href: "/exercises" },
  { label: "Export",    href: "/export" },
];

describe("AppSidebar", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ isLoggedIn: false }),
      }),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders the brand label, nav element, and ThemeToggle", () => {
    const { container } = render(<AppSidebar />);
    expect(screen.getByText("Lifting Log")).toBeTruthy();
    expect(container.querySelector("nav")).toBeTruthy();
    expect(screen.getByTestId("theme-toggle")).toBeTruthy();
  });

  it("does not render the logout button when user is logged out", () => {
    render(<AppSidebar />);
    expect(screen.queryByLabelText("Logout")).toBeFalsy();
  });

  it("renders all 4 navigation items with correct labels and hrefs", () => {
    render(<AppSidebar />);
    for (const { label, href } of NAV_ITEMS) {
      expect(screen.getByText(label)).toBeTruthy();
      expect(
        screen.getByRole("link", { name: new RegExp(label, "i") })
          .getAttribute("href"),
      ).toBe(href);
    }
  });
});