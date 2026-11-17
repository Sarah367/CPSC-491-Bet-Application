import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";

describe("NotFoundPage", () => {
    it("says the page wasn't found", () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>
        );

        expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    });

    it("links back to Home", () => {
        render(
            <MemoryRouter>
                <NotFoundPage />
            </MemoryRouter>
        );

        expect(screen.getByRole("link", { name: "Go to Home" })).toHaveAttribute("href", "/home");
    });
});
