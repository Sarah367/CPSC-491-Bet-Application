import { vi, describe, it, beforeEach, expect } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useParams } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { fetchPublicBets } from "../services/betService";
import BetsListPage from "../pages/BetsListPage";

vi.mock("../services/betService", () => ({
    fetchPublicBets: vi.fn(),
}));

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

function renderPage() {
    return render(
        <MemoryRouter>
            <BetsListPage />
        </MemoryRouter>
    );
}

function fakeBet(overrides = {}) {
    return {
        id: "bet-1",
        title: "Will the Dodgers win on Friday?",
        deadline: "2026-12-31T00:00:00.000Z",
        visibility: "public",
        status: "active",
        creatorUid: "creator-uid",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...overrides,
    };
}

describe("BetsListPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    });

    it("shows a loading indicator while auth state is loading", () => {
        useAuth.mockReturnValue({ loading: true, isAuthenticated: false });

        renderPage();

        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("redirects to /login when the user is not authenticated", () => {
        useAuth.mockReturnValue({ loading: false, isAuthenticated: false });

        render(
            <MemoryRouter initialEntries={["/bets"]}>
                <Routes>
                    <Route path="/bets" element={<BetsListPage />} />
                    <Route path="/login" element={<p>Login Page</p>} />
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText("Login Page")).toBeInTheDocument();
    });

    it("renders public bets with title, deadline, visibility, status, and creator", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet()]);

        renderPage();

        expect(await screen.findByText("Will the Dodgers win on Friday?")).toBeInTheDocument();
        expect(screen.getByText("public")).toBeInTheDocument();
        expect(screen.getByText("active")).toBeInTheDocument();
        expect(screen.getByText("creator-uid")).toBeInTheDocument();
    });

    it("shows an empty state when there are no public bets", async () => {
        fetchPublicBets.mockResolvedValue([]);

        renderPage();

        expect(await screen.findByText("No public bets yet.")).toBeInTheDocument();
    });

    it("shows an error message when the fetch fails", async () => {
        fetchPublicBets.mockRejectedValue(new Error("network error"));

        renderPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to load bets. Please try again."
        );
    });

    it("doesn't also show the empty message or a table when the fetch fails", async () => {
        fetchPublicBets.mockRejectedValue(new Error("network error"));

        renderPage();

        await screen.findByRole("alert");
        expect(screen.queryByText("No public bets yet.")).not.toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("doesn't show an error with the empty message when there are no bets", async () => {
        fetchPublicBets.mockResolvedValue([]);

        renderPage();

        await screen.findByText("No public bets yet.");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows only the loading message while bets are loading", async () => {
        fetchPublicBets.mockReturnValue(new Promise(() => {}));

        renderPage();

        expect(await screen.findByText("Loading bets...")).toBeInTheDocument();
        expect(screen.queryByText("No public bets yet.")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });

    it("shows the list without an error when the fetch succeeds", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet()]);

        renderPage();

        expect(await screen.findByRole("table")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByText("No public bets yet.")).not.toBeInTheDocument();
    });



    it("fetches public bets only once auth resolves", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet()]);

        renderPage();

        await waitFor(() => {
            expect(fetchPublicBets).toHaveBeenCalledTimes(1);
        });
    });
});

describe("BetsListPage: bet links and auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({ loading: false, isAuthenticated: true });
    });

    it("shows every bet, in the order the API returned them", async () => {
        fetchPublicBets.mockResolvedValue([
            fakeBet({ id: "bet-3", title: "Third bet" }),
            fakeBet({ id: "bet-1", title: "First bet" }),
            fakeBet({ id: "bet-2", title: "Second bet" }),
        ]);

        renderPage();

        await screen.findByRole("link", { name: "Third bet" });
        expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
            "Third bet",
            "First bet",
            "Second bet",
        ]);
    });

    it("links each title to /bets/:id", async () => {
        fetchPublicBets.mockResolvedValue([
            fakeBet({ id: "bet-1", title: "First bet" }),
            fakeBet({ id: "bet-2", title: "Second bet" }),
        ]);

        renderPage();

        expect(await screen.findByRole("link", { name: "First bet" })).toHaveAttribute("href", "/bets/bet-1");
        expect(screen.getByRole("link", { name: "Second bet" })).toHaveAttribute("href", "/bets/bet-2");
    });

    it("opens the /bets/:betId route when a title is clicked", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet({ id: "bet-7", title: "Lucky bet" })]);

        function BetRoute() {
            const { betId } = useParams();
            return <p>Bet page for {betId}</p>;
        }

        render(
            <MemoryRouter initialEntries={["/bets"]}>
                <Routes>
                    <Route path="/bets" element={<BetsListPage />} />
                    <Route path="/bets/:betId" element={<BetRoute />} />
                </Routes>
            </MemoryRouter>
        );

        fireEvent.click(await screen.findByRole("link", { name: "Lucky bet" }));

        expect(await screen.findByText("Bet page for bet-7")).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "Lucky bet" })).not.toBeInTheDocument();
    });

    it("doesn't fetch public bets when the user is signed out", () => {
        useAuth.mockReturnValue({ loading: false, isAuthenticated: false });

        renderPage();

        expect(fetchPublicBets).not.toHaveBeenCalled();
    });

    it("doesn't fetch public bets while auth is loading", () => {
        useAuth.mockReturnValue({ loading: true, isAuthenticated: false });

        renderPage();

        expect(fetchPublicBets).not.toHaveBeenCalled();
    });
});
