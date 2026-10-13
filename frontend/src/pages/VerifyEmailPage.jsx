import {useState} from "react";
import {Link, Navigate, useLocation} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {sendVerificationEmail} from "../services/authService";
import {getFriendlyErrorMessage} from "../utils/authErrorMessages";
import "./AuthPages.css";
import "./VerifyEmailPage.css";

function getResendErrorMessage(error) {
    if (error?.code === "auth/too-many-requests") {
        return "Too many verification emails were requested. Please wait a few minutes and try again.";
    }
    return getFriendlyErrorMessage(error?.code);
}

function VerifyEmailPage() {
    const {currentUser, loading, isAuthenticated, emailVerified, refreshUser} = useAuth();

    const location = useLocation();
    const initialSendFailed = location.state?.verificationEmailFailed === true;

    const [isResending, setIsResending] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [status, setStatus] = useState("");
    const [error, setError] = useState(
        initialSendFailed
            ? "Your account was created, but we couldn't send the verification email. Use the Resend button below."
            : ""
    );

    if (loading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace/>;
    }

    async function handleResend() {
        setStatus("");
        setError("");
        setIsResending(true);
        try {
            await sendVerificationEmail(currentUser);
            setStatus(`Verification email sent to ${currentUser.email}. Check your inbox and spam folder.`);
        } catch (err) {
            setError(getResendErrorMessage(err));
        } finally {
            setIsResending(false);
        }
    }

    async function handleCheck() {
        setStatus("");
        setError("");
        setIsChecking(true);
        try {
            const verified = await refreshUser();
            if (!verified) {
                setError("We haven't detected verification yet. Make sure you clicked the link in the email, then try again.");
            }
        } catch {
            setError("Couldn't check your verification status. Please try again.");
        } finally {
            setIsChecking(false);
        }
    }
    const isBusy = isResending || isChecking;
    return (
        <div className="auth-page">
            <div className="auth-brand">
                <span className="wordmark">Bet</span>
                <h1>One last step before you start betting.</h1>
                <p>Verifying your email keeps Bet limited to real people, so every wager is between real friends.</p>
            </div>
            <div className="auth-form-panel">
                <div className="auth-card">
                    {emailVerified ? (
                        <>
                            <h2>Email verified</h2>
                            <p className="verify-text" role="status">
                                <strong>{currentUser.email}</strong> is verified. You can now create and join bets.
                            </p>
                            <div className="verify-actions">
                                <Link to="/bets/create" className="auth-submit verify-link-button">
                                    Create a Bet
                                </Link>
                                <Link to="/home" className="verify-secondary">
                                    Continue to Home
                                </Link>
                            </div>
                        </>
                    ) : (
                        <>
                            <h2>Verify your email</h2>
                            <p className="verify-text">
                                We sent a verification link to <strong>{currentUser.email}</strong>.
                                Click the link in that email, then come back here.
                            </p>

                            {error && <p role="alert" className="alert-banner auth-alert">{error}</p>}
                            {status && <p role="status" className="verify-status">{status}</p>}

                            <div className="verify-actions">
                                <button
                                    type="button"
                                    className="auth-submit"
                                    onClick={handleCheck}
                                    disabled={isBusy}
                                >
                                    {isChecking ? "Checking..." : "I've verified my email"}
                                </button>
                                <button
                                    type="button"
                                    className="verify-secondary"
                                    onClick={handleResend}
                                    disabled={isBusy}
                                >
                                    {isResending ? "Sending..." : "Resend verification email"}
                                </button>
                            </div>

                            <p className="auth-footer">
                                You can still browse while unverified. <Link to="/home">Go to Home</Link>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default VerifyEmailPage;