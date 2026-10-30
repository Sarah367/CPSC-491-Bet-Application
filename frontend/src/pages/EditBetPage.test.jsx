import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, fireEvent} from "@testing-library/react";
import {MemoryRouter, Routes, Route, useLocation} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiGet, ApiError} from "../services/apiClient";
import {updateBet} from "../services/betService";
import EditBetPage from "./EditBetPage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/betService", () => ({
    updateBet: vi.fn(),
}));

vi.mock("../services/apiClient", () => ({
    apiGet: vi.fn(),
    NotAuthenticatedError: class NotAuthenticatedError extends Error {},
    ApiError: class ApiError extends Error {
        constructor(status, body) {
            super(`Request failed with status ${status}`);
            this.name = "ApiError";
            this.status = status;
            this.body = body;
        }
    },
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const creator = {loading: false, isAuthenticated: true, uid: "creator-uid", emailVerified: true};

function fakeBet(overrides = {}) {
    return {
        id: "bet-1",
        title: "Will it rain this weekend?",
        description: "Friendly weather bet.",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: "creator-uid",
        creatorSide: "A",
        visibility: "public",
        resolutionMethod: "personal",
        status: "draft",
        participantCount: 1,
        deadline: new Date(Date.now() + DAY_MS).toISOString(),
        outcomeDeadline: new Date(Date.now() + 2 * DAY_MS).toISOString(),
        stakeType: "nonMonetary",
        stakeDescription: "Loser buys coffee",
        ...overrides,
    };
}

// Shows where the page navigated after saving, and the notice it passed along.
function DetailsStandIn() {
    const location = useLocation();
    return <p>Bet Details Page: {location.state?.notice}</p>;
}

function renderEditPage() {
    return render(
        <MemoryRouter initialEntries={["/bets/bet-1/edit"]}>
            <Routes>
                <Route path="/bets/:betId/edit" element={<EditBetPage/>}/>
                <Route path="/bets/:betId" element={<DetailsStandIn/>}/>
                <Route path="/login" element={<p>Login Page</p>}/>
            </Routes>
        </MemoryRouter>
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue(creator);
    apiGet.mockResolvedValue({bet: fakeBet(), viewerParticipation: {side: "A", role: "creator"}});
});

describe("EditBetPage: loading the form", () => {
    it("loads the Bet and fills the form with its current values", async () => {
        renderEditPage();

        expect(await screen.findByLabelText("Title")).toHaveValue("Will it rain this weekend?");
        expect(apiGet).toHaveBeenCalledWith("/bets/bet-1");
        expect(screen.getByLabelText("Description")).toHaveValue("Friendly weather bet.");
        expect(screen.getByLabelText("Outcome A")).toHaveValue("Rain");
        expect(screen.getByLabelText("What's being wagered?")).toHaveValue("Loser buys coffee");
        expect(screen.getByLabelText("Rain", {selector: "input[name='creatorSide']"})).toBeChecked();
    });

    it("doesn't show a terms checkbox", async () => {
        renderEditPage();

        await screen.findByLabelText("Title");
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    it("redirects to login when signed out", () => {
        useAuth.mockReturnValue({loading: false, isAuthenticated: false});

        renderEditPage();

        expect(screen.getByText("Login Page")).toBeInTheDocument();
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("asks an unverified user to verify their email first", async () => {
        useAuth.mockReturnValue({...creator, emailVerified: false});

        renderEditPage();

        expect(await screen.findByRole("heading", {name: "Verify your email first"})).toBeInTheDocument();
        expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    });

    it("shows a not-found message for a missing Bet", async () => {
        apiGet.mockRejectedValue(new ApiError(404, {error: "not_found"}));

        renderEditPage();

        expect(await screen.findByRole("heading", {name: "Bet not found"})).toBeInTheDocument();
    });

    it.each([
        ["someone who isn't the creator", {}, {uid: "someone-else"}],
        ["a Bet someone else has joined", {participantCount: 2}, {}],
        ["an Active Bet", {status: "active"}, {}],
        ["a Bet past its deadline", {deadline: new Date(Date.now() - 1000).toISOString()}, {}],
    ])("doesn't show the form to %s", async (_label, betOverrides, authOverrides) => {
        apiGet.mockResolvedValue({bet: fakeBet(betOverrides), viewerParticipation: null});
        useAuth.mockReturnValue({...creator, ...authOverrides});

        renderEditPage();

        expect(await screen.findByRole("heading", {name: "This bet can't be edited"})).toBeInTheDocument();
        expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
    });
});

describe("EditBetPage: saving", () => {
    it("saves the changes and goes back to Bet Details with a notice", async () => {
        updateBet.mockResolvedValue({message: "Bet updated successfully."});
        renderEditPage();

        fireEvent.change(await screen.findByLabelText("Title"), {target: {name: "title", value: "Will it rain on Sunday?"}});
        fireEvent.click(screen.getByLabelText("No rain", {selector: "input[name='creatorSide']"}));
        fireEvent.click(screen.getByRole("button", {name: "Save Changes"}));

        expect(await screen.findByText("Bet Details Page: Bet updated.")).toBeInTheDocument();
        expect(updateBet).toHaveBeenCalledTimes(1);
        const [betId, payload] = updateBet.mock.calls[0];
        expect(betId).toBe("bet-1");
        expect(payload).toMatchObject({
            title: "Will it rain on Sunday?",
            creatorSide: "B",
            stakeType: "nonMonetary",
            stakeDescription: "Loser buys coffee",
        });
        expect(payload).not.toHaveProperty("termsAcknowledged");
    });

    it("shows field errors and doesn't save when a rule is broken", async () => {
        renderEditPage();

        fireEvent.change(await screen.findByLabelText("Outcome B"), {target: {name: "outcomeB", value: " rain "}});
        fireEvent.click(screen.getByRole("button", {name: "Save Changes"}));

        expect(await screen.findByText("Outcome B must be different from Outcome A.")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
        expect(updateBet).not.toHaveBeenCalled();
    });

    it("disables the button and says Saving... while the request is in progress", async () => {
        updateBet.mockReturnValue(new Promise(() => {}));
        renderEditPage();

        fireEvent.click(await screen.findByRole("button", {name: "Save Changes"}));

        const button = await screen.findByRole("button", {name: "Saving..."});
        expect(button).toBeDisabled();
    });

    it.each([
        [409, {error: "bet_not_editable"}, "This bet can no longer be edited."],
        [400, {error: "invalid_request", message: "outcomeDeadline must be after deadline."}, "Couldn't save changes: outcomeDeadline must be after deadline."],
        [404, {error: "not_found"}, "This bet doesn't exist."],
        [403, {error: "email_not_verified"}, "Please verify your email before editing a bet."],
    ])("shows a message for a %i response and stays on the form", async (status, body, message) => {
        updateBet.mockRejectedValue(new ApiError(status, body));
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        renderEditPage();

        fireEvent.click(await screen.findByRole("button", {name: "Save Changes"}));

        expect(await screen.findByRole("alert")).toHaveTextContent(message);
        expect(screen.getByRole("button", {name: "Save Changes"})).toBeEnabled();
        expect(screen.queryByText(/Bet Details Page/)).not.toBeInTheDocument();
        consoleSpy.mockRestore();
    });

    it("has a Cancel link back to the Bet", async () => {
        renderEditPage();

        expect(await screen.findByRole("link", {name: "Cancel"})).toHaveAttribute("href", "/bets/bet-1");
    });
});
