import {vi, describe,it, beforeEach} from "vitest";
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