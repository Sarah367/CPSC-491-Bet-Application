import {useState} from "react";
import {useNavigate, Link} from "react-router-dom";
import {loginUser} from "../services/authService";
import { getFriendlyErrorMessage } from "../utils/authErrorMessages";

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
        <div>
            <h1>Login</h1>
            <form onSubmit={handleSubmit} noValidate> 
                <div>
                    <label htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                {error && <p role="alert">{error}</p>}
                <button type="submit" disabled={loading}>
                    {loading ? "Logging in..." : "Log In"}
                </button>
            </form>
            <p>
                Don't have an account? <Link to="/register">Register</Link>
            </p>
        </div>
    );
}



export default LoginPage;