// Firebase is mocked so these tests never send a real email.
vi.mock("./firebase", () => ({
    auth: {currentUser: null},
}));

vi.mock("firebase/auth", () => ({
    createUserWithEmailAndPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    signInWithEmailAndPassword: vi.fn(),
    signOut: vi.fn(),
    updateProfile: vi.fn(),
}));

import {vi, describe, it, expect, beforeEach} from "vitest";
import {sendEmailVerification} from "firebase/auth";
import {sendVerificationEmail} from "./authService";

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
