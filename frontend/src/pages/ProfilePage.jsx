import {useState} from "react";
import {useAuth} from "../context/useAuth";
import {Link, Navigate} from "react-router-dom";
import {updateDisplayName} from "../services/authService";
import "./ProfilePage.css";

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
        <div className="profile-page">
            <main className="profile-main">
                <h1>Profile</h1>

                <section className="profile-card">
                    <dl className="profile-details">
                        <div className="profile-row">
                            <dt>Display Name</dt>
                            <dd className="profile-name-value">
                                <span>{displayName || "Not set"}</span>
                                {!isEditing && (
                                    <button
                                        type="button"
                                        className="profile-button profile-button-secondary"
                                        onClick={() => {
                                            setDraftName(displayName);
                                            setError("");
                                            setIsEditing(true);
                                        }}
                                    >
                                        Edit
                                    </button>
                                )}
                            </dd>
                        </div>

                        {isEditing && (
                            <form className="profile-edit-form" onSubmit={handleSave}>
                                <label htmlFor="display-name">Display name</label>
                                <input
                                    id="display-name"
                                    value={draftName}
                                    onChange={(event) => setDraftName(event.target.value)}
                                    disabled={isSaving}
                                />
                                <div className="profile-edit-actions">
                                    <button type="submit" className="profile-button" disabled={isSaving}>
                                        {isSaving ? "Saving..." : "Save"}
                                    </button>
                                    <button
                                        type="button"
                                        className="profile-button profile-button-secondary"
                                        onClick={handleCancel}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        )}

                        {error && <p role="alert" className="alert-banner profile-alert">{error}</p>}

                        <div className="profile-row">
                            <dt>Email</dt>
                            <dd>{currentUser.email ?? "Not available"}</dd>
                        </div>
                        <div className="profile-row">
                            <dt>Email Verified</dt>
                            <dd className="profile-verified-value">
                                <span>{emailVerified ? "Yes" : "No"}</span>
                                {!emailVerified && (
                                    <Link to="/verify-email" className="profile-button profile-button-secondary">
                                        Verify Email
                                    </Link>
                                )}
                            </dd>
                        </div>
                        <div className="profile-row">
                            <dt>Account Created</dt>
                            <dd>{formatDate(currentUser.metadata?.creationTime)}</dd>
                        </div>
                        <div className="profile-row">
                            <dt>Last Sign-In</dt>
                            <dd>{formatDate(currentUser.metadata?.lastSignInTime)}</dd>
                        </div>
                    </dl>
                </section>
            </main>
        </div>
    );

}

export default ProfilePage;