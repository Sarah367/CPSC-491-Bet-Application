import {describe, it, expect} from "vitest";
import {getFriendlyErrorMessage} from "./authErrorMessages";

describe("getFriendlyErrorMessage", () => {
    it.each([
        ["auth/email-already-in-use", "An account with this email already exists."],
        ["auth/invalid-email", "Please enter a valid email address."],
        ["auth/weak-password", "Password should be at least 6 characters."],
        ["auth/too-many-requests", "Too many failed attempts. Please try again later."],
    ])("maps %s to a friendly message", (code, expected) => {
        expect(getFriendlyErrorMessage(code)).toBe(expected);
    });

    // These three must share one message so the login form never reveals
    // whether an email address has an account.
    it.each([
        "auth/invalid-credential",
        "auth/wrong-password",
        "auth/user-not-found",
    ])("maps %s to the same generic credentials message", (code) => {
        expect(getFriendlyErrorMessage(code)).toBe("Invalid email or password.");
    });

    it.each([
        ["an unknown code", "auth/network-request-failed"],
        ["undefined", undefined],
        ["an empty string", ""],
    ])("falls back to the default message for %s", (_label, code) => {
        expect(getFriendlyErrorMessage(code)).toBe("Something went wrong. Please try again.");
    });
});
