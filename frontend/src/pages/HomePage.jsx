import {useAuth} from "../context/useAuth";
import {useNavigate, Navigate} from "react-router-dom";
import {logoutUser} from "../services/authService";
import {useState} from "react";
import "./HomePage.css";

function HomePage() {
    const {currentUser, loading, isAuthenticated} = useAuth();
    const [error,setError] = useState("");
    const navigate = useNavigate();

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

    return (
        <div className="home-page">
            <header className="home-header">
                <span className="wordmark">Bet</span>
                <div className="home-account">
                    <span className="home-email">Logged in as {currentUser.email}</span>
                    <button className="home-logout" onClick={handleLogout}>Log Out</button>
                </div>
            </header>
            {error && <p role="alert" className="home-alert">{error}</p>}
            <main className="home-main">
                <h1>Bet Home</h1>
                <p>Your bets will show up here soon.</p>
            </main>
        </div>
    );
}

export default HomePage;