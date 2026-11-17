import { vi, describe, it, beforeEach, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAuth } from "./context/useAuth";
import App from "./App";

// These tests check App's routes (SCRUM-110), so each real page is swapped for a
// one-line stand-in. Each page has its own tests.
vi.mock("./context/useAuth", () => ({
    useAuth: vi.fn(),
}));
vi.mock("./pages/LoginPage", () => ({ default: () => <p>Login Page</p> }));
vi.mock("./pages/RegisterPage", () => ({ default: () => <p>Register Page</p> }));
vi.mock("./pages/HomePage", () => ({ default: () => <p>Home Page</p> }));
vi.mock("./pages/ProfilePage", () => ({ default: () => <p>Profile Page</p> }));
vi.mock("./pages/MyBetsPage", () => ({ default: () => <p>My Bets Page</p> }));
vi.mock("./pages/BetsListPage", () => ({ default: () => <p>Public Bets Page</p> }));
vi.mock("./pages/CreateBetPage", () => ({ default: () => <p>Create Bet Page</p> }));
vi.mock("./pages/BetDetailsPage", () => ({ default: () => <p>Bet Details Page</p> }));
vi.mock("./pages/VerifyEmailPage", () => ({ default: () => <p>Verify Email Page</p> }));

// App has its own BrowserRouter, so the test sets the browser's address first.
function renderAppAt(path) {
    window.history.pushState({}, "", path);
    return render(<App />);
}

describe("App routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    });

    it("sends / to Home for a signed-in user", () => {
        renderAppAt("/");

        expect(screen.getByText("Home Page")).toBeInTheDocument();
        expect(window.location.pathname).toBe("/home");
    });

    it("sends / to Login for a signed-out user", () => {
        useAuth.mockReturnValue({ loading: false, isAuthenticated: false });

        renderAppAt("/");

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(window.location.pathname).toBe("/login");
    });

    it.each([
        ["a mistyped address", "/bet/123"],
        ["an address nested under a real page", "/my-bets/extra"],
        ["a made-up address", "/does-not-exist"],
    ])("shows Page not found for %s", (_label, path) => {
        renderAppAt(path);

        expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    });

    it.each([
        ["/home", "Home Page"],
        ["/bets", "Public Bets Page"],
        ["/bets/create", "Create Bet Page"],
        ["/bets/abc123", "Bet Details Page"],
        ["/my-bets", "My Bets Page"],
    ])("still shows the real page at %s, not Page not found", (path, pageText) => {
        renderAppAt(path);

        expect(screen.getByText(pageText)).toBeInTheDocument();
        expect(screen.queryByText("Page not found")).not.toBeInTheDocument();
    });
});
