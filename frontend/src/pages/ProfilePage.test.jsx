import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter,  Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import ProfilePage from "../pages/ProfilePage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

function renderProfilePage() {
    return render(
        <MemoryRouter>
            <ProfilePage/>
        </MemoryRouter>
    );
}

describe("ProfilePage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a loading indicator while auth state is loading", () => {
        useAuth.mockReturnValue({
            currentUser: null,
            loading: true,
            isAuthenticated: false,
            emailVerified: null,
        });

        renderProfilePage();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("redirects to /login when the user is not authenticated", () => {
        useAuth.mockReturnValue({
            currentUser: null,
            loading: false,
            isAuthenticated: false,
            emailVerified: null,
        });
        render(
            <MemoryRouter initialEntries={["/profile"]}>
                <Routes>
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/login" element={<p>Login Page</p>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText("Login Page")).toBeInTheDocument();
    });

    it("shows the authenticated user's email and verification status", () => {
        useAuth.mockReturnValue({
            currentUser: {
                email: "test@example.com",
                displayName: "Test User",
                metadata: {
                    creationTime: "2026-01-15T00:00:00.000Z",
                    lastSignInTime: "2026-09-20T00:00:00.000Z",
                },
            },
            loading: false,
            isAuthenticated: true,
            emailVerified: true,
        });

        renderProfilePage();

        expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
        expect(screen.getByText("Yes")).toBeInTheDocument();
    });

    it("shows 'No' for an unverified email", () => {
        useAuth.mockReturnValue({
            currentUser: {
                email: "unverified@example.com",
                displayName: null,
                metadata: {},
            },
            loading: false,
            isAuthenticated: true,
            emailVerified: false,
        });
        renderProfilePage();
        expect(screen.getByText("No")).toBeInTheDocument();
    });

    it("falls back to 'Not set' and 'Not available' when optional fields are missing", () => {
        useAuth.mockReturnValue({
            currentUser: {
                email: null,
                displayName: null,
                metadata: {},
            },
            loading: false,
            isAuthenticated: true,
            emailVerified: false,
        });
        renderProfilePage();

        expect(screen.getByText(/Not set/)).toBeInTheDocument();
        expect(screen.getAllByText(/Not available/).length).toBeGreaterThan(0);
    });
});