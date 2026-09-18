import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {vi, describe,it, expect, beforeEach} from "vitest";
import HomePage from "./HomePage";
import {logoutUser} from "../services/authService";
import {useAuth} from "../context/useAuth";

vi.mock("../services/authService", () => ({
    logoutUser: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderPage() {
    render(
        <MemoryRouter>
            <HomePage/>
        </MemoryRouter>
    );
}

describe("HomePage logout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            currentUser: {uid: "abc123", email: "test@example.com"},
            loading: false,
        });
    });

    it("logs out successfully and navigates to /login", async () => {
        
    })
})