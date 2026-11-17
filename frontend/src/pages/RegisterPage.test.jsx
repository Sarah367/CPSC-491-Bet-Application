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

    it("shows an error when email is empty, without calling registerUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        expect(screen.getByText("Email is required.")).toBeInTheDocument();
        expect(registerUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error when password is empty, without calling registerUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.click(screen.getByRole("button", {name: /register/i}));

        expect(screen.getByText("Password is required.")).toBeInTheDocument();
        expect(registerUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error for a password under 6 characters, without calling registerUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "12345");
        await user.type(screen.getByLabelText("Confirm Password"), "12345");
        await user.click(screen.getByRole("button", {name: /register/i}));

        expect(
            screen.getByText("Password must be at least 6 characters.")
        ).toBeInTheDocument();
        expect(registerUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("accepts a password of exactly 6 characters", async () => {
        const user = userEvent.setup();
        registerUser.mockResolvedValue({uid: "sarah123", email: "test@example.com"});
        sendVerificationEmail.mockResolvedValue(undefined);
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "123456");
        await user.type(screen.getByLabelText("Confirm Password"), "123456");
        await user.click(screen.getByRole("button", {name: /register/i}));

        await waitFor(() => {
            expect(registerUser).toHaveBeenCalledWith("test@example.com", "123456");
        });
    });

    it("disables the button and shows 'Creating account...' while registering", async () => {
        const user = userEvent.setup();
        let finishRegistering;
        registerUser.mockReturnValue(new Promise((resolve) => {
            finishRegistering = resolve;
        }));
        sendVerificationEmail.mockResolvedValue(undefined);
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        const button = screen.getByRole("button", {name: "Creating account..."});
        expect(button).toBeDisabled();

        finishRegistering({uid: "sarah123", email: "test@example.com"});
        await waitFor(() => {
            expect(screen.getByRole("button", {name: "Register"})).toBeEnabled();
        });
    });

    // Regression: RegisterPage used to call navigate("/home") before sending the
    // verification email, which briefly mounted Home (and fired its Recent Bets
    // request) before landing on /verify-email.
    it("goes straight to /verify-email and never navigates to /home", async () => {
        const user = userEvent.setup();
        registerUser.mockResolvedValue({uid: "sarah123", email: "test@example.com"});
        sendVerificationEmail.mockResolvedValue(undefined);
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.type(screen.getByLabelText("Confirm Password"), "password123");
        await user.click(screen.getByRole("button", {name: /register/i}));

        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith("/verify-email", {
                state: {verificationEmailFailed: false},
            });
        });
        expect(mockNavigate).not.toHaveBeenCalledWith("/home");
        expect(mockNavigate).toHaveBeenCalledTimes(1);
    });

});