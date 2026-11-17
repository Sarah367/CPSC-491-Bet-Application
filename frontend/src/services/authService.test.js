// Firebase is mocked so these tests never send a real email.
vi.mock("./firebase", () => ({
    auth: {currentUser: null},
}));

// SCRUM-87: display names are saved through the backend.
vi.mock("./apiClient", () => ({
    apiRequest: vi.fn(),
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
import {sendVerificationEmail, updateDisplayName} from "./authService";
import {auth} from "./firebase";
import {apiRequest} from "./apiClient";

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

// SCRUM-87
describe("updateDisplayName", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        auth.currentUser = null;
    });

    it("saves the name through the backend, then reloads the signed-in user", async () => {
        const reload = vi.fn().mockResolvedValue(undefined);
        auth.currentUser = {uid: "sarah123", reload};
        apiRequest.mockResolvedValue({profile: {displayName: "Sarah"}});

        const profile = await updateDisplayName("Sarah");

        expect(apiRequest).toHaveBeenCalledWith("/users/me", {method: "PUT", body: {displayName: "Sarah"}});
        expect(reload).toHaveBeenCalledTimes(1);
        expect(profile).toEqual({displayName: "Sarah"});
    });

    it("reloads the user only after the backend has saved the name", async () => {
        const order = [];
        auth.currentUser = {uid: "sarah123", reload: vi.fn(async () => { order.push("reload"); })};
        apiRequest.mockImplementation(async () => {
            order.push("save");
            return {profile: {displayName: "Sarah"}};
        });

        await updateDisplayName("Sarah");

        expect(order).toEqual(["save", "reload"]);
    });

    it("doesn't reload the user when saving fails", async () => {
        const reload = vi.fn();
        auth.currentUser = {uid: "sarah123", reload};
        apiRequest.mockRejectedValue(new Error("Request failed with status 500"));

        await expect(updateDisplayName("Sarah")).rejects.toThrow("Request failed with status 500");
        expect(reload).not.toHaveBeenCalled();
    });

    it("throws without calling the backend when nobody is signed in", async () => {
        await expect(updateDisplayName("Sarah")).rejects.toThrow("A signed-in user is required");
        expect(apiRequest).not.toHaveBeenCalled();
    });
});
