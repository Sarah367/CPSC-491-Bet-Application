import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {MemoryRouter, Routes, Route} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiGet, ApiError} from "../services/apiClient";
import BetDetailsPage from "../pages/BetDetailsPage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
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
