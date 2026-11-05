import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiGet, ApiError} from "../services/apiClient";
import {joinBet} from "../services/betService";
import BetDetailsPage from "../pages/BetDetailsPage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/betService", () => ({
    joinBet: vi.fn(),
}));

vi.mock("../services/apiClient", () => ({
    apiGet: vi.fn(),
    ApiError: class ApiError extends Error {
        constructor(status, body) {
            super(`Request failed with status ${status}`);
            this.name = "ApiError";
            this.status = status;
            this.body = body;
        }
    },
}));

const authenticatedUser = {
    loading: false,
    isAuthenticated: true,
};

function renderBetDetailsPage(betId = "bet-1") {
    return render(
        <MemoryRouter initialEntries={[`/bets/${betId}`]}>
            <Routes>
                <Route path="/bets/:betId" element={<BetDetailsPage/>}/>
                <Route path="/login" element={<p>Login Page</p>}/>
            </Routes>
        </MemoryRouter>
    );
}

function fakeBet(overrides = {}) {
    return {
        id: "bet-1",
        title: "Will the Dodgers win on Friday?",
        description: "Friendly wager on Friday's game.",
        creatorDisplayName: "Jordan Rivera",
        deadline: "2026-12-31T18:00:00.000Z",
        visibility: "private",
        resolutionMethod: "external",
        status: "active",
        ...overrides,
    };
}

describe("BetDetailsPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows a loading indicator while auth state is loading", () => {
        useAuth.mockReturnValue({loading: true, isAuthenticated: false});

        renderBetDetailsPage();

        expect(screen.getByText("Loading...")).toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("redirects to /login when the user is not authenticated", () => {
        useAuth.mockReturnValue({loading: false, isAuthenticated: false});

        renderBetDetailsPage();

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("shows a loading indicator while the bet is being fetched", () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockReturnValue(new Promise(() => {}));

        renderBetDetailsPage();

        expect(screen.getByText("Loading bet...")).toBeInTheDocument();
    });

    it("requests the bet by id from the URL", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({bet: fakeBet()});

        renderBetDetailsPage("bet-42");

        await screen.findByText("Will the Dodgers win on Friday?");

        expect(apiGet).toHaveBeenCalledWith("/bets/bet-42");
    });

    it("shows a not-found message (not a generic error) on a 404", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockRejectedValue(new ApiError(404, {error: "not_found"}));

        renderBetDetailsPage();

        expect(await screen.findByText("This bet doesn't exist.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("shows a generic error message on a non-404 API failure", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockRejectedValue(new ApiError(500, {error: "server_error"}));
        const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        renderBetDetailsPage();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Unable to load this bet. Please try again later."
        );
        consoleErrorSpy.mockRestore();
    });

    it("renders every field from the acceptance criteria for a loaded bet", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({bet: fakeBet()});

        renderBetDetailsPage();

        expect(await screen.findByText("Will the Dodgers win on Friday?")).toBeInTheDocument();
        expect(screen.getByText("Friendly wager on Friday's game.")).toBeInTheDocument();
        expect(screen.getByText("Jordan Rivera")).toBeInTheDocument();
        expect(screen.getByText("private")).toBeInTheDocument();
        expect(screen.getByText("External data")).toBeInTheDocument();
        expect(screen.getByText("active")).toBeInTheDocument();
    });

    it("renders 'Unknown' for the creator when creatorDisplayName is null", async () => {
        useAuth.mockReturnValue(authenticatedUser);
        apiGet.mockResolvedValue({bet: fakeBet({creatorDisplayName: null})});

        renderBetDetailsPage();

        await screen.findByText("Will the Dodgers win on Friday?");
        expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
});

describe("BetDetailsPage: outcomes and joining (SCRUM-88)", () => {
    const viewer = {loading: false, isAuthenticated: true, uid: "viewer-uid", emailVerified: true};
 
    function joinableBet(overrides = {}) {
        return fakeBet({
            visibility: "public",
            status: "draft",
            creatorUid: "creator-uid",
            outcomeA: "Rain",
            outcomeB: "No rain",
            participantCount: 1,
            ...overrides,
        });
    }
 
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue(viewer);
    });
 
    it("shows both outcomes and the participant count", async () => {
        apiGet.mockResolvedValue({bet: joinableBet(), viewerParticipation: null});
 
        renderBetDetailsPage();
 
        expect(await screen.findByText("Outcome A")).toBeInTheDocument();
        expect(screen.getByText("Rain", {selector: "dd"})).toBeInTheDocument();
        expect(screen.getByText("No rain", {selector: "dd"})).toBeInTheDocument();
        expect(screen.getByText("Participants")).toBeInTheDocument();
        expect(screen.getByText("1", {selector: "dd"})).toBeInTheDocument();
    });
 
    it("shows the side the user already joined when the page loads", async () => {
        apiGet.mockResolvedValue({
            bet: joinableBet({participantCount: 2}),
            viewerParticipation: {side: "B", role: "participant"},
        });
 
        renderBetDetailsPage();
 
        expect(await screen.findByText(/You joined this Bet/)).toHaveTextContent("You joined this Bet and picked No rain.");
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });
 
    it("updates the page from the join response after joining", async () => {
        apiGet.mockResolvedValue({bet: joinableBet(), viewerParticipation: null});
        joinBet.mockResolvedValue({
            message: "Joined bet successfully.",
            bet: joinableBet({participantCount: 2}),
            viewerParticipation: {side: "A", role: "participant"},
        });
 
        renderBetDetailsPage();
        fireEvent.click(await screen.findByLabelText("Rain"));
        fireEvent.click(screen.getByLabelText("I understand and agree to the terms of this Bet."));
        fireEvent.click(screen.getByRole("button", {name: "Join Bet"}));
 
        expect(await screen.findByText(/You joined this Bet/)).toHaveTextContent("You joined this Bet and picked Rain.");
        expect(screen.getByText("2", {selector: "dd"})).toBeInTheDocument();
        // The join response already has the updated Bet, so the page doesn't load it again.
        expect(apiGet).toHaveBeenCalledTimes(1);
    });
 
    it("doesn't show the Join section when the Bet fails to load", async () => {
        apiGet.mockRejectedValue(new ApiError(404, {error: "not_found"}));
 
        renderBetDetailsPage();
 
        expect(await screen.findByText("This bet doesn't exist.")).toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });
});