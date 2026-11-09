import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, within} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiGet} from "../services/apiClient";
import MyBetsPage from "../pages/MyBetsPage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/apiClient", () => ({
    apiGet: vi.fn(),
}));

const authenticatedUser = {
    currentUser: {uid: "user-a", email: "a@example.com"},
    loading: false,
    isAuthenticated: true,
};

function renderMyBetsPage() {
    return render(
        <MemoryRouter>
            <MyBetsPage/>
        </MemoryRouter>
    );
}

describe("MyBetsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a loading indicator while auth state is loading", () => {
        useAuth.mockReturnValue({currentUser: null, loading: true, isAuthenticated: false});

        renderMyBetsPage();

        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("shows a loading indicator while bets are being fetched", () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockReturnValue(new Promise(() => {}));

        renderMyBetsPage();

        expect(screen.getByText("Loading your bets...")).toBeInTheDocument();
    });

    it("redirects to /login when the user is not authenticated", () => {
        useAuth.mockReturnValue({currentUser: null, loading: false, isAuthenticated: false});

        render(
            <MemoryRouter initialEntries={["/my-bets"]}>
                <Routes>
                    <Route path="/my-bets" element={<MyBetsPage/>}/>
                    <Route path="/login" element={<p>Login Page</p>}/>
                </Routes>
            </MemoryRouter>
        );

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("requests /bets/mine without sending a uid", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({bets: []});

        renderMyBetsPage();
        await screen.findByText("You haven't created or joined any bets yet.");

        expect(apiGet).toHaveBeenCalledTimes(1);
        expect(apiGet).toHaveBeenCalledWith("/bets/mine");
    });

    it("shows an empty state when the user has no bets", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({bets: []});

        renderMyBetsPage();

        expect(await screen.findByText("You haven't created or joined any bets yet.")).toBeInTheDocument();
    });

    it("shows a friendly error message when the API call fails", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockRejectedValue(new Error("network error"));
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        renderMyBetsPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to load your bets. Please try again later."
        );
        consoleErrorSpy.mockRestore();
    });

    it("renders the user's bets with stakes and links to each bet's details page", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({
            bets: [
                {
                    id: "bet-1",
                    title: "Will the Dodgers win on Friday?",
                    status: "draft",
                    visibility: "private",
                    deadline: "2026-10-02T02:00:00.000Z",
                    stakeType: "monetary",
                    stakeAmountCents: 1050,
                    currency: "USD",
                },
                {
                    id: "bet-2",
                    title: "Will John wear green on Tuesday?",
                    status: "active",
                    visibility: "public",
                    deadline: "2026-10-06T17:00:00.000Z",
                    stakeType: "nonMonetary",
                    stakeDescription: "Loser buys dinner",
                },
            ],
        });

        renderMyBetsPage();

        const firstLink = await screen.findByRole("link", {name: "Will the Dodgers win on Friday?"});
        expect(firstLink).toHaveAttribute("href", "/bets/bet-1");
        expect(screen.getByRole("link", {name: "Will John wear green on Tuesday?"}))
            .toHaveAttribute("href", "/bets/bet-2");

        expect(screen.getByText(/10\.50/)).toBeInTheDocument();
        expect(screen.getByText(/Loser buys dinner/)).toBeInTheDocument();
        expect(screen.getByText(/draft/)).toBeInTheDocument();
        expect(screen.getByText(/private/)).toBeInTheDocument();
        expect(screen.queryByText("You haven't created or joined any bets yet.")).not.toBeInTheDocument();
    });

    it("labels Bets the user created and Bets the user joined in the same list", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({
            bets: [
                {
                    id: "own-bet",
                    title: "Will it rain on Friday?",
                    status: "draft",
                    visibility: "private",
                    deadline: "2026-11-20T18:00:00.000Z",
                    stakeType: "nonMonetary",
                    stakeDescription: "Loser buys coffee",
                    viewerRole: "creator",
                },
                {
                    id: "joined-bet",
                    title: "Will the Dodgers win on Friday?",
                    status: "active",
                    visibility: "public",
                    deadline: "2026-11-21T18:00:00.000Z",
                    stakeType: "monetary",
                    stakeAmountCents: 500,
                    currency: "USD",
                    viewerRole: "participant",
                },
            ],
        });

        renderMyBetsPage();

        const items = await screen.findAllByRole("listitem");
        expect(items).toHaveLength(2);
        expect(within(items[0]).getByRole("link", {name: "Will it rain on Friday?"}))
            .toHaveAttribute("href", "/bets/own-bet");
        expect(within(items[0]).getByText("You created this Bet")).toBeInTheDocument();
        expect(within(items[1]).getByRole("link", {name: "Will the Dodgers win on Friday?"}))
            .toHaveAttribute("href", "/bets/joined-bet");
        expect(within(items[1]).getByText("You joined this Bet")).toBeInTheDocument();
    });

    it("shows no role label when a Bet has no recognized viewerRole", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({
            bets: [
                {
                    id: "bet-1",
                    title: "Will it snow?",
                    status: "draft",
                    visibility: "public",
                    deadline: "2026-11-20T18:00:00.000Z",
                    stakeType: "nonMonetary",
                    stakeDescription: "Loser buys lunch",
                    viewerRole: "spectator",
                },
            ],
        });

        renderMyBetsPage();

        await screen.findByRole("link", {name: "Will it snow?"});
        expect(screen.queryByText(/You created this Bet|You joined this Bet/)).not.toBeInTheDocument();
    });

    // SCRUM-105: My Bets now loads through the shared useMyBets hook, which resets
    // when it runs again. Before, an old error could stay after logging back in.
    it("clears an earlier error and shows loading again when the user logs back in", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        // First login: the request fails, so the page shows its error.
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockRejectedValueOnce(new Error("network error"));
        const {rerender} = renderMyBetsPage();
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to load your bets. Please try again later."
        );

        // Log out and back in while the page stays mounted.
        useAuth.mockReturnValue({currentUser: null, loading: false, isAuthenticated: false});
        rerender(<MemoryRouter><MyBetsPage/></MemoryRouter>);

        let finishLoading;
        apiGet.mockReturnValueOnce(new Promise((resolve) => { finishLoading = resolve; }));
        useAuth.mockReturnValue(authenticatedUser);
        rerender(<MemoryRouter><MyBetsPage/></MemoryRouter>);

        // The old error is gone and the loading message is back.
        expect(await screen.findByText("Loading your bets...")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        // When the new request succeeds, its Bets show.
        finishLoading({
            bets: [{
                id: "bet-1",
                title: "Will it rain on Friday?",
                status: "draft",
                visibility: "public",
                deadline: "2026-11-20T18:00:00.000Z",
                stakeType: "nonMonetary",
                stakeDescription: "Loser buys coffee",
                viewerRole: "creator",
            }],
        });
        expect(await screen.findByRole("link", {name: "Will it rain on Friday?"})).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        consoleSpy.mockRestore();
    });
});
