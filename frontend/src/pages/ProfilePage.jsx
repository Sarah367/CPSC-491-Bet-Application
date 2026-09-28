import {useAuth} from "../context/useAuth";
import {Navigate} from "react-router-dom";

function formatDate(dateString) {
    if (!dateString) {
        return "Not available";
    }

    return new Date(dateString).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
}

function ProfilePage() {
    const {currentUser, loading, isAuthenticated, emailVerified} = useAuth();

    if (loading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    return (
        <div>
            <h1>Profile</h1>
            <p>
                <strong>Display Name:</strong>{" "}
                {currentUser.displayName ?? "Not set"}
            </p>
            <p>
                <strong>Email:</strong> {currentUser.email ?? "Not available"}
            </p>
            <p>
                <strong>Email Verified:</strong>{" "}
                {emailVerified ? "Yes" : "No"}
            </p>
            <p>
                <strong>Account Created:</strong>{" "}
                {formatDate(currentUser.metadata?.creationTime)}
            </p>
            <p>
                <strong>Last Sign-In:</strong>{" "}
                {formatDate(currentUser.metadata?.lastSignInTime)}
            </p>
        </div>
    );

}

export default ProfilePage;