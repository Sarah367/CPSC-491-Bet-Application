import {useState} from "react";
import {useAuth} from "../context/useAuth";
import {Navigate} from "react-router-dom";
import {updateDisplayName} from "../services/authService";

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
    const [savedDisplayName, setSavedDisplayName] = useState(null);
    const [draftName, setDraftName] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState("");

    const displayName = savedDisplayName ?? currentUser?.displayName ?? "";

    async function handleSave(event) {
        event.preventDefault();
        const trimmedName = draftName.trim();

        if (!trimmedName) {
            setError("Display name cannot be empty.");
            return;
        }

        setError("");
        setIsSaving(true);
        try {
            await updateDisplayName(trimmedName);
            setSavedDisplayName(trimmedName);
            setIsEditing(false);
        } catch {
            setError("Unable to update display name. Please try again.");
        } finally {
            setIsSaving(false);
        }
    }

    function handleCancel() {
        setDraftName(displayName);
        setError("");
        setIsEditing(false);
    }

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
                {displayName || "Not set"}
            </p>
            {isEditing ? (
                <form onSubmit={handleSave}>
                    <label htmlFor="display-name">Display name</label>
                    <input
                        id="display-name"
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        disabled={isSaving}
                    />
                    <button type="submit" disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                    <button type="button" onClick={handleCancel} disabled={isSaving}>
                        Cancel
                    </button>
                </form>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setDraftName(displayName);
                        setError("");
                        setIsEditing(true);
                    }}
                >
                    Edit
                </button>
            )}
            {error && <p role="alert">{error}</p>}
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