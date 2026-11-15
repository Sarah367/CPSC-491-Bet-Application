import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";

// Visiting "/" sends signed-in users to Home and everyone else to Login.
// Before this, "/" had no route and showed a blank page (SCRUM-110).
function RootRedirect() {
    const { loading, isAuthenticated } = useAuth();

    // Wait until Firebase says whether the user is signed in, so a signed-in
    // user isn't sent to Login for a moment first.
    if (loading) {
        return <p>Loading...</p>;
    }

    if (isAuthenticated) {
        return <Navigate to="/home" replace />;
    }

    return <Navigate to="/login" replace />;
}

export default RootRedirect;
