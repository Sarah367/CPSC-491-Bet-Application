import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { fetchPublicBets } from "../services/betService";

function formatDeadline(deadline) {
    const date = new Date(deadline);
    return Number.isNaN(date.getTime()) ? deadline : date.toLocaleString();
}

function BetsListPage() {
    const { loading: authLoading, isAuthenticated } = useAuth();
    const [bets, setBets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!isAuthenticated) {
            return;
        }

        let cancelled = false;

        async function loadBets() {
            setLoading(true);
            setError("");
            try {
                const publicBets = await fetchPublicBets();
                if (!cancelled) {
                    setBets(publicBets);
                }
            } catch (err) {
                console.error("Failed to load public bets: ", err);
                if (!cancelled) {
                    setError("Unable to load bets. Please try again.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadBets();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    if (authLoading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div>
            <h1>Public Bets</h1>
            {error && <p role="alert">{error}</p>}
            {loading ? (
                <p>Loading bets...</p>
            ) : bets.length === 0 ? (
                <p>No public bets yet.</p>
            ) : (
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Deadline</th>
                            <th>Visibility</th>
                            <th>Status</th>
                            <th>Creator</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bets.map((bet) => (
                            <tr key={bet.id}>
                                <td>{bet.title}</td>
                                <td>{formatDeadline(bet.deadline)}</td>
                                <td>{bet.visibility}</td>
                                <td>{bet.status}</td>
                                <td>{bet.creatorUid}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default BetsListPage;
