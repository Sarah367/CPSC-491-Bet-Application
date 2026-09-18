import {render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {vi, describe,it,expect,beforeEach} from "vitest";
import LoginPage from "./LoginPage";
import {loginUser} from "../services/authService";

vi.mock("../services/authService", () => ({
    loginUser: vi.fn(),
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
            <LoginPage/>
        </MemoryRouter>
    );
}

describe("LoginPage validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("logs in successfully and navigates to /home", async () => {
        const user = userEvent.setup();
        loginUser.mockResolvedValue({uid: "abc123", email: "test@example.com"});
        
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.click(screen.getByRole("button", {name: /log in/i}));

        await waitFor(() => {
            expect(loginUser).toHaveBeenCalledWith("test@example.com", "password123");
            expect(mockNavigate).toHaveBeenCalledWith("/home");
        });
    });

    it("shows an error message when login fails with invalid credentials", async () => {
        const user = userEvent.setup();
        loginUser.mockRejectedValue({code: "auth/invalid-credential"});

        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.type(screen.getByLabelText("Password"), "wrongpassword");
        await user.click(screen.getByRole("button", {name: /log in/i}));

        await waitFor(() => {
            expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();

        });
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error when email is empty, without calling loginUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Password"), "password123");
        await user.click(screen.getByRole("button", {name: /log in/i}));

        expect(screen.getByText("Email is required.")).toBeInTheDocument();
        expect(loginUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error when password is empty, without calling loginUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Email"), "test@example.com");
        await user.click(screen.getByRole("button", {name: /log in/i}));

        expect(screen.getByText("Password is required.")).toBeInTheDocument();
        expect(loginUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("shows an error for a malformed email address, without calling loginUser", async () => {
        const user = userEvent.setup();
        renderPage();

        await user.type(screen.getByLabelText("Email"), "notanemail");
        await user.type(screen.getByLabelText("Password"), "password123");
        await user.click(screen.getByRole("button", {name: /log in/i}));

        expect(
            screen.getByText("Please enter a valid email address.")
        ).toBeInTheDocument();
        expect(loginUser).not.toHaveBeenCalled();
        expect(mockNavigate).not.toHaveBeenCalled();
    });




});