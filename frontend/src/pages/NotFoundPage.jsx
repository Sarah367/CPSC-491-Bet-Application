import { Link } from "react-router-dom";
import "./NotFoundPage.css";

// Shown for any address that doesn't match a page, like a mistyped link
// (SCRUM-110). Before this, unknown addresses showed a blank page.
// It doesn't need a login: Home sends signed-out users to Login anyway.
function NotFoundPage() {
    return (
        <div className="not-found-page">
            <main className="not-found-main">
                <section className="not-found-card">
                    <h1 className="not-found-title">Page not found</h1>
                    <p className="not-found-text">
                        This page doesn&apos;t exist. The link may be mistyped or out of date.
                    </p>
                    <p className="not-found-link">
                        <Link to="/home">Go to Home</Link>
                    </p>
                </section>
            </main>
        </div>
    );
}

export default NotFoundPage;
