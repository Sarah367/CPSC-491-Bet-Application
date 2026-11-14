import {useEffect, useState} from "react";
import {fetchMyBets} from "../services/betService";

// Shared by Home's Recent Bets and the My Bets page (SCRUM-105). The hook owns
// loading the user's Bets; each page still decides its own messages and layout.

// The state while a request is in flight, and after a reset.
const LOADING_STATE = Object.freeze({bets: [], loading: true, error: false});

// What the hook returns while it's turned off, for example while the user is logged
// out. It's a constant, so a disabled hook never needs to call setState.
const DISABLED_RESULT = Object.freeze({bets: [], loading: false, error: false});

// Loads the Bets the user created or joined, newest first.
//   limit   - optional. Only the newest `limit` Bets are requested (SCRUM-106).
//   enabled - when false (for example, logged out), nothing is requested.
// Returns { bets, loading, error }, where error is true if the request failed.
export function useMyBets({limit, enabled = true} = {}) {
    const [state, setState] = useState(LOADING_STATE);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        // Ignore the response if this request is replaced or the page unmounts first.
        let cancelled = false;

        async function loadBets() {
            try {
                const bets = limit === undefined ? await fetchMyBets() : await fetchMyBets(limit);
                if (!cancelled) {
                    setState({bets, loading: false, error: false});
                }
            } catch (err) {
                console.error("Failed to load your bets: ", err);
                if (!cancelled) {
                    setState({bets: [], loading: false, error: true});
                }
            }
        }

        loadBets();

        return () => {
            cancelled = true;
            // Reset for the next run (for example, logging out and back in while the
            // page stays mounted, or a new limit), so an earlier error or finished load
            // doesn't stay on screen. This is done here, not at the start of the effect,
            // because the react-hooks/set-state-in-effect lint rule doesn't allow that.
            setState(LOADING_STATE);
        };
    }, [enabled, limit]);

    return enabled ? state : DISABLED_RESULT;
}
