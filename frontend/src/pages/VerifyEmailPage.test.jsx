import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {sendVerificationEmail} from "../services/authService";
import VerifyEmailPage from "./VerifyEmailPage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/authService", () => ({
    sendVerificationEmail: vi.fn(),
}));

const unverifiedUser = {uid: "sarah123", email: "test@example.com"};

function mockAuth(overrides = {}) {
    const value = {
        currentUser: unverifiedUser,
        loading: false,
        isAuthenticated: true,
        emailVerified: false,
        refreshUser: vi.fn(),
        ...overrides,
    };
    useAuth.mockReturnValue(value);
    return value;
}

// initialState lets a test simulate RegisterPage's navigate("/verify-email", {state}).
function renderPage(initialState) {
    return render(
        <MemoryRouter initialEntries={[{pathname: "/verify-email", state: initialState}]}>
            <Routes>
                <Route path="/verify-email" element={<VerifyEmailPage/>}/>
                <Route path="/login" element={<p>Login Page</p>}/>
            </Routes>
        </MemoryRouter>
    );
}

describe("VerifyEmailPage access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a loading indicator while auth state is loading", () => {
        mockAuth({currentUser: null, loading: true, isAuthenticated: false, emailVerified: null});
        renderPage();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("redirects to /login when the user is not authenticated", () => {
        mockAuth({currentUser: null, isAuthenticated: false, emailVerified: null});
        renderPage();
        expect(screen.getByText("Login Page")).toBeInTheDocument();
    });
});

describe("VerifyEmailPage unverified user", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the email address and both actions", () => {
        mockAuth();
        renderPage();

        expect(screen.getByRole("heading", {name: "Verify your email"})).toBeInTheDocument();
        expect(screen.getByText("test@example.com")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "I've verified my email"})).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Resend verification email"})).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("explains a failed first send when arriving from registration", () => {
        mockAuth();
        renderPage({verificationEmailFailed: true});

        expect(screen.getByRole("alert")).toHaveTextContent(
            "Your account was created, but we couldn't send the verification email."
        );
    });

    it("resends the verification email and shows a success message", async () => {
        const user = userEvent.setup();
        mockAuth();
        sendVerificationEmail.mockResolvedValue(undefined);
        renderPage();

        await user.click(screen.getByRole("button", {name: "Resend verification email"}));

        expect(sendVerificationEmail).toHaveBeenCalledWith(unverifiedUser);
        expect(await screen.findByRole("status")).toHaveTextContent(
            "Verification email sent to test@example.com."
        );
    });

    it("disables both buttons while resending", async () => {
        const user = userEvent.setup();
        mockAuth();
        let finishSend;
        sendVerificationEmail.mockImplementation(() => new Promise((resolve) => { finishSend = resolve; }));
        renderPage();

        await user.click(screen.getByRole("button", {name: "Resend verification email"}));

        expect(screen.getByRole("button", {name: "Sending..."})).toBeDisabled();
        expect(screen.getByRole("button", {name: "I've verified my email"})).toBeDisabled();

        finishSend();
        await waitFor(() => {
            expect(screen.getByRole("button", {name: "Resend verification email"})).toBeEnabled();
        });
    });

    it("shows a resend-specific message for auth/too-many-requests", async () => {
        const user = userEvent.setup();
        mockAuth();
        sendVerificationEmail.mockRejectedValue({code: "auth/too-many-requests"});
        renderPage();

        await user.click(screen.getByRole("button", {name: "Resend verification email"}));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Too many verification emails were requested. Please wait a few minutes and try again."
        );
    });

    it("uses the shared friendly message for other resend errors", async () => {
        const user = userEvent.setup();
        mockAuth();
        sendVerificationEmail.mockRejectedValue({code: "auth/network-request-failed"});
        renderPage();

        await user.click(screen.getByRole("button", {name: "Resend verification email"}));

        expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    });

    it("calls refreshUser() and shows a hint when verification isn't detected yet", async () => {
        const user = userEvent.setup();
        const auth = mockAuth();
        auth.refreshUser.mockResolvedValue(false);
        renderPage();

        await user.click(screen.getByRole("button", {name: "I've verified my email"}));

        expect(auth.refreshUser).toHaveBeenCalledTimes(1);
        expect(await screen.findByRole("alert")).toHaveTextContent("We haven't detected verification yet.");
    });

    it("shows no error when refreshUser() reports the email is verified", async () => {
        const user = userEvent.setup();
        const auth = mockAuth();
        auth.refreshUser.mockResolvedValue(true);
        renderPage();

        await user.click(screen.getByRole("button", {name: "I've verified my email"}));

        await waitFor(() => expect(auth.refreshUser).toHaveBeenCalledTimes(1));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows an error if checking verification status fails", async () => {
        const user = userEvent.setup();
        const auth = mockAuth();
        auth.refreshUser.mockRejectedValue(new Error("auth/network-request-failed"));
        renderPage();

        await user.click(screen.getByRole("button", {name: "I've verified my email"}));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Couldn't check your verification status. Please try again."
        );
    });
});

describe("VerifyEmailPage verified user", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the verified state with links to continue", () => {
        mockAuth({emailVerified: true});
        renderPage();

        expect(screen.getByRole("heading", {name: "Email verified"})).toBeInTheDocument();
        expect(screen.getByRole("link", {name: "Create a Bet"})).toHaveAttribute("href", "/bets/create");
        expect(screen.getByRole("link", {name: "Continue to Home"})).toHaveAttribute("href", "/home");
        expect(screen.queryByRole("button", {name: "Resend verification email"})).not.toBeInTheDocument();
    });
});
