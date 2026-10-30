import {useEffect, useState} from "react";
import {Link, Navigate, useNavigate, useParams} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiGet, ApiError, NotAuthenticatedError} from "../services/apiClient";
import {updateBet} from "../services/betService";
import {RadioGroup, TextField} from "../components/BetFormFields";
import {canEditBet} from "../utils/betEditEligibility";
import {
    FIXED_CURRENCY,
    betToFormData,
    buildEditBetPayload,
    sideLabel,
    validateEditBetForm,
} from "../utils/createBetForm";
import "./CreateBetPage.css";

function getSubmitErrorMessage(error) {
    if (error instanceof NotAuthenticatedError || (error instanceof ApiError && error.status === 401)) {
        return "Your session has expired. Please log in again.";
    }
    if (error instanceof ApiError && error.status === 403) {
        return "Please verify your email before editing a bet.";
    }
    if (error instanceof ApiError && error.status === 404) {
        return "This bet doesn't exist.";
    }
    if (error instanceof ApiError && error.status === 409) {
        return "This bet can no longer be edited. Someone may have joined it, or its deadline may have passed.";
    }
    if (error instanceof ApiError && error.status === 400 && error.body?.message) {
        return `Couldn't save changes: ${error.body.message}`;
    }
    return "Unable to save changes. Please try again.";
}

// Edit Bet (SCRUM-36). The creator can change a Bet's terms while it's still a Draft that nobody
// else has joined, before its deadline. It reuses the Create Bet form's fields, styles, and rules,
// without the terms checkbox. After saving, it goes back to Bet Details, which loads the updated Bet.
function EditBetPage() {
    const {betId} = useParams();
    const navigate = useNavigate();
    const {loading: authLoading, isAuthenticated, uid, emailVerified} = useAuth();

    const [bet, setBet] = useState(null);
    const [loadState, setLoadState] = useState("loading"); // "loading" | "ready" | "notFound" | "error"
    const [formData, setFormData] = useState(null);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

        useEffect(() => {
        if (authLoading || !isAuthenticated) {
            return undefined;
        }

        let cancelled = false;
        async function loadBet() {
            try {
                const data = await apiGet(`/bets/${encodeURIComponent(betId)}`);
                if (cancelled) return;
                setBet(data.bet);
                setFormData(betToFormData(data.bet));
                setLoadState("ready");
            } catch (error) {
                if (cancelled) return;
                if (error instanceof ApiError && error.status === 404) {
                    setLoadState("notFound");
                } else {
                    console.error("Failed to load bet for editing: ", error);
                    setLoadState("error");
                }
            }
        }
        loadBet();

        return () => {
            cancelled = true;
        };
    }, [authLoading, isAuthenticated, betId]);

    if (authLoading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    function renderMessage(title, text) {
        return (
            <div className="create-bet-page">
                <main className="create-bet-main">
                    <section className="create-bet-success">
                        <h1>{title}</h1>
                        <p>{text}</p>
                        <div className="create-bet-success-actions">
                            <Link to={`/bets/${betId}`} className="create-bet-secondary">Back to Bet</Link>
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    if (emailVerified === false) {
        return renderMessage("Verify your email first", "You need to verify your email before you can edit a bet.");
    }

    if (loadState === "loading") {
        return <p>Loading bet...</p>;
    }

    if (loadState === "notFound") {
        return renderMessage("Bet not found", "This bet doesn't exist.");
    }

    if (loadState === "error") {
        return renderMessage("Something went wrong", "Unable to load this bet. Please try again.");
    }

    if (!canEditBet({bet, uid})) {
        return renderMessage(
            "This bet can't be edited",
            "Only the creator can edit a bet, and only while it's a draft that nobody else has joined, before its deadline."
        );
    }

    function handleChange(event) {
        const {name, value} = event.target;

        setFormData((prev) => {
            const next = {...prev, [name]: value};
            if (name === "stakeType") {
                if (value === "monetary") next.stakeDescription = "";
                if (value === "nonMonetary") next.stakeAmount = "";
            }
            return next;
        });

        // Like Create Bet: cross-field errors live on the dependent field, so editing either
        // side of the comparison clears them.
        const clearedFields = [name];
        if (name === "outcomeA") clearedFields.push("outcomeB");
        if (name === "deadline") clearedFields.push("outcomeDeadline");

        setErrors((prev) => {
            if (!clearedFields.some((field) => prev[field])) return prev;
            const next = {...prev};
            clearedFields.forEach((field) => delete next[field]);
            return next;
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (isSubmitting) return;

        setSubmitError("");
        const validationErrors = validateEditBetForm(formData);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            setSubmitError("Please fix the highlighted fields.");
            return;
        }

        setIsSubmitting(true);
        try {
            await updateBet(betId, buildEditBetPayload(formData));
            navigate(`/bets/${betId}`, {state: {notice: "Bet updated."}});
        } catch (error) {
            console.error("Edit bet failed: ", error);
            setSubmitError(getSubmitErrorMessage(error));
            setIsSubmitting(false);
        }
    }

    return (
        <div className="create-bet-page">
            <main className="create-bet-main">
                <h1>Edit Bet</h1>
                <p className="create-bet-subtitle">
                    You can change these terms until someone else joins your bet.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                    {submitError && <p role="alert" className="alert-banner create-bet-alert">{submitError}</p>}

                    <fieldset className="create-bet-section">
                        <legend>Bet Details</legend>
                        <TextField id="title" label="Title" type="text"
                            value={formData.title} onChange={handleChange} error={errors.title} />
                        <TextField id="description" label="Description" multiline
                            value={formData.description} onChange={handleChange} error={errors.description} />
                        <TextField id="outcomeA" label="Outcome A" type="text"
                            value={formData.outcomeA} onChange={handleChange} error={errors.outcomeA} />
                        <TextField id="outcomeB" label="Outcome B" type="text"
                            value={formData.outcomeB} onChange={handleChange} error={errors.outcomeB} />
                        <TextField id="deadline" label="Participation Deadline" type="datetime-local"
                            value={formData.deadline} onChange={handleChange} error={errors.deadline}
                            hint="After this, no one else can join." />
                        <TextField id="outcomeDeadline" label="Outcome Deadline" type="datetime-local"
                            value={formData.outcomeDeadline} onChange={handleChange} error={errors.outcomeDeadline}
                            hint="When the result should be known. Must be after the participation deadline." />
                    </fieldset>

                    <fieldset className="create-bet-section">
                        <legend>Bet Settings</legend>
                        <RadioGroup legend="Visibility" name="visibility"
                            value={formData.visibility} onChange={handleChange} error={errors.visibility}
                            options={[
                                {value: "public", label: "Public"},
                                {value: "private", label: "Private"},
                            ]} />
                        <RadioGroup legend="Resolution Method" name="resolutionMethod"
                            value={formData.resolutionMethod} onChange={handleChange} error={errors.resolutionMethod}
                            options={[
                                {value: "external", label: "External verification"},
                                {value: "personal", label: "Personal confirmation"},
                            ]} />
                    </fieldset>

                    <fieldset className="create-bet-section">
                        <legend>Stake</legend>
                        <RadioGroup legend="Stake Type" name="stakeType"
                            value={formData.stakeType} onChange={handleChange} error={errors.stakeType}
                            options={[
                                {value: "monetary", label: "Monetary"},
                                {value: "nonMonetary", label: "Non-monetary"},
                            ]} />

                        {formData.stakeType === "monetary" && (
                            <>
                                <TextField id="stakeAmount" label="Stake Amount ($)" type="text" inputMode="decimal"
                                    value={formData.stakeAmount} onChange={handleChange} error={errors.stakeAmount} />
                                <p className="create-bet-currency">
                                    Currency: <strong>{FIXED_CURRENCY}</strong>
                                </p>
                            </>
                        )}

                        {formData.stakeType === "nonMonetary" && (
                            <TextField id="stakeDescription" label="What's being wagered?" type="text"
                                value={formData.stakeDescription} onChange={handleChange}
                                error={errors.stakeDescription} />
                        )}
                    </fieldset>

                    <fieldset className="create-bet-section">
                        <legend>Your Side</legend>
                        <RadioGroup legend="Which side are you taking?" name="creatorSide"
                            value={formData.creatorSide} onChange={handleChange} error={errors.creatorSide}
                            options={[
                                {value: "A", label: sideLabel(formData.outcomeA, "Side A")},
                                {value: "B", label: sideLabel(formData.outcomeB, "Side B")},
                            ]} />
                    </fieldset>

                    <div className="create-bet-success-actions">
                        <Link to={`/bets/${betId}`} className="create-bet-secondary">Cancel</Link>
                        <button type="submit" className="create-bet-submit" disabled={isSubmitting}>
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </main>
        </div>
    );
}

export default EditBetPage;
