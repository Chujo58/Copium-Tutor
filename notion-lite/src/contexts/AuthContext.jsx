import React, { createContext, useContext, useEffect } from "react";
// import dataService from "../services/dataService";
import { API_URL } from "../config";

const AuthContext = createContext();

export function AuthProvider({ children }) {
    // Fetch current user from backend
    const [user, setUser] = React.useState(null);

    const fetchUser = async () => {
        await fetch(`${API_URL}/me`, {
            credentials: "include",
        })
            .then((res) => {
                if (res.ok) return res.json();
                throw new Error("Not authenticated");
            })
            .then((data) => {
                if (data.success && data.user) {
                    // dataService.setCurrentUser(data.user);
                    setUser(data.user);
                }
            })
            .catch(() => setUser(null));
    };

    useEffect(() => {
        fetchUser();
    }, []);

    // login happens after successful login request in LoginPopup
    const login = () => {
        // Re-fetch user data
        fetchUser();
        return user;
    };

    const logout = async () => {
        await fetch(`${API_URL}/logout`, {
            method: "POST",
            credentials: "include",
        });
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

// Login bs:
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}
