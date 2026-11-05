import {useEffect, useState} from "react";
import {Navigate, useParams, Link} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiGet, ApiError} from "../services/apiClient";
import BetJoinSection from "../components/BetJoinSection";
import {outcomeForSide} from "../utils/betJoinEligibility";
import "./BetDetailsPage.css";

const RESOLUTION_METHOD_LABELS = {
    external: "External data",
    personal: "Personal confirmation",
};

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

function formatResolutionMethod(resolutionMethod) {
    return RESOLUTION_METHOD_LABELS[resolutionMethod] ?? resolutionMethod ?? "Unknown";
}

function BetDetailsPage() {
    const {loading: authLoading, isAuthenticated, uid, emailVerified} = useAuth();
    const {betId} = useParams();
    const [bet, setBet] = useState(null);
    const [viewerParticipation, setViewerParticipation] = useState(null);
    const [fetching, setFetching] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        // Ignore the response if the page unmounts before it arrives.
        let cancelled = false;

        async function loadBet() {
            setFetching(true);
            setNotFound(false);
            setError("");
            try {
                const data = await apiGet(`/bets/${betId}`);
                if (!cancelled) {
                    setBet(data?.bet ?? null);
                    setViewerParticipation(data?.viewerParticipation ?? null);
                }
            } catch (err) {
                if (cancelled) {
                    return;
                }
                if (err instanceof ApiError && err.status === 404) {
                    setNotFound(true);
                } else {
                    console.error("Failed to load bet: ", err);
                    setError("Unable to load this bet. Please try again later.");
                }
            } finally {
                if (!cancelled) {
                    setFetching(false);
                }
            }
        }

        loadBet();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, betId]);

    function handleJoined(data) {
        if (data?.bet) {
            setBet(data.bet);
        }
        setViewerParticipation(data?.viewerParticipation ?? null);
    }
    if (authLoading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    let content;
    if (fetching) {
        content = <p>Loading bet...</p>;
    } else if (notFound) {
        content = <p>This bet doesn&apos;t exist.</p>;
    } else if (error) {
        content = <p role="alert">{error}</p>;
    } else if (bet) {
        content = (
            <section className="bet-details-card">
                <h1 className="bet-details-title">{bet.title}</h1>
                <dl className="bet-details-list">
                    <div className="bet-details-row">
                        <dt>Description</dt>
                        <dd>{bet.description || "No description"}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Outcome A</dt>
                        <dd>{outcomeForSide(bet, "A")}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Outcome B</dt>
                        <dd>{outcomeForSide(bet, "B")}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Creator</dt>
                        <dd>{bet.creatorDisplayName ?? "Unknown"}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Deadline</dt>
                        <dd>{formatDeadline(bet.deadline)}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Visibility</dt>
                        <dd>{bet.visibility}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Resolution Method</dt>
                        <dd>{formatResolutionMethod(bet.resolutionMethod)}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Status</dt>
                        <dd>{bet.status}</dd>
                    </div>
                    <div className="bet-details-row">
                        <dt>Participants</dt>
                        <dd>{bet.participantCount ?? 0}</dd>
                    </div>
                </dl>
            </section>
        );
    }

    return (
        <div className="bet-details-page">
            <main className="bet-details-main">
                {content}
                {bet && !fetching && !notFound && !error && (
                    <BetJoinSection
                        bet={bet}
                        viewerParticipation={viewerParticipation}
                        uid={uid}
                        emailVerified={emailVerified}
                        onJoined={handleJoined}
                    />
                )}
                <p className="bet-details-back"><Link to="/home">Back to Home</Link></p>
            </main>
        </div>
    );
}

export default BetDetailsPage;
