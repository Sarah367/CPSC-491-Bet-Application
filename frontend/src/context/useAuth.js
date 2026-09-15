import { useContext } from "react";
import { AuthContext } from "./authContext";

// shortcut so the components don't have to call useContext(AuthContext)
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
