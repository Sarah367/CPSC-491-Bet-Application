import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {vi, describe,it,expect,beforeEach} from "vitest";
import RegisterPage from "./RegisterPage";
import {registerUser, sendVerificationEmail} from "../services/authService";

// mock the whole authService module since we do not want real Firebase calls in the tests.
vi.mock("../services/authService", () => ({
    registerUser: vi.fn(),
    sendVerificationEmail: vi.fn(),
}));

// Mock react-router's useNavigate so we can check where the page tries to redirect without needing a real router/browser navigation
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async(importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

function renderPage() {
    render(
        <MemoryRouter>
            <RegisterPage/>
        </MemoryRouter>
    );
}

describe("RegisterPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("registers, sends a verification email, and navigates to /verify-email", async () => {
        const user = userEvent.setup();
        const createdUser = {uid: "sarah123", email: "test@example.com"};
        registerUser.mockResolvedValue(createdUser);
        sendVerificationEmail.mockResolvedValue(undefined);

        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        await waitFor(() => {
            expect(registerUser).toHaveBeenCalledWith("test@example.com", "password123");
            expect(sendVerificationEmail).toHaveBeenCalledWith(createdUser);
            expect(mockNavigate).toHaveBeenCalledWith("/verify-email", {
                state: {verificationEmailFailed: false},
            });
        });
    });

    it("still navigates to /verify-email (not an error) when the verification email fails to send", async () => {
        const user = userEvent.setup();
        registerUser.mockResolvedValue({uid: "sarah123", email: "test@example.com"});
        sendVerificationEmail.mockRejectedValue({code: "auth/network-request-failed"});

        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        // The account was created, so the page must not show a registration error
        // (which could lead the user to register again).
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/verify-email", {
                state: {verificationEmailFailed: true},
            });
        });
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not send a verification email when registration fails", async () => {
        const user = userEvent.setup();
        registerUser.mockRejectedValue({code: "auth/email-already-in-use"});

        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        expect(await screen.findByRole("alert")).toBeInTheDocument();
        expect(sendVerificationEmail).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error message when registration fails", async () => {
        const user = userEvent.setup();
        registerUser.mockRejectedValue({code: "auth/email-already-in-use"});

        renderPage();
        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        await waitFor(() => {
            expect(
                screen.getByText("An account with this email already exists.")
            ).toBeInTheDocument();
        });
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows a validation error when passwords do not match, without calling registerUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "differentPassword");
        await user.click(screen.getByRole("button", {name: /register/i}));

        expect(
            screen.getByText("Passwords do not match.")
        ).toBeInTheDocument();
        expect(registerUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error for a malformed email address, without calling registerUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Email"), "notanemail");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i }));

        expect(
            screen.getByText("Please enter a valid email address.")
        ).toBeInTheDocument();

        expect(registerUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    })

});