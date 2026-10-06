import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen} from "@testing-library/react";
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
        await screen.findByText("You haven't created any bets yet.");

        expect(apiGet).toHaveBeenCalledTimes(1);
        expect(apiGet).toHaveBeenCalledWith("/bets/mine");
    });

    it("shows an empty state when the user has no bets", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({bets: []});

        renderMyBetsPage();

        expect(await screen.findByText("You haven't created any bets yet.")).toBeInTheDocument();
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
        expect(screen.queryByText("You haven't created any bets yet.")).not.toBeInTheDocument();
    });
});
