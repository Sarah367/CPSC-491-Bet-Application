import {useState} from "react";
import {Link,Navigate} from "react-router-dom";
import {useAuth} from "../context/useAuth";
import {apiPost, ApiError, NotAuthenticatedError} from "../services/apiClient";
import "./CreateBetPage.css";
import {
    FIXED_CURRENCY,
    INITIAL_FORM_DATA,
    buildCreateBetPayload,
    validateCreateBetForm,
} from "../utils/createBetForm";

function RadioGroup({legend, name, options, value, onChange,error}) {
    const errorId = `${name}-error`;
    return (
        <fieldset
            className="create-bet-radio-group"
            aria-describedby={error ? errorId : undefined}
        >
            <legend>{legend}</legend>
            {options.map((option) => (
                <label key={option.value} className="create-bet-radio">
                    <input
                        type="radio"
                        name={name}
                        value={option.value}
                        checked={value === option.value}
                        onChange={onChange}
                    />
                    <span>{option.label}</span>
                </label>
            ))}
            {error && <p id={errorId} className="create-bet-field-error">{error}</p>}
        </fieldset>
    );
}

function TextField({id, label,error,multiline=false, ...inputProps}) {
    const errorId = `${id}-error`;
    const sharedProps = {
        id,
        name: id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": error ? errorId : undefined,
        ...inputProps,
    };
    return (
        <div className="create-bet-field">
            <label htmlFor={id}>{label}</label>
            {multiline ? <textarea rows={3} {...sharedProps} /> : <input {...sharedProps} />}
            {error && <p id={errorId} className="create-bet-field-error">{error}</p>}
        </div>
    )
}

function getSubmitErrorMessage(error) {
    if (error instanceof NotAuthenticatedError || (error instanceof ApiError && error.status === 401)) {
        return "Your session has expired. Please log in again.";
    }
    if (error instanceof ApiError && error.status === 403 && error.body?.error === "email_not_verified") {
        return "Please verify your email before creating a bet.";
    }
    if (error instanceof ApiError && error.status === 400 && error.body?.message) {
        return `Couldn't create bet: ${error.body.message}`;
    }
    return "Unable to create bet. Please try again.";
}

function CreateBetPage() {
    const { loading, isAuthenticated, emailVerified } = useAuth();
    const [formData, setFormData] = useState(INITIAL_FORM_DATA);
    const [errors, setErrors] = useState({});
    const [submitError, setSubmitError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [createdBet, setCreatedBet] = useState(null);

    if (loading) {
        return <p>Loading...</p>;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (emailVerified === false) {
        return (
            <div className="create-bet-page">
                <main className="create-bet-main">
                    <section className="create-bet-success">
                        <h1>Verify your email first</h1>
                        <p>You need to verify your email before you can create a bet.</p>
                        <div className="create-bet-success-actions">
                            <Link to="/verify-email" className="create-bet-submit create-bet-link-button">
                                Verify Email
                            </Link>
                            <Link to="/home" className="create-bet-secondary">Back to Home</Link>
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    function handleChange(event) {
        const { name, value } = event.target;

        setFormData((prev) => {
            const next = { ...prev, [name]: value };
            if (name === "stakeType") {
                if (value === "monetary") next.stakeDescription = "";
                if (value === "nonMonetary") next.stakeAmount = "";
            }
            return next;
        });

        setErrors((prev) => {
            if (!prev[name]) return prev;
            const next = { ...prev };
            delete next[name];
            return next;
        });
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (isSubmitting) return;

        setSubmitError("");
        const validationErrors = validateCreateBetForm(formData);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            setSubmitError("Please fix the highlighted fields.");
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await apiPost("/bets", buildCreateBetPayload(formData));
            setCreatedBet(response.bet);
        } catch (error) {
            console.error("Create bet failed: ", error);
            setSubmitError(getSubmitErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleCreateAnother() {
        setFormData(INITIAL_FORM_DATA);
        setErrors({});
        setSubmitError("");
        setCreatedBet(null);
    }

    if (createdBet) {
        return (
            <div className="create-bet-page">
                <main className="create-bet-main">
                    <section className="create-bet-success" aria-live="polite">
                        <h1>Bet created!</h1>
                        <p>
                            <strong>{createdBet.title}</strong> was saved as a draft.
                        </p>
                        <div className="create-bet-success-actions">
                            <Link to="/home" className="create-bet-secondary">Back to Home</Link>
                            <button type="button" className="create-bet-submit" onClick={handleCreateAnother}>
                                Create another bet
                            </button>
                        </div>
                    </section>
                </main>
            </div>
        );
    }

    return (
        <div className="create-bet-page">
            <main className="create-bet-main">
                <h1>Create a Bet</h1>
                <p className="create-bet-subtitle">
                    Set the terms, choose who can join, and decide what's on the line.
                </p>

                <form onSubmit={handleSubmit} noValidate>
                    {submitError && <p role="alert" className="alert-banner create-bet-alert">{submitError}</p>}

                    <fieldset className="create-bet-section">
                        <legend>Bet Details</legend>
                        <TextField
                            id="title"
                            label="Title"
                            type="text"
                            value={formData.title}
                            onChange={handleChange}
                            error={errors.title}
                        />
                        <TextField
                            id="description"
                            label="Description"
                            multiline
                            value={formData.description}
                            onChange={handleChange}
                            error={errors.description}
                        />
                        <TextField
                            id="deadline"
                            label="Deadline"
                            type="datetime-local"
                            value={formData.deadline}
                            onChange={handleChange}
                            error={errors.deadline}
                        />
                    </fieldset>

                    <fieldset className="create-bet-section">
                        <legend>Bet Settings</legend>
                        <RadioGroup
                            legend="Visibility"
                            name="visibility"
                            value={formData.visibility}
                            onChange={handleChange}
                            error={errors.visibility}
                            options={[
                                { value: "public", label: "Public" },
                                { value: "private", label: "Private" },
                            ]}
                        />
                        <RadioGroup
                            legend="Resolution Method"
                            name="resolutionMethod"
                            value={formData.resolutionMethod}
                            onChange={handleChange}
                            error={errors.resolutionMethod}
                            options={[
                                { value: "external", label: "External verification" },
                                { value: "personal", label: "Personal confirmation" },
                            ]}
                        />
                    </fieldset>

                    <fieldset className="create-bet-section">
                        <legend>Stake</legend>
                        <RadioGroup
                            legend="Stake Type"
                            name="stakeType"
                            value={formData.stakeType}
                            onChange={handleChange}
                            error={errors.stakeType}
                            options={[
                                { value: "monetary", label: "Monetary" },
                                { value: "nonMonetary", label: "Non-monetary" },
                            ]}
                        />

                        {formData.stakeType === "monetary" && (
                            <>
                                <TextField
                                    id="stakeAmount"
                                    label="Stake Amount ($)"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="10.00"
                                    value={formData.stakeAmount}
                                    onChange={handleChange}
                                    error={errors.stakeAmount}
                                />
                                <p className="create-bet-currency">
                                    Currency: <strong>{FIXED_CURRENCY}</strong>
                                </p>
                            </>
                        )}

                        {formData.stakeType === "nonMonetary" && (
                            <TextField
                                id="stakeDescription"
                                label="What's being wagered?"
                                type="text"
                                placeholder="Loser buys dinner"
                                value={formData.stakeDescription}
                                onChange={handleChange}
                                error={errors.stakeDescription}
                            />
                        )}
                    </fieldset>

                    <button type="submit" className="create-bet-submit" disabled={isSubmitting}>
                        {isSubmitting ? "Creating..." : "Create Bet"}
                    </button>
                </form>
            </main>
        </div>
    );
}

export default CreateBetPage;

