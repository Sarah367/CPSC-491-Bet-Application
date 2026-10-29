import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {logoutUser} from "../services/authService";
import {fetchMyBets} from "../services/betService";
import HomePage from "../pages/HomePage";

vi.mock("../services/authService", () => ({
    logoutUser: vi.fn(),
}));

vi.mock("../services/betService", () => ({
  fetchMyBets: vi.fn(),
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

function renderHomePage() {
  return render (
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
        fetchMyBets.mockReturnValue(new Promise(() => {}));
    });

  it("logs out successfully and navigates to /login", async () => {
    logoutUser.mockResolvedValueOnce();

    renderHomePage();

    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    await waitFor(() => {
      expect(logoutUser).toHaveBeenCalledTimes(1);
    });
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
    
  it("shows a loading indicator while auth state is loading", () => {
    useAuth.mockReturnValue({ currentUser: null, loading: true, isAuthenticated: false });

    renderHomePage();

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
    renderHomePage();

    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it("shows an error message when logout fails", async () => {
    logoutUser.mockRejectedValueOnce(new Error("network error"));

    renderHomePage();
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to log out. Please try again."
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("clears a previous error on a subsequent logout attempt", async () => {
    logoutUser.mockRejectedValueOnce(new Error("first failure"));
    renderHomePage();
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));
    await screen.findByRole("alert");

    logoutUser.mockResolvedValueOnce();
    fireEvent.click(screen.getByRole("button", { name: "Log Out" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });


});

describe("HomePage Create Bet navigation", () => {
  beforeEach(() => {
      vi.clearAllMocks();
      useAuth.mockReturnValue({
          currentUser: {uid: "abc123", email: "test@example.com"},
          loading: false,
          isAuthenticated: true,
      });
      fetchMyBets.mockReturnValue(new Promise(() => {}));

  });

  it("shows a Create a Bet link that points to /bets/create", () => {
      renderHomePage();

      const link = screen.getByRole("link", { name: "Create a Bet" });
      expect(link).toHaveAttribute("href", "/bets/create");
  });

  it("opens the Create Bet page when the link is clicked", () => {
      render(
          <MemoryRouter initialEntries={["/home"]}>
              <Routes>
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/bets/create" element={<p>Create Bet Page</p>} />
              </Routes>
          </MemoryRouter>
      );

      fireEvent.click(screen.getByRole("link", { name: "Create a Bet" }));

      expect(screen.getByText("Create Bet Page")).toBeInTheDocument();
  });
});
 
function fakeBet(id, overrides = {}) {
    return {
        id,
        title: `Bet ${id}`,
        status: "draft",
        visibility: "public",
        deadline: "2026-10-20T18:00:00.000Z",
        ...overrides,
    };
}
 
describe("HomePage Recent Bets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            currentUser: {uid: "abc123", email: "test@example.com"},
            loading: false,
            isAuthenticated: true,
        });
    });
 
    it("no longer shows the old placeholder text", async () => {
        fetchMyBets.mockResolvedValue([]);
 
        renderHomePage();
 
        await screen.findByText(/You haven't created any bets yet/);
        expect(screen.queryByText("Your bets will show up here soon.")).not.toBeInTheDocument();
    });
 
    it("shows a loading message while the Bets are loading", () => {
        // A promise that never resolves keeps the section in its loading state.
        fetchMyBets.mockReturnValue(new Promise(() => {}));
 
        renderHomePage();
 
        expect(screen.getByText("Loading your recent bets...")).toBeInTheDocument();
    });
 
    it("shows the 3 most recent Bets in the order the API returns them", async () => {
        fetchMyBets.mockResolvedValue([fakeBet("1"), fakeBet("2"), fakeBet("3")]);
 
        renderHomePage();
 
        const titles = await screen.findAllByRole("heading", { level: 3 });
        expect(titles.map((title) => title.textContent)).toEqual(["Bet 1", "Bet 2", "Bet 3"]);
        expect(fetchMyBets).toHaveBeenCalledTimes(1);
    });
 
    it("shows only the first 3 Bets when the API returns more", async () => {
        fetchMyBets.mockResolvedValue([
            fakeBet("1"), fakeBet("2"), fakeBet("3"), fakeBet("4"), fakeBet("5"),
        ]);
 
        renderHomePage();
 
        const titles = await screen.findAllByRole("heading", { level: 3 });
        expect(titles.map((title) => title.textContent)).toEqual(["Bet 1", "Bet 2", "Bet 3"]);
        expect(screen.queryByText("Bet 4")).not.toBeInTheDocument();
        expect(screen.queryByText("Bet 5")).not.toBeInTheDocument();
    });
 
    it("shows all Bets when the API returns fewer than 3", async () => {
        fetchMyBets.mockResolvedValue([fakeBet("1"), fakeBet("2")]);
 
        renderHomePage();
 
        const titles = await screen.findAllByRole("heading", { level: 3 });
        expect(titles.map((title) => title.textContent)).toEqual(["Bet 1", "Bet 2"]);
    });
 
    it("shows each Bet's status, visibility, and deadline", async () => {
        fetchMyBets.mockResolvedValue([
            fakeBet("1", { status: "active", visibility: "private" }),
        ]);
 
        renderHomePage();
 
        expect(await screen.findByText("active")).toBeInTheDocument();
        expect(screen.getByText("private")).toBeInTheDocument();
        expect(screen.getByText(/^Deadline:/)).toBeInTheDocument();
        expect(screen.queryByText("Deadline: No deadline")).not.toBeInTheDocument();
    });
 
    it("shows the empty state and keeps Create a Bet available when there are no Bets", async () => {
        fetchMyBets.mockResolvedValue([]);
 
        renderHomePage();
 
        expect(
            await screen.findByText("You haven't created any bets yet. Create a bet to get started!")
        ).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create a Bet" })).toHaveAttribute("href", "/bets/create");
    });
 
    it("shows an error for the section without hiding the rest of Home", async () => {
        fetchMyBets.mockRejectedValue(new Error("network error"));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
 
        renderHomePage();
 
        expect(
            await screen.findByText("Unable to load your recent bets right now. Please try again later.")
        ).toBeInTheDocument();
        // The rest of Home still works.
        expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Log Out" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Create a Bet" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "View all" })).toBeInTheDocument();
        // It is separate from the logout error, which uses role="alert".
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
 
        consoleSpy.mockRestore();
    });
    
    it("links each Recent Bet's title to its Bet Details page", async () => {
        fetchMyBets.mockResolvedValue([fakeBet("1"), fakeBet("2"), fakeBet("3")]);
 
        renderHomePage();
 
        expect(await screen.findByRole("link", { name: "Bet 1" })).toHaveAttribute("href", "/bets/1");
        expect(screen.getByRole("link", { name: "Bet 2" })).toHaveAttribute("href", "/bets/2");
        expect(screen.getByRole("link", { name: "Bet 3" })).toHaveAttribute("href", "/bets/3");
    });
 
    it("only links the 3 Bets it shows", async () => {
        fetchMyBets.mockResolvedValue([
            fakeBet("1"), fakeBet("2"), fakeBet("3"), fakeBet("4"),
        ]);
 
        renderHomePage();
 
        await screen.findByRole("link", { name: "Bet 1" });
        expect(screen.queryByRole("link", { name: "Bet 4" })).not.toBeInTheDocument();
    });
 
    it("opens the Bet Details page when a Recent Bet is clicked", async () => {
        fetchMyBets.mockResolvedValue([fakeBet("1"), fakeBet("2")]);
 
        render(
            <MemoryRouter initialEntries={["/home"]}>
                <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/bets/:betId" element={<p>Bet Details Page</p>} />
                </Routes>
            </MemoryRouter>
        );
 
        fireEvent.click(await screen.findByRole("link", { name: "Bet 2" }));
 
        expect(screen.getByText("Bet Details Page")).toBeInTheDocument();
    });

    it("has a View all link that goes to /my-bets", async () => {
        fetchMyBets.mockResolvedValue([fakeBet("1")]);
 
        render(
            <MemoryRouter initialEntries={["/home"]}>
                <Routes>
                    <Route path="/home" element={<HomePage />} />
                    <Route path="/my-bets" element={<p>My Bets Page</p>} />
                </Routes>
            </MemoryRouter>
        );
 
        const viewAll = await screen.findByRole("link", { name: "View all" });
        expect(viewAll).toHaveAttribute("href", "/my-bets");
        fireEvent.click(viewAll);
        expect(screen.getByText("My Bets Page")).toBeInTheDocument();
    });
 
    it("does not load Bets when the user is not logged in", () => {
        useAuth.mockReturnValue({ currentUser: null, loading: false, isAuthenticated: false });
 
        renderHomePage();
 
        expect(fetchMyBets).not.toHaveBeenCalled();
    });
});