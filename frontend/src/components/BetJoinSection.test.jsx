import {vi, describe, it, beforeEach, expect} from "vitest";
import {render, screen, fireEvent, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {joinBet} from "../services/betService";
import BetJoinSection from "./BetJoinSection";

vi.mock("../services/betService", () => ({
    joinBet: vi.fn(),
}));

const DAY_MS = 24 * 60 * 60 * 1000;

function fakeBet(overrides = {}) {
    return {
        id: "bet-1",
        title: "Will it rain this weekend?",
        outcomeA: "Rain",
        outcomeB: "No rain",
        creatorUid: "creator-uid",
        visibility: "public",
        status: "draft",
        deadline: new Date(Date.now() + DAY_MS).toISOString(),
        participantCount: 1,
        ...overrides,
    };
}

function renderSection(props = {}) {
    const onJoined = vi.fn();
    render(
        <MemoryRouter>
            <BetJoinSection
                bet={fakeBet()}
                viewerParticipation={null}
                uid="viewer-uid"
                emailVerified={true}
                onJoined={onJoined}
                {...props}
            />
        </MemoryRouter>
    );
    return {onJoined};
}

function apiError(status, error) {
    return Object.assign(new Error(`Request failed with status ${status}`), {
        status,
        body: {error, message: "Server message."},
    });
}

function fillForm(outcome = "No rain") {
    fireEvent.click(screen.getByLabelText(outcome));
    fireEvent.click(screen.getByLabelText("I understand and agree to the terms of this Bet."));
}

describe("BetJoinSection: what it shows", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows the Join form with each outcome as a side for an eligible user", () => {
        renderSection();

        expect(screen.getByRole("heading", {name: "Join this Bet"})).toBeInTheDocument();
        expect(screen.getByLabelText("Rain")).toBeInTheDocument();
        expect(screen.getByLabelText("No rain")).toBeInTheDocument();
        expect(screen.getByRole("button", {name: "Join Bet"})).toBeInTheDocument();
    });

    it("shows the side a user already joined instead of the form", () => {
        renderSection({viewerParticipation: {side: "B", role: "participant"}});

        expect(screen.getByText(/You joined this Bet/)).toHaveTextContent("You joined this Bet and picked No rain.");
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });

    it("shows the creator's side instead of the form", () => {
        renderSection({uid: "creator-uid", viewerParticipation: {side: "A", role: "creator"}});

        expect(screen.getByText(/You created this Bet/)).toHaveTextContent("You created this Bet and picked Rain.")
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });

    it("shows a Verify Email link instead of the form to an unverified user", () => {
        renderSection({emailVerified: false});

        expect(screen.getByText("Verify your email before joining this Bet.")).toBeInTheDocument();
        expect(screen.getByRole("link", {name: "Verify Email"})).toHaveAttribute("href", "/verify-email");
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });

    it.each([
        ["a private Bet", {visibility: "private"}],
        ["a locked Bet", {status: "locked"}],
        ["a Bet past its deadline", {deadline: new Date(Date.now() - 1000).toISOString()}],
    ])("shows nothing for %s", (_label, overrides) => {
        renderSection({bet: fakeBet(overrides)});

        expect(screen.queryByRole("region")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });

    it("shows nothing to the creator before their participation loads", () => {
        renderSection({uid: "creator-uid"});

        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });
});

describe("BetJoinSection: the Join button", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("stays disabled until a side is picked and the terms box is checked", () => {
        renderSection();
        const button = screen.getByRole("button", {name: "Join Bet"});

        expect(button).toBeDisabled();
        fireEvent.click(screen.getByLabelText("Rain"));
        expect(button).toBeDisabled();
        fireEvent.click(screen.getByLabelText("I understand and agree to the terms of this Bet."));
        expect(button).toBeEnabled();
    });

    it("stays disabled with only the terms box checked", () => {
        renderSection();

        fireEvent.click(screen.getByLabelText("I understand and agree to the terms of this Bet."));

        expect(screen.getByRole("button", {name: "Join Bet"})).toBeDisabled();
    });

    it("sends the chosen side and passes the server's response to onJoined", async () => {
        const response = {
            message: "Joined bet successfully.",
            bet: fakeBet({participantCount: 2}),
            viewerParticipation: {side: "B", role: "participant"},
        };
        joinBet.mockResolvedValue(response);
        const {onJoined} = renderSection();

        fillForm("No rain");
        fireEvent.click(screen.getByRole("button", {name: "Join Bet"}));

        await waitFor(() => expect(onJoined).toHaveBeenCalledWith(response));
        expect(joinBet).toHaveBeenCalledWith("bet-1", {side: "B", termsAcknowledged: true});
    });

    it("is disabled and says Joining... while the request is in progress", async () => {
        joinBet.mockReturnValue(new Promise(() => {}));
        renderSection();

        fillForm();
        fireEvent.click(screen.getByRole("button", {name: "Join Bet"}));

        const button = await screen.findByRole("button", {name: "Joining..."});
        expect(button).toBeDisabled();
        expect(joinBet).toHaveBeenCalledTimes(1);
    });
});

describe("BetJoinSection: errors", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    async function submitWithError(error) {
        joinBet.mockRejectedValue(error);
        const {onJoined} = renderSection();
        fillForm();
        fireEvent.click(screen.getByRole("button", {name: "Join Bet"}));
        const alert = await screen.findByRole("alert");
        expect(onJoined).not.toHaveBeenCalled();
        return alert;
    }

    it("shows a Verify Email link for a 403", async () => {
        const alert = await submitWithError(apiError(403, "email_not_verified"));

        expect(alert).toHaveTextContent("Verify your email before joining this Bet.");
        expect(screen.getByRole("link", {name: "Verify Email"})).toHaveAttribute("href", "/verify-email");
    });

    it("shows a friendly message for a 404", async () => {
        const alert = await submitWithError(apiError(404, "not_found"));

        expect(alert).toHaveTextContent("This Bet is no longer available.");
    });

    it.each([
        ["already_joined", "You have already joined this Bet."],
        ["bet_closed", "This Bet is no longer accepting participants."],
        ["creator_cannot_join", "You created this Bet, so you're already on your chosen side."],
    ])("shows a message and hides the form for a 409 %s", async (code, message) => {
        const alert = await submitWithError(apiError(409, code));

        expect(alert).toHaveTextContent(message);
        expect(screen.queryByRole("button", {name: "Join Bet"})).not.toBeInTheDocument();
    });

    it("shows a generic message for an unexpected error and keeps the form", async () => {
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        const alert = await submitWithError(new Error("network error"));

        expect(alert).toHaveTextContent("Unable to join this Bet. Please try again.");
        expect(screen.getByRole("button", {name: "Join Bet"})).toBeEnabled();
        consoleSpy.mockRestore();
    });
});
