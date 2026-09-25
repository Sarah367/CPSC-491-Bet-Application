import {useState} from "react";
import {useNavigate, Link} from "react-router-dom";
import {registerUser} from "../services/authService";
import { getFriendlyErrorMessage } from "../utils/authErrorMessages";
import "./AuthPages.css";

function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function handleSubmit(event) {
        event.preventDefault();
        setError("");

        if (!email) {
            setError("Email is required.");
            return;
        }

        if (!password) {
            setError("Password is required.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Please enter a valid email address.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        try {
            // Firebase automatically signs in a newly registered user, so by the time this resolves,
            // the user is already authenticated and we can navigate to the home screen.
            await registerUser(email,password);
            navigate("/home");
        } catch (error) {
            // error.code is Firebase's machine-readable error identifier...
            setError(getFriendlyErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-brand">
                <span className="wordmark">Bet</span>
                <h1>Join friends in casual, low-stakes wagers.</h1>
                <p>Create an account to start creating and joining bets.</p>
            </div>
            <div className="auth-form-panel">
                <div className="auth-card">
                    <h2>Register</h2>
                    <form onSubmit={handleSubmit} noValidate>
                        {error && <p role="alert" className="auth-alert">{error}</p>}
                        <div className="auth-field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e)=>setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="password">Password</label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="auth-field">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? "Creating account..." : "Register"}
                        </button>
                    </form>
                    <p className="auth-footer">
                        Already have an account? <Link to="/login">Log in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}


export default RegisterPage;