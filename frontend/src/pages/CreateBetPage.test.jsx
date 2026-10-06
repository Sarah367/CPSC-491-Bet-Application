import { vi, describe, it, beforeEach, expect } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { apiPost, ApiError } from "../services/apiClient";
import CreateBetPage from "./CreateBetPage";

vi.mock("../context/useAuth", () => ({
    useAuth: vi.fn(),
}));

vi.mock("../services/apiClient", () => {
    class ApiError extends Error {
        constructor(status, body) {
            super(`Request failed with status ${status}`);
            this.name = "ApiError";
            this.status = status;
            this.body = body;
        }
    }
    class NotAuthenticatedError extends Error {
        constructor() {
            super("No signed-in user.");
            this.name = "NotAuthenticatedError";
        }
    }
    return { apiPost: vi.fn(), ApiError, NotAuthenticatedError };
});

function renderAtCreateBet() {
    return render(
        <MemoryRouter initialEntries={["/bets/create"]}>
            <Routes>
                <Route path="/bets/create" element={<CreateBetPage />} />
                <Route path="/login" element={<p>Login Page</p>} />
                <Route path="/home" element={<p>Home Page</p>} />
            </Routes>
        </MemoryRouter>
    );
}

// datetime-local inputs use local time with no timezone, e.g. "2026-10-01T17:00".
function toDateTimeLocal(date) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const tomorrow = toDateTimeLocal(new Date(Date.now() + 24 * 60 * 60 * 1000));

function fillBetDetails({ title = "Will the Dodgers win Friday?", deadline = tomorrow } = {}) {
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "Regular season game" } });
    fireEvent.change(screen.getByLabelText("Deadline"), { target: { value: deadline } });
    fireEvent.click(screen.getByRole("radio", { name: "External verification" }));
}

function submit() {
    fireEvent.click(screen.getByRole("button", { name: "Create Bet" }));
}

describe("CreateBetPage access", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            currentUser: { uid: "abc123", email: "test@example.com" },
            loading: false,
            isAuthenticated: true,
        });
    });

    it("shows a loading indicator while auth state is loading", () => {
        useAuth.mockReturnValue({ currentUser: null, loading: true, isAuthenticated: false });
        renderAtCreateBet();
        expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("redirects to /login when the user is not authenticated", () => {
        useAuth.mockReturnValue({ currentUser: null, loading: false, isAuthenticated: false });
        renderAtCreateBet();
        expect(screen.getByText("Login Page")).toBeInTheDocument();
    });

    it("renders the Create Bet page for an authenticated user", () => {
        renderAtCreateBet();
        expect(screen.getByRole("heading", { level: 1, name: "Create a Bet" })).toBeInTheDocument();
    });
});

describe("CreateBetPage form", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useAuth.mockReturnValue({
            currentUser: { uid: "abc123", email: "test@example.com" },
            loading: false,
            isAuthenticated: true,
        });
    });

    it("groups the radio options under labeled fieldsets", () => {
        renderAtCreateBet();
        expect(screen.getByRole("group", { name: "Visibility" })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Resolution Method" })).toBeInTheDocument();
        expect(screen.getByRole("group", { name: "Stake Type" })).toBeInTheDocument();
        expect(screen.getByRole("radio", { name: "Public" })).toBeChecked();
    });

    it("shows errors and does not call the API when required fields are empty", async () => {
        renderAtCreateBet();
        submit();

        expect(await screen.findByRole("alert")).toHaveTextContent("Please fix the highlighted fields.");
        expect(screen.getByText("Title is required.")).toBeInTheDocument();
        expect(screen.getByText("Description is required.")).toBeInTheDocument();
        expect(screen.getByText("Deadline is required.")).toBeInTheDocument();
        expect(screen.getByText("Choose how this bet will be resolved.")).toBeInTheDocument();
        expect(screen.getByText("Choose a stake type.")).toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it("shows amount and USD for monetary stakes, and description for non-monetary", () => {
        renderAtCreateBet();

        fireEvent.click(screen.getByRole("radio", { name: "Monetary" }));
        expect(screen.getByLabelText("Stake Amount ($)")).toBeInTheDocument();
        expect(screen.getByText("USD")).toBeInTheDocument();
        expect(screen.queryByLabelText("What's being wagered?")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        expect(screen.getByLabelText("What's being wagered?")).toBeInTheDocument();
        expect(screen.queryByLabelText("Stake Amount ($)")).not.toBeInTheDocument();
    });

    it("rejects an amount with more than 2 decimal places instead of rounding it", async () => {
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Monetary" }));
        fireEvent.change(screen.getByLabelText("Stake Amount ($)"), { target: { value: "10.999" } });
        submit();

        expect(await screen.findByText(/up to 2 decimal places/)).toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it("rejects a deadline in the past", async () => {
        renderAtCreateBet();
        fillBetDetails({ deadline: "2020-01-01T10:00" });
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.change(screen.getByLabelText("What's being wagered?"), { target: { value: "Loser buys dinner" } });
        submit();

        expect(await screen.findByText("Deadline must be in the future.")).toBeInTheDocument();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it("sends the exact monetary payload with cents and USD", async () => {
        apiPost.mockResolvedValueOnce({ message: "Bet created successfully.", bet: { id: "bet1", title: "Will the Dodgers win Friday?" } });
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Monetary" }));
        fireEvent.change(screen.getByLabelText("Stake Amount ($)"), { target: { value: "10.50" } });
        submit();

        await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
        expect(apiPost).toHaveBeenCalledWith("/bets", {
            title: "Will the Dodgers win Friday?",
            description: "Regular season game",
            deadline: new Date(tomorrow).toISOString(),
            visibility: "public",
            resolutionMethod: "external",
            stakeType: "monetary",
            stakeAmountCents: 1050,
            currency: "USD",
        });
    });

    it("drops stale monetary values after switching to non-monetary", async () => {
        apiPost.mockResolvedValueOnce({ message: "Bet created successfully.", bet: { id: "bet2", title: "Will the Dodgers win Friday?" } });
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Monetary" }));
        fireEvent.change(screen.getByLabelText("Stake Amount ($)"), { target: { value: "20" } });
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.change(screen.getByLabelText("What's being wagered?"), { target: { value: "  Loser buys dinner  " } });
        submit();

        await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
        const [, payload] = apiPost.mock.calls[0];
        expect(payload.stakeType).toBe("nonMonetary");
        expect(payload.stakeDescription).toBe("Loser buys dinner");
        expect(payload).not.toHaveProperty("stakeAmountCents");
        expect(payload).not.toHaveProperty("currency");
    });

    it("clears the old amount when switching stake type away and back", () => {
        renderAtCreateBet();
        fireEvent.click(screen.getByRole("radio", { name: "Monetary" }));
        fireEvent.change(screen.getByLabelText("Stake Amount ($)"), { target: { value: "20" } });
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.click(screen.getByRole("radio", { name: "Monetary" }));

        expect(screen.getByLabelText("Stake Amount ($)")).toHaveValue("");
    });

    it("shows a confirmation with the bet title after a successful submission", async () => {
        apiPost.mockResolvedValueOnce({ message: "Bet created successfully.", bet: { id: "bet3", title: "Will the Dodgers win Friday?" } });
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.change(screen.getByLabelText("What's being wagered?"), { target: { value: "Loser buys dinner" } });
        submit();

        expect(await screen.findByRole("heading", { name: "Bet created!" })).toBeInTheDocument();
        expect(screen.getByText("Will the Dodgers win Friday?")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute("href", "/home");
    });

    it("shows the backend's message when the API rejects the bet", async () => {
        apiPost.mockRejectedValueOnce(
            new ApiError(400, { error: "invalid_request", message: "deadline must be in the future." })
        );
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.change(screen.getByLabelText("What's being wagered?"), { target: { value: "Loser buys dinner" } });
        submit();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Couldn't create bet: deadline must be in the future."
        );
    });

    it("shows a generic message for unexpected failures", async () => {
        apiPost.mockRejectedValueOnce(new Error("network down"));
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.change(screen.getByLabelText("What's being wagered?"), { target: { value: "Loser buys dinner" } });
        submit();

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to create bet. Please try again.");
    });

    it("disables the submit button while the request is in flight", async () => {
        let resolveRequest;
        apiPost.mockReturnValueOnce(new Promise((resolve) => { resolveRequest = resolve; }));
        renderAtCreateBet();
        fillBetDetails();
        fireEvent.click(screen.getByRole("radio", { name: "Non-monetary" }));
        fireEvent.change(screen.getByLabelText("What's being wagered?"), { target: { value: "Loser buys dinner" } });
        submit();

        const button = await screen.findByRole("button", { name: "Creating..." });
        expect(button).toBeDisabled();
        fireEvent.click(button);
        expect(apiPost).toHaveBeenCalledTimes(1);

        resolveRequest({ message: "Bet created successfully.", bet: { id: "bet4", title: "Will the Dodgers win Friday?" } });
        expect(await screen.findByRole("heading", { name: "Bet created!" })).toBeInTheDocument();
    });
});