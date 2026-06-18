// @vitest-environment jsdom
/**
 * tests/components/loading-overlay.test.tsx
 *
 * Tests for <LoadingOverlay />:
 * - loading indicator appears when isLoading=true
 * - nothing rendered when isLoading=false
 */

import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LoadingOverlay } from "@/components/loading-overlay";

describe("LoadingOverlay", () => {
  afterEach(cleanup);

  describe("loading indicator appears", () => {
    it("renders the spinner when isLoading is true", () => {
      render(<LoadingOverlay isLoading={true} />);
      expect(screen.getByRole("status")).toBeTruthy();
    });

    it("spinner has accessible label 'Loading'", () => {
      render(<LoadingOverlay isLoading={true} />);
      expect(screen.getByLabelText("Loading")).toBeTruthy();
    });

    it("renders the overlay container when isLoading is true", () => {
      const { container } = render(<LoadingOverlay isLoading={true} />);
      // The outer div wraps the spinner
      expect(container.firstChild).toBeTruthy();
    });
  });

  describe("hidden when not loading", () => {
    it("renders nothing when isLoading is false", () => {
      const { container } = render(<LoadingOverlay isLoading={false} />);
      expect(container.firstChild).toBeNull();
    });

    it("does not render a spinner when isLoading is false", () => {
      render(<LoadingOverlay isLoading={false} />);
      expect(screen.queryByRole("status")).toBeFalsy();
    });

    it("does not render the loading label when isLoading is false", () => {
      render(<LoadingOverlay isLoading={false} />);
      expect(screen.queryByLabelText("Loading")).toBeFalsy();
    });
  });

  describe("transitions between states", () => {
    it("shows spinner after re-render with isLoading=true", () => {
      const { rerender } = render(<LoadingOverlay isLoading={false} />);
      expect(screen.queryByRole("status")).toBeFalsy();

      rerender(<LoadingOverlay isLoading={true} />);
      expect(screen.getByRole("status")).toBeTruthy();
    });

    it("hides spinner after re-render with isLoading=false", () => {
      const { rerender } = render(<LoadingOverlay isLoading={true} />);
      expect(screen.getByRole("status")).toBeTruthy();

      rerender(<LoadingOverlay isLoading={false} />);
      expect(screen.queryByRole("status")).toBeFalsy();
    });
  });
});
