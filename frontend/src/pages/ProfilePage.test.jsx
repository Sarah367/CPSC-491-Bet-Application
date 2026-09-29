import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter,  Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {updateDisplayName} from "../services/authService";
import ProfilePage from "../pages/ProfilePage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/authService", () => ({
    updateDisplayName: vi.fn(),
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

    it("shows the display name after auth finishes loading", () => {
        useAuth.mockReturnValue({
            currentUser: null,
            loading: true,
            isAuthenticated: false,
            emailVerified: null,
        });
        const {rerender} = renderProfilePage();

        useAuth.mockReturnValue({
            currentUser: {displayName: "Loaded User", metadata: {}},
            loading: false,
            isAuthenticated: true,
            emailVerified: false,
        });
        rerender(
            <MemoryRouter>
                <ProfilePage />
            </MemoryRouter>
        );

        expect(screen.getByText("Loaded User")).toBeInTheDocument();
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

    it("lets the user edit and save their display name", async () => {
        const user = userEvent.setup();
        useAuth.mockReturnValue({
            currentUser: {displayName: "Test User", metadata: {}},
            loading: false,
            isAuthenticated: true,
            emailVerified: false,
        });
        updateDisplayName.mockResolvedValue();

        renderProfilePage();
        await user.click(screen.getByRole("button", {name: "Edit"}));
        await user.clear(screen.getByLabelText("Display name"));
        await user.type(screen.getByLabelText("Display name"), "New Name");
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(updateDisplayName).toHaveBeenCalledWith("New Name");
        expect(await screen.findByText("New Name")).toBeInTheDocument();
    });

    it("does not save a blank display name", async () => {
        const user = userEvent.setup();
        useAuth.mockReturnValue({
            currentUser: {displayName: "Test User", metadata: {}},
            loading: false,
            isAuthenticated: true,
            emailVerified: false,
        });

        renderProfilePage();
        await user.click(screen.getByRole("button", {name: "Edit"}));
        await user.clear(screen.getByLabelText("Display name"));
        await user.type(screen.getByLabelText("Display name"), "   ");
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(screen.getByRole("alert")).toHaveTextContent("Display name cannot be empty.");
        expect(updateDisplayName).not.toHaveBeenCalled();
    });

    it("shows an error when saving the display name fails", async () => {
        const user = userEvent.setup();
        useAuth.mockReturnValue({
            currentUser: {displayName: "Test User", metadata: {}},
            loading: false,
            isAuthenticated: true,
            emailVerified: false,
        });
        updateDisplayName.mockRejectedValue(new Error("Firebase unavailable"));

        renderProfilePage();
        await user.click(screen.getByRole("button", {name: "Edit"}));
        await user.clear(screen.getByLabelText("Display name"));
        await user.type(screen.getByLabelText("Display name"), "New Name");
        await user.click(screen.getByRole("button", {name: "Save"}));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to update display name. Please try again."
        );
        expect(screen.getByText("Test User")).toBeInTheDocument();
    });
});