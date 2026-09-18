import {auth} from "./firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";

console.log("Connected to Firebase Project ID: ", auth.app.options.projectId);

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
        console.log("User logged in successfully: ", user);
        return user;
    } catch (error) {
        console.error("Login failed: ", error.code, error.message);
        throw error;
    }
}

export async function logoutUser() {
    try {
        await signOut(auth);
        console.log("User signed out successfully.");
    } catch (error) {
        console.error("Error signing out: ", error);
        throw error;
    }
}