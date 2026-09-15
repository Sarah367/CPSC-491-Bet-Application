import {auth} from "./firebase";
import { createUserWithEmailAndPassword } from "firebase/auth";

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