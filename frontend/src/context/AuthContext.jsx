import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {auth} from "../services/firebase";
import { AuthContext } from "./authContextObject";

export function AuthProvider({children}) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        loading,
        isAuthenticated: !!currentUser,
        uid: currentUser?.uid ?? null,
        emailVerified: currentUser?.emailVerified ?? null,
    };
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}