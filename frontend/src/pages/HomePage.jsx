import {useAuth} from "../context/useAuth";
import {useNavigate, Navigate, Link} from "react-router-dom";
import {logoutUser} from "../services/authService";
import {useEffect, useState} from "react";
import {fetchMyBets} from "../services/betService";
import "./HomePage.css";

const RECENT_BETS_LIMIT = 3;

function formatDeadline(dateString) {
    const date = new Date(dateString);
    if (!dateString || Number.isNaN(date.getTime())) {
        return "No deadline.";
    }

    return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function HomePage() {
    const {currentUser, loading, isAuthenticated} = useAuth();
    const [error,setError] = useState("");
    const navigate = useNavigate();
    const [recentBets, setRecentBets] = useState([]);
    const [betsLoading, setBetsLoading] = useState(true);
    const [betsError, setBetsError] = useState("");
 
    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }
 
        // Ignore the response if the page unmounts before it arrives.
        let cancelled = false;
 
        async function loadRecentBets() {
            try {
                const bets = await fetchMyBets();
                if (!cancelled) {
                    // The API already returns newest first, so the first few are the most recent.
                    setRecentBets(bets.slice(0, RECENT_BETS_LIMIT));
                }
            } catch (err) {
                console.error("Failed to load recent bets: ", err);
                if (!cancelled) {
                    setBetsError("Unable to load your recent bets right now. Please try again later.");
                }
            } finally {
                if (!cancelled) {
                    setBetsLoading(false);
                }
            }
        }
 
        loadRecentBets();
 
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    async function handleLogout() {
        setError("");
        try {
            await logoutUser();
            navigate("/login");
        } catch(err) {
            console.error("Logout failed: ", err);
            setError("Unable to log out. Please try again.");
        }
    }

    if (loading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    let recentBetsContent;
    if (betsLoading) {
        recentBetsContent = <p className="home-recent-message">Loading your recent bets...</p>;
    } else if (betsError) {
        recentBetsContent = <p className="home-recent-message home-recent-error">{betsError}</p>;
    } else if (recentBets.length === 0) {
        recentBetsContent = (
            <p className="home-recent-message">
                You haven't created any bets yet. Create a bet to get started!
            </p>
        );
    } else {
        recentBetsContent = (
            <ul className="home-recent-list">
                {recentBets.map((bet) => (
                    <li key={bet.id} className="home-recent-item">
                        <h3>{bet.title}</h3>
                        <p className="home-recent-meta">
                            <span className="home-recent-status">{bet.status}</span>
                            <span className="home-recent-visibility">{bet.visibility}</span>
                            <span>Deadline: {formatDeadline(bet.deadline)}</span>
                        </p>
                    </li>
                ))}
            </ul>
        );
    }
 
    return (
        <div className="home-page">
            <header className="home-header">
                <span className="wordmark">Bet</span>
                <div className="home-account">
                    <span className="home-email">Logged in as {currentUser.email}</span>
                    <Link to="/bets" className="home-profile-link">Browse Public Bets</Link>
                    <Link to="/my-bets" className="home-profile-link">My Bets</Link>
                    <Link to="/profile" className="home-profile-link">View Profile</Link>
                    
                    <button className="home-logout" onClick={handleLogout}>Log Out</button>
                </div>
            </header>
            {error && <p role="alert" className="alert-banner home-alert">{error}</p>}
            <main className="home-main">
                <h1>Bet Home</h1>
                <p>Start a new bet, or check on the bets you've made.</p>
                <Link to="/bets/create" className="home-create-bet">Create a Bet</Link>
                 
                <section className="home-recent" aria-labelledby="home-recent-heading">
                    <div className="home-recent-header">
                        <h2 id="home-recent-heading">Recent Bets</h2>
                        <Link to="/my-bets" className="home-view-all">View all</Link>
                    </div>
                    {recentBetsContent}
                </section>
            </main>
        </div>
    );
}

export default HomePage;