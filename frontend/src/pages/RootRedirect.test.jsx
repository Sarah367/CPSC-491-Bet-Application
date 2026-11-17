import { vi, describe, it, beforeEach, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import RootRedirect from "./RootRedirect";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

function renderAtRoot() {
    return render(
        <MemoryRouter initialEntries={["/"]}>
            <Routes>
                <Route path="/" element={<RootRedirect />} />
                <Route path="/home" element={<p>Home Page</p>} />
                <Route path="/login" element={<p>Login Page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

describe("RootRedirect", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends a signed-in user to Home", () => {
        useAuth.mockReturnValue({ loading: false, isAuthenticated: true });

        renderAtRoot();

        expect(screen.getByText("Home Page")).toBeInTheDocument();
        expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
    });

    it("sends a signed-out user to Login", () => {
        useAuth.mockReturnValue({ loading: false, isAuthenticated: false });

        renderAtRoot();

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    });

    it("waits while sign-in is still loading, instead of sending the user to Login", () => {
        useAuth.mockReturnValue({ loading: true, isAuthenticated: false });

        renderAtRoot();

        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(screen.queryByText("Login Page")).not.toBeInTheDocument();
        expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
    });
});
