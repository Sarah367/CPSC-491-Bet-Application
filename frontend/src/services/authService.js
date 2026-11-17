import {auth} from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, sendEmailVerification } from "firebase/auth";
import {apiRequest} from "./apiClient";

export {auth}

// handles user registration
export async function registerUser(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        console.error("Registration failed: ", error.code, error.message);
        throw error; // re-throw the error so RegisterPage still receives it.
    }
    
}

export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        return user;
    } catch (error) {
        console.error("Login failed: ", error.code, error.message);
        throw error;
    }
}

export async function sendVerificationEmail(user) {
    if (!user) {
        throw new Error("A signed-in user is required to send a verification email.");
    }
    try {
        await sendEmailVerification(user, { url: `${window.location.origin}/verify-email` });
    } catch (error) {
        console.error("Sending verification email failed: ", error.code, error.message);
        throw error;
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Error signing out: ", error);
        throw error;
    }
}

// Saves the display name through our backend (SCRUM-87), which updates Firebase Auth
// and the user's Firestore profile together, so other users see the new name on the
// user's Bets. Returns the saved profile, for example { displayName: "Jordan Rivera" }.
export async function updateDisplayName(displayName) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("A signed-in user is required to update the display name.");
    }

    const data = await apiRequest("/users/me", {method: "PUT", body: {displayName}});

    // The backend changed the name in Firebase Auth, but this browser still has the old
    // name cached. Reloading the user picks up the new one, so it stays after a refresh.
    await user.reload();

    return data.profile;
}