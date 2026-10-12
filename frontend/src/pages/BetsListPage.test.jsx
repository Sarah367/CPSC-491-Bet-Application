import { vi, describe, it, beforeEach, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

    it("fetches public bets only once auth resolves", async () => {
        fetchPublicBets.mockResolvedValue([fakeBet()]);

        renderPage();

        await waitFor(() => {
            expect(fetchPublicBets).toHaveBeenCalledTimes(1);
        });
    });
});
