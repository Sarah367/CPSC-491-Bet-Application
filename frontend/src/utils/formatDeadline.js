// Shared deadline formatting for every Bet page (SCRUM-103). Before this, My Bets,
// Bet Details, Home, and Public Bets each had their own copy, and they'd drifted
// apart: different month formats, and Public Bets showed a raw or blank value when a
// deadline was missing or invalid.

// For example: "November 3, 2026 at 4:09 PM" in US English. The exact wording follows
// the viewer's browser language and time zone.
export const DEADLINE_FORMAT = Object.freeze({
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
});

export const NO_DEADLINE = "No deadline";

// Accepts an ISO date string (what our API sends), a Date, or a timestamp. Anything
// missing or not a real date shows "No deadline".
export function formatDeadline(value) {
    if (value === null || value === undefined || value === "") {
        return NO_DEADLINE;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return NO_DEADLINE;
    }

    return date.toLocaleString(undefined, DEADLINE_FORMAT);
}
