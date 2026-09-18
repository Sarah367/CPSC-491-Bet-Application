import {useAuth} from "../context/useAuth";
import {useNavigate, Navigate} from "react-router-dom";
import {logoutUser} from "../services/authService";
import {useState} from "react";

function HomePage() {
    const {currentUser, loading, isAuthenticated} = useAuth();
    const [error,setError] = useState("");
    const navigate = useNavigate();

    async function handleLogout() {
        setError("");
        try {
            await logoutUser();
            navigate("/login");
        } catch(error) {
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
        <div>
            <h1>Bet Home</h1>
            <p>Logged in as {currentUser.email}</p>
            {error && <p role="alert">{error}</p>}
            <button onClick={handleLogout}>Log Out</button>
        </div>
    );
}

export default HomePage;