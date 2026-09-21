import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {logoutUser} from "../services/authService";
import HomePage from "../pages/HomePage";

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

// HomePage now renders a <Link>, which needs a Router context to render at all.
function renderHome() {
    return render(
        <MemoryRouter>
            <HomePage />
        </MemoryRouter>
    );
}

describe("HomePage logout", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            currentUser: {uid: "abc123", email: "test@example.com"},
            loading: false,
            isAuthenticated: true,
        });
    });

  it("logs out successfully and navigates to /login", async () => {
    logoutUser.mockResolvedValueOnce();

    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    await waitFor(() => {
      expect(logoutUser).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
    
  it("shows a loading indicator while auth state is loading", () => {
    useAuth.mockReturnValue({ currentUser: null, loading: true, isAuthenticated: false });

    renderHome();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("redirects to /login when the user is not authenticated", () => {
    useAuth.mockReturnValue({ currentUser: null, loading: false, isAuthenticated: false });

    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<p>Login Page</p>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });

  it("renders the logged-in user's email", () => {
    renderHome();

    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("shows an error message when logout fails", async () => {
    logoutUser.mockRejectedValueOnce(new Error("network error"));

    renderHome();

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to log out. Please try again."
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clears a previous error on a subsequent logout attempt", async () => {
    logoutUser.mockRejectedValueOnce(new Error("first failure"));
    renderHome();
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    await screen.findByRole("alert");

    logoutUser.mockResolvedValueOnce();
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});