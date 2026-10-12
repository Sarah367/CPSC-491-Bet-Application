import {useEffect, useState} from "react";
import {useAuth} from "../context/useAuth";
import {Navigate, Link} from "react-router-dom";
import {apiGet} from "../services/apiClient";

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

function MyBetsPage() {
    const {loading, isAuthenticated} = useAuth();
    const [bets, setBets] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        // Ignore the response if the page unmounts before it arrives.
        let cancelled = false;

        async function loadBets() {
            try {
                // The backend identifies the user from the ID token - no uid is sent.
                const data = await apiGet("/bets/mine");
                if (!cancelled) {
                    setBets(data?.bets ?? []);
                }
            } catch (err) {
                console.error("Failed to load bets: ", err);
                if (!cancelled) {
                    setError("Unable to load your bets. Please try again later.");
                }
            } finally {
                if (!cancelled) {
                    setFetching(false);
                }
            }
        }

        loadBets();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    if (loading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    let content;
    if (fetching) {
        content = <p>Loading your bets...</p>;
    } else if (error) {
        content = <p role="alert">{error}</p>;
    } else if (bets.length === 0) {
        content = <p>You haven't created any bets yet.</p>;
    } else {
        content = (
            <ul>
                {bets.map((bet) => (
                    <li key={bet.id}>
                        <h2><Link to={`/bets/${bet.id}`}>{bet.title}</Link></h2>
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
