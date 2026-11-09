import {useAuth} from "../context/useAuth";
import {Navigate, Link} from "react-router-dom";
import {useMyBets} from "../hooks/useMyBets";

function formatDeadline(dateString) {
    if (!dateString) {
        return "No deadline";
    }

    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) {
        return "No deadline";
    }

    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatStake(bet) {
    if (bet.stakeType === "monetary") {
        const amount = (bet.stakeAmountCents ?? 0) / 100;
        try {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: bet.currency,
            }).format(amount);
        } catch {
            // Unknown or missing currency code - still show the amount.
            return `${amount.toFixed(2)} ${bet.currency ?? ""}`.trim();
        }
    }

    return bet.stakeDescription ?? "No stake";
}

// GET /api/bets/mine returns Bets the user created or joined, each with a
// viewerRole from the server (SCRUM-57). Unknown roles show no label.
const MY_BETS_ERROR = "Unable to load your bets. Please try again later.";

const ROLE_LABELS = {
    creator: "You created this Bet",
    participant: "You joined this Bet",
};

function MyBetsPage() {
    const {loading, isAuthenticated} = useAuth();
    // Loading the Bets lives in the shared useMyBets hook (SCRUM-105). My Bets asks
    // for every Bet, so it passes no limit. The backend identifies the user from the
    // ID token, so no uid is sent.
    const {
        bets,
        loading: fetching,
        error: loadFailed,
    } = useMyBets({enabled: isAuthenticated});

    if (loading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    let content;
    if (fetching) {
        content = <p>Loading your bets...</p>;
    } else if (loadFailed) {
        content = <p role="alert">{MY_BETS_ERROR}</p>;
    } else if (bets.length === 0) {
        content = <p>You haven't created or joined any bets yet.</p>;
    } else {
        content = (
            <ul>
                {bets.map((bet) => (
                    <li key={bet.id}>
                        <h2><Link to={`/bets/${bet.id}`}>{bet.title}</Link></h2>
                        {ROLE_LABELS[bet.viewerRole] && <p>{ROLE_LABELS[bet.viewerRole]}</p>}
                        <p><strong>Status:</strong> {bet.status}</p>
                        <p><strong>Visibility:</strong> {bet.visibility}</p>
                        <p><strong>Deadline:</strong> {formatDeadline(bet.deadline)}</p>
                        <p><strong>Stake:</strong> {formatStake(bet)}</p>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div>
            <h1>My Bets</h1>
            {content}
            <p><Link to="/home">Back to Home</Link></p>
        </div>
    );
}

export default MyBetsPage;
