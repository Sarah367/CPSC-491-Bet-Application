import {vi, describe, it, beforeEach, afterEach, expect} from "vitest";
import {renderHook, waitFor, act} from "@testing-library/react";
import {fetchMyBets} from "../services/betService";
import {useMyBets} from "./useMyBets";

vi.mock("../services/betService", () => ({
    fetchMyBets: vi.fn(),
}));

// A promise the test resolves or rejects by hand, to control the order responses arrive.
function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
}

const BET_A = {id: "bet-a", title: "Bet A"};
const BET_B = {id: "bet-b", title: "Bet B"};

describe("useMyBets", () => {
    let consoleSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        consoleSpy.mockRestore();
    });

    it("starts loading, then returns the Bets with no limit", async () => {
        fetchMyBets.mockResolvedValue([BET_A, BET_B]);

        const {result} = renderHook(() => useMyBets());

        expect(result.current).toEqual({bets: [], loading: true, error: false});
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current).toEqual({bets: [BET_A, BET_B], loading: false, error: false});
        expect(fetchMyBets).toHaveBeenCalledTimes(1);
        expect(fetchMyBets).toHaveBeenCalledWith();
    });

    it("passes the limit to fetchMyBets", async () => {
        fetchMyBets.mockResolvedValue([BET_A]);

        const {result} = renderHook(() => useMyBets({limit: 3}));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(fetchMyBets).toHaveBeenCalledWith(3);
    });

    it("requests nothing and returns an empty, finished result when disabled", () => {
        const {result} = renderHook(() => useMyBets({enabled: false}));

        expect(fetchMyBets).not.toHaveBeenCalled();
        expect(result.current).toEqual({bets: [], loading: false, error: false});
    });

    it("reports an error with no Bets when the request fails", async () => {
        fetchMyBets.mockRejectedValue(new Error("network error"));

        const {result} = renderHook(() => useMyBets());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current).toEqual({bets: [], loading: false, error: true});
    });

    it("clears an earlier error and loads again when re-enabled", async () => {
        fetchMyBets.mockRejectedValueOnce(new Error("network error"));
        const {result, rerender} = renderHook(
            ({enabled}) => useMyBets({enabled}),
            {initialProps: {enabled: true}},
        );
        await waitFor(() => expect(result.current.error).toBe(true));

        // Log out: nothing is requested, and the old error isn't shown.
        rerender({enabled: false});
        expect(result.current).toEqual({bets: [], loading: false, error: false});

        // Log back in: it starts from loading, with no leftover error.
        const second = deferred();
        fetchMyBets.mockReturnValueOnce(second.promise);
        rerender({enabled: true});
        expect(result.current).toEqual({bets: [], loading: true, error: false});

        await act(async () => {
            second.resolve([BET_A]);
        });
        expect(result.current).toEqual({bets: [BET_A], loading: false, error: false});
    });

    it("ignores a slower, outdated response when the limit changes", async () => {
        const first = deferred();
        const second = deferred();
        fetchMyBets.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

        const {result, rerender} = renderHook(
            ({limit}) => useMyBets({limit}),
            {initialProps: {limit: 3}},
        );

        // A new limit starts a second request, which goes back to loading.
        rerender({limit: 5});
        expect(fetchMyBets).toHaveBeenNthCalledWith(1, 3);
        expect(fetchMyBets).toHaveBeenNthCalledWith(2, 5);
        expect(result.current.loading).toBe(true);

        // The newer request answers first, then the outdated one.
        await act(async () => {
            second.resolve([BET_B]);
        });
        await act(async () => {
            first.resolve([BET_A]);
        });

        expect(result.current).toEqual({bets: [BET_B], loading: false, error: false});
    });

    it("ignores a response that arrives after the page unmounts", async () => {
        const request = deferred();
        fetchMyBets.mockReturnValueOnce(request.promise);

        const {unmount} = renderHook(() => useMyBets());
        unmount();

        await act(async () => {
            request.resolve([BET_A]);
        });

        // No React warning about updating an unmounted component, or anything else.
        expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("ignores a failure that arrives after the page unmounts, apart from logging it", async () => {
        const request = deferred();
        fetchMyBets.mockReturnValueOnce(request.promise);

        const {unmount} = renderHook(() => useMyBets());
        unmount();

        await act(async () => {
            request.reject(new Error("network error"));
        });

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(consoleSpy.mock.calls[0][0]).toBe("Failed to load your bets: ");
    });
});
