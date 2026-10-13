import { useCallback, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import {auth} from "../services/firebase";
import { AuthContext } from "./authContextObject";

export function AuthProvider({children}) {
    const [currentUser, setCurrentUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [emailVerified, setEmailVerified] = useState(null);
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
            setEmailVerified(user?.emailVerified ?? null);
            setLoading(false);  
        });

        return unsubscribe;
    }, []);

    const refreshUser = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) return false;
        await user.reload();
        await user.getIdToken(true);
        const verified = user.emailVerified === true;
        setEmailVerified(verified);
        return verified;
    }, []); 

    const value = {
        currentUser,
        loading,
        isAuthenticated: !!currentUser,
        uid: currentUser?.uid ?? null,
        emailVerified,
        refreshUser,
    };
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}