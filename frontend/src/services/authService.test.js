// Firebase is mocked so these tests never send a real email.
vi.mock("./firebase", () => ({
    auth: {currentUser: null},
}));
// The mocked auth object above, so tests can set auth.currentUser.
import {auth} from "./firebase";

vi.mock("firebase/auth", () => ({
    createUserWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
}));

import {vi, describe, it, expect, beforeEach} from "vitest";
import {
    createUserWithEmailAndPassword,
    sendEmailVerification,
    signInWithEmailAndPassword,
    signOut,
    updateProfile,
} from "firebase/auth";
import {
    sendVerificationEmail,
    registerUser,
    loginUser,
    logoutUser,
    updateDisplayName,
} from "./authService";

describe("registerUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates the account with Firebase and returns the new user", async () => {
        const newUser = {uid: "new123", email: "test@example.com"};
        createUserWithEmailAndPassword.mockResolvedValue({user: newUser});

        const result = await registerUser("test@example.com", "password123");

        expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
            auth,
            "test@example.com",
            "password123"
        );
        expect(result).toBe(newUser);
    });

    it("re-throws Firebase errors so RegisterPage can show a message", async () => {
        const error = {code: "auth/email-already-in-use", message: "in use"};
        createUserWithEmailAndPassword.mockRejectedValue(error);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(registerUser("test@example.com", "password123")).rejects.toBe(error);

        consoleSpy.mockRestore();
    });
});

describe("loginUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("signs in with Firebase and returns the user", async () => {
        const signedIn = {uid: "abc123", email: "test@example.com"};
        signInWithEmailAndPassword.mockResolvedValue({user: signedIn});

        const result = await loginUser("test@example.com", "password123");

        expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
            auth,
            "test@example.com",
            "password123"
        );
        expect(result).toBe(signedIn);
    });

    it("re-throws Firebase errors so LoginPage can show a message", async () => {
        const error = {code: "auth/invalid-credential", message: "bad"};
        signInWithEmailAndPassword.mockRejectedValue(error);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(loginUser("test@example.com", "wrong")).rejects.toBe(error);

        consoleSpy.mockRestore();
    });
});

describe("logoutUser", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("signs out of Firebase", async () => {
        signOut.mockResolvedValue(undefined);

        await logoutUser();

        expect(signOut).toHaveBeenCalledWith(auth);
    });

    it("re-throws sign-out errors so HomePage can show a message", async () => {
        const error = new Error("network down");
        signOut.mockRejectedValue(error);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(logoutUser()).rejects.toBe(error);

        consoleSpy.mockRestore();
    });
});

describe("updateDisplayName", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.currentUser = null;
    });

    it("updates the signed-in user's display name and returns the user", async () => {
        const current = {uid: "abc123"};
        auth.currentUser = current;
        updateProfile.mockResolvedValue(undefined);

        const result = await updateDisplayName("Henry");

        expect(updateProfile).toHaveBeenCalledWith(current, {displayName: "Henry"});
        expect(result).toBe(current);
    });

    it("throws without calling Firebase when no user is signed in", async () => {
        await expect(updateDisplayName("Henry")).rejects.toThrow(/signed-in user/);
        expect(updateProfile).not.toHaveBeenCalled();
    });

    it("re-throws Firebase errors", async () => {
        auth.currentUser = {uid: "abc123"};
        const error = {code: "auth/requires-recent-login"};
        updateProfile.mockRejectedValue(error);

        await expect(updateDisplayName("Henry")).rejects.toBe(error);
    });
});

describe("sendVerificationEmail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends the email with a continue URL back to /verify-email", async () => {
        const user = {uid: "sarah123"};
        sendEmailVerification.mockResolvedValue(undefined);

        await sendVerificationEmail(user);

        expect(sendEmailVerification).toHaveBeenCalledWith(user, {
            url: `${window.location.origin}/verify-email`,
        });
    });

    it("re-throws Firebase errors so the caller can show a message", async () => {
        const error = {code: "auth/too-many-requests", message: "Too many requests"};
        sendEmailVerification.mockRejectedValue(error);
        const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

        await expect(sendVerificationEmail({uid: "sarah123"})).rejects.toBe(error);

        consoleSpy.mockRestore();
    });

    it("throws without calling Firebase when there is no user", async () => {
        await expect(sendVerificationEmail(null)).rejects.toThrow(/signed-in user/);
        expect(sendEmailVerification).not.toHaveBeenCalled();
    });
});
