import {useState} from "react";
import {Link} from "react-router-dom";
import {joinBet} from "../services/betService";
import {canJoinBet, outcomeForSide} from "../utils/betJoinEligibility";
import "./BetJoinSection.css";
 
const SIDES = ["A", "B"];

// friendly message for each join error from the backend (SCRUM-54)
const CONFLICT_MESSAGES = {
    already_joined: "You have already joined this Bet.",
    creator_cannot_join: "You created this Bet, so you're already on your chosen side.",
    bet_closed: "This Bet is no longer accepting participants.",
};

function getJoinError(err) {
    const status = err?.status;
    const code = err?.body?.error;

    if (status === 403) {
        return { message: "Verify your email before joining this Bet.", showVerifyLink: true};
    }
    if (status === 404) {
        return {message: "This Bet is no longer available."};
    }
    if (status === 409) {
        return {
            message: CONFLICT_MESSAGES[code] ?? "You can't join this Bet right now.",
            hideForm: true,
        };
    }
    return {message: "Unable to join this Bet. Please try again."};
}

// the join section on the Bet Details page. It shows one of:
// - the side the viewer is on, if they've already joined (or created the Bet)
// - a Verify Email prompt, if they could join but haven't verified their email.
// - the Join form, if they can join
// - nothing, otherwise
// onJoined receives the server's response ({bet, viewerParticipation}), which already 
// contains the updated Bet, so the page can update without a second request.

function BetJoinSection({bet, viewerParticipation, uid, emailVerified, onJoined}) {
    const [side, setSide] = useState("");
    const [termsAcknowledged, setTermsAcknowledged] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [joinError, setJoinError] = useState(null);

    if (viewerParticipation) {
        const outcome = outcomeForSide(bet, viewerParticipation.side);
        return (
            <section className = "bet-join" aria-label="Your side">
                <p className="bet-join-joined">
                    {viewerParticipation.role === "creator"
                        ? <>You created this Bet and picked <strong>{outcome}</strong>.</>
                        : <>You joined this Bet and picked <strong>{outcome}</strong>.</>}
                </p>
            </section>
        );
    }

    if (!canJoinBet({bet, uid, viewerParticipation})) {
        return null;
    }

    if (emailVerified === false) {
        return (
            <section className="bet-join" aria-label="Join this Bet">
                <h2 className="bet-join-title">Join this Bet</h2>
                <p className="bet-join-text">Verify your email before joining this Bet.</p>
                <Link to="/verify-email" className="bet-join-link">Verify Email</Link>
            </section>
        );
    }

    if (joinError?.hideForm) {
        return (
            <section className="bet-join" aria-label="Join this Bet">
                <p role="alert" className="bet-join-error">{joinError.message}</p>
            </section>
        );
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setJoinError(null);
        setSubmitting(true);
        try {
            const data = await joinBet(bet.id, {side, termsAcknowledged});
            onJoined?.(data);
        } catch (err) {
            if (!err?.status) {
                console.error("Failed to join bet: " , err);
            }
            setJoinError(getJoinError(err));
        } finally {
            setSubmitting(false);
        }
    }
    const canSubmit = side !== "" && termsAcknowledged && !submitting;

    return (
        <section className="bet-join" aria-label="Join this Bet">
            <h2 className="bet-join-title">Join this Bet</h2>
            <form onSubmit={handleSubmit} noValidate>
                <fieldset className="bet-join-sides">
                    <legend>Pick your side</legend>
                    {SIDES.map((value) => (
                        <label key={value} className="bet-join-radio">
                            <input
                                type="radio"
                                name="side"
                                value={value}
                                checked={side === value}
                                onChange={(event) => setSide(event.target.value)}
                            />
                            <span>{outcomeForSide(bet, value)}</span>
                        </label>
                    ))}
                </fieldset>

                <label className="bet-join-checkbox">
                    <input
                        type="checkbox"
                        checked={termsAcknowledged}
                        onChange={(event) => setTermsAcknowledged(event.target.checked)}
                    />
                    <span>I understand and agree to the terms of this Bet.</span>
                </label>

                {joinError && (
                    <p role="alert" className="bet-join-error">
                        {joinError.message}{" "}
                        {joinError.showVerifyLink && <Link to="/verify-email">Verify Email</Link>}
                    </p>
                )}

                <button type="submit" className="bet-join-submit" disabled={!canSubmit}>
                    {submitting ? "Joining..." : "Join Bet"}
                </button>
            </form>
        </section>
    );
}

export default BetJoinSection;

