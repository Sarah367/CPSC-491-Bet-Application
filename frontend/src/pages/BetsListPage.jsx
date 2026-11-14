import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { fetchPublicBets } from "../services/betService";
import { formatDeadline } from "../utils/formatDeadline";
import "./BetsListPage.css";

// The creator's display name, or "Unknown" when they haven't set one (SCRUM-87).
// The raw uid is never shown, the same as on Bet Details.
function creatorName(bet) {
    if (bet.creatorDisplayName) {
        return bet.creatorDisplayName;
    }
    return "Unknown";
}

function BetsListPage() {
    const { loading: authLoading, isAuthenticated } = useAuth();
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        let cancelled = false;

        async function loadBets() {
            setLoading(true);
            setError("");
            try {
                const publicBets = await fetchPublicBets();
                if (!cancelled) {
                    setBets(publicBets);
                }
            } catch (err) {
                console.error("Failed to load public bets: ", err);
                if (!cancelled) {
                    setError("Unable to load bets. Please try again.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadBets();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    if (authLoading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="public-bets-page">
            <main className="public-bets-main">
                <p className="public-bets-back">
                    <Link to="/home">Back to Home</Link>
                </p>
                <h1 className="public-bets-heading">Public Bets</h1>
                <p className="public-bets-subtitle">Bets anyone can see. Open one to view its details or join.</p>
                {renderContent(loading, error, bets)}
            </main>
        </div>
    );
}

// Only one state shows at a time (SCRUM-85): loading, then an error, an empty
// message, or the list.
function renderContent(loading, error, bets) {
    if (loading) {
        return <p className="public-bets-message">Loading bets...</p>;
    }

    if (error) {
        return (
            <p className="public-bets-message public-bets-error" role="alert">
                {error}
            </p>
        );
    }

    if (bets.length === 0) {
        return <p className="public-bets-message">No public bets yet.</p>;
    }

    const cards = [];
    for (const bet of bets) {
        cards.push(<BetCard key={bet.id} bet={bet} />);
    }

    return <ul className="public-bets-list">{cards}</ul>;
}

// One Bet. The title links to its details page, and the link covers the whole card.
// Every Bet on this page is public, so the card doesn't repeat a visibility badge.
function BetCard({ bet }) {
    return (
        <li className="public-bets-card">
            <h2 className="public-bets-card-title">
                <Link className="public-bets-card-link" to={`/bets/${bet.id}`}>
                    {bet.title}
                </Link>
            </h2>
            <div className="public-bets-badges">
                <span className="public-bets-badge public-bets-badge-status">{bet.status}</span>
            </div>
            <dl className="public-bets-details">
                <div className="public-bets-detail-row">
                    <dt>Deadline</dt>
                    <dd>{formatDeadline(bet.deadline)}</dd>
                </div>
                <div className="public-bets-detail-row">
                    <dt>Creator</dt>
                    <dd>{creatorName(bet)}</dd>
                </div>
            </dl>
        </li>
    );
}

export default BetsListPage;
