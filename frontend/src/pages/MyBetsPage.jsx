import {useAuth} from "../context/useAuth";
import {Navigate, Link} from "react-router-dom";
import {useMyBets} from "../hooks/useMyBets";
import "./MyBetsPage.css";

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
        content = <p className="my-bets-message">Loading your bets...</p>;
    } else if (loadFailed) {
        content = <p className="my-bets-message my-bets-message-error" role="alert">{MY_BETS_ERROR}</p>;
    } else if (bets.length === 0) {
        content = <p className="my-bets-message">You haven't created or joined any bets yet.</p>;
    } else {
        // One card per Bet (SCRUM-108): the title links to Bet Details, then the
        // viewer's role, status and visibility badges, and deadline and stake rows.
        content = (
            <ul className="my-bets-list">
                {bets.map((bet) => (
                    <li key={bet.id} className="my-bets-card">
                        <h2 className="my-bets-card-title">
                            <Link to={`/bets/${bet.id}`}>{bet.title}</Link>
                        </h2>
                        {ROLE_LABELS[bet.viewerRole] && (
                            <p className="my-bets-role">{ROLE_LABELS[bet.viewerRole]}</p>
                        )}
                        <div className="my-bets-badges">
                            <span className="my-bets-badge my-bets-badge-status">{bet.status}</span>
                            <span className="my-bets-badge">{bet.visibility}</span>
                        </div>
                        <dl className="my-bets-details">
                            <div className="my-bets-detail-row">
                                <dt>Deadline</dt>
                                <dd>{formatDeadline(bet.deadline)}</dd>
                            </div>
                            <div className="my-bets-detail-row">
                                <dt>Stake</dt>
                                <dd>{formatStake(bet)}</dd>
                            </div>
                        </dl>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="my-bets-page">
            <main className="my-bets-main">
                <h1 className="my-bets-heading">My Bets</h1>
                {content}
                <p className="my-bets-back"><Link to="/home">Back to Home</Link></p>
            </main>
        </div>
    );
}

export default MyBetsPage;
