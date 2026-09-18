export function getFriendlyErrorMessage(code) {
    switch (code) {
        case "auth/email-already-in-use":
            return "An account with this email already exists.";
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
            return "Invalid email or password.";
        case "auth/invalid-email":
            return "Please enter a valid email address.";
        case "auth/weak-password":
            return "Password should be at least 6 characters.";
        case "auth/too-many-requests":
            return "Too many failed attempts. Please try again later.";
        default:
            return "Something went wrong. Please try again.";
    }
}

