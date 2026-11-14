import { vi, describe, it, beforeEach, expect } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
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

    it("renders public bets with title, deadline, status, and creator", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet({creatorDisplayName: "Jordan Rivera"})]);

        renderPage();

        expect(await screen.findByText("Will the Dodgers win on Friday?")).toBeInTheDocument();
        expect(screen.getByText("active")).toBeInTheDocument();
        // SCRUM-87: the creator's name, never their raw uid.
        expect(screen.getByText("Jordan Rivera")).toBeInTheDocument();
        expect(screen.queryByText("creator-uid")).not.toBeInTheDocument();
    });

    it.each([
        ["null", null],
        ["missing", undefined],
    ])("shows Unknown when the creator's name is %s, not their uid", async (_label, creatorDisplayName) => {
        fetchPublicBets.mockResolvedValue([fakeBet({creatorDisplayName})]);

        renderPage();

        expect(await screen.findByText("Unknown")).toBeInTheDocument();
        expect(screen.queryByText("creator-uid")).not.toBeInTheDocument();
    });

    // SCRUM-103: Public Bets uses the shared formatDeadline, so a missing or invalid
    // deadline shows "No deadline" instead of a blank cell or the raw value.
    it.each([
        ["missing", undefined],
        ["invalid", "not a date"],
    ])("shows No deadline when a Bet's deadline is %s", async (_label, deadline) => {
        fetchPublicBets.mockResolvedValue([fakeBet({deadline})]);

        renderPage();

        expect(await screen.findByText("No deadline")).toBeInTheDocument();
        expect(screen.queryByText("not a date")).not.toBeInTheDocument();
    });

    it("shows the deadline with the full month name, like the other Bet pages", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet({deadline: "2026-11-15T12:00:00.000Z"})]);

        renderPage();

        expect(await screen.findByText(/November 15, 2026/)).toBeInTheDocument();
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

    it("doesn't also show the empty message or a list when the fetch fails", async () => {
        fetchPublicBets.mockRejectedValue(new Error("network error"));

        renderPage();

        await screen.findByRole("alert");
        expect(screen.queryByText("No public bets yet.")).not.toBeInTheDocument();
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
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
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("shows the list without an error when the fetch succeeds", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet()]);

        renderPage();

        expect(await screen.findByRole("list")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByText("No public bets yet.")).not.toBeInTheDocument();
    });


    // SCRUM-109: one card per Bet, in a list, each opening its details page.
    it("shows one card per Bet, each with its own title, status, and deadline", async () => {
        fetchPublicBets.mockResolvedValue([
            fakeBet({id: "bet-1", title: "First Bet", status: "draft", deadline: "2026-11-15T12:00:00.000Z"}),
            fakeBet({id: "bet-2", title: "Second Bet", status: "active", deadline: "2026-12-20T12:00:00.000Z"}),
        ]);

        renderPage();

        const items = await screen.findAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(within(items[0]).getByText("First Bet")).toBeInTheDocument();
        expect(within(items[0]).getByText("draft")).toBeInTheDocument();
        expect(within(items[0]).getByText(/November 15, 2026/)).toBeInTheDocument();
        expect(within(items[1]).getByText("Second Bet")).toBeInTheDocument();
        expect(within(items[1]).getByText("active")).toBeInTheDocument();
        expect(within(items[1]).getByText(/December 20, 2026/)).toBeInTheDocument();
    });

    it("links each card's title to that Bet's details page", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet({id: "bet-42", title: "Linked Bet"})]);

        renderPage();

        const link = await screen.findByRole("link", {name: "Linked Bet"});
        expect(link).toHaveAttribute("href", "/bets/bet-42");
    });

    it("labels the deadline and creator on each card", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet({creatorDisplayName: "Jordan Rivera"})]);

        renderPage();

        const card = await screen.findByRole("listitem");
        expect(within(card).getByText("Deadline")).toBeInTheDocument();
        expect(within(card).getByText("Creator")).toBeInTheDocument();
    });

    it("has a link back to Home", async () => {
        fetchPublicBets.mockResolvedValue([]);

        renderPage();

        await screen.findByText("No public bets yet.");
        expect(screen.getByRole("link", {name: "Back to Home"})).toHaveAttribute("href", "/home");
    });

    it("fetches public bets only once auth resolves", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet()]);

        renderPage();

        await waitFor(() => {
            expect(fetchPublicBets).toHaveBeenCalledTimes(1);
        });
    });
});
