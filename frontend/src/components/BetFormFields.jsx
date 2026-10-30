// Form field components shared by the Create Bet and Edit Bet pages (SCRUM-36).
// They were moved here unchanged from CreateBetPage.jsx, so both pages look and behave the same.
// They use the create-bet-* classes from CreateBetPage.css, which both pages import.

export function RadioGroup({legend, name, options, value, onChange,error}) {
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

export function TextField({id, label, error, hint, multiline=false, ...inputProps}) {
    const errorId = `${id}-error`;
    const hintId = `${id}-hint`;
    const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;
    const sharedProps = {
        id,
        name: id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        ...inputProps,
    };
    return (
        <div className="create-bet-field">
            <label htmlFor={id}>{label}</label>
            {hint && <p id={hintId} className="create-bet-hint">{hint}</p>}
            {multiline ? <textarea rows={3} {...sharedProps} /> : <input {...sharedProps} />}
            {error && <p id={errorId} className="create-bet-field-error">{error}</p>}
        </div>
    )
}

export function CheckboxField({ id, label, checked, onChange, error }) {
    const errorId = `${id}-error`;
    return (
        <div className="create-bet-field">
            <label className="create-bet-checkbox" htmlFor={id}>
                <input
                    id={id}
                    name={id}
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? errorId : undefined}
                />
                <span>{label}</span>
            </label>
            {error && <p id={errorId} className="create-bet-field-error">{error}</p>}
        </div>
    );
}
