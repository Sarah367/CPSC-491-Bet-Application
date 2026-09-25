import {useState} from "react";
import {useNavigate, Link} from "react-router-dom";
import {loginUser} from "../services/authService";
import { getFriendlyErrorMessage } from "../utils/authErrorMessages";
import "./AuthPages.css";

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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

        setLoading(true);
        try {
            await loginUser(email, password);
            navigate("/home");
        } catch (error) {
            setError(getFriendlyErrorMessage(error.code));
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            <div className="auth-brand">
                <span className="wordmark">Bet</span>
                <h1>Casual wagers with people you trust.</h1>
                <p>Log in to create, join, and track bets with friends.</p>
            </div>
            <div className="auth-form-panel">
                <div className="auth-card">
                    <h2>Login</h2>
                    <form onSubmit={handleSubmit} noValidate>
                        {error && <p role="alert" className="auth-alert">{error}</p>}
                        <div className="auth-field">
                            <label htmlFor="email">Email</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
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
                        <button type="submit" className="auth-submit" disabled={loading}>
                            {loading ? "Logging in..." : "Log In"}
                        </button>
                    </form>
                    <p className="auth-footer">
                        Don't have an account? <Link to="/register">Register</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}



export default LoginPage;