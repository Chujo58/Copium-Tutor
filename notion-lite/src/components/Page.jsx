import GalleryView from "./GalleryView";
import DriveStyleUploader from "./DocumentUploader";
import { useState, useEffect } from "react";
import { LoginPopup, SignupPopup, CreateProjectPopup } from "./Popup";
import { useAuth } from "../contexts/AuthContext";
import { API_URL } from "../config";
import Sidebar from "./Sidebar";

// User dashboard page

export function UserDashboard() {
    // Query the projects from the backend (localhost:8000/projects) and display them in a gallery view
    const [projects, setProjects] = useState([]);
    const [showAddProject, setShowAddProject] = useState(false);

    const fetchProjects = async () => {
        await fetch(`${API_URL}/projects`, {
            credentials: "include",
            method: "GET",
        })
            .then((res) => {
                if (res.ok) return res.json();
                throw new Error("Failed to fetch projects");
            })
            .then((data) => {
                if (data.success && data.projects) {
                    setProjects(data.projects);
                }
            })
            .catch((err) => {
                console.error(err);
            });

        console.log("Fetched projects:", projects);
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <div className="flex">
            <Sidebar
                items={[
                    { name: "Dashboard", href: "/dashboard" },
                ]}
            />

            <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
                <div className="text-3xl main-header font-sans mb-2 text-dark">
                    Dashboard
                </div>
                <GalleryView
                    subjects={projects}
                    onAddSubject={() => setShowAddProject(true)}
                />
                {showAddProject && (
                    <CreateProjectPopup
                        onClose={() => {
                            setShowAddProject(false);
                            fetchProjects();
                        }}
                    />
                )}
                <DriveStyleUploader />
            </div>
        </div>
    );
}

// Landing page, should have some sort of login and signup buttons that will open the corresponding popups
export function LandingPage() {
    const [showLogin, setShowLogin] = useState(false);
    const [showSignup, setShowSignup] = useState(false);
    const { user, login, logout } = useAuth();
    const [loggedIn, setLoggedIn] = useState(false);

    // Verify if user is logged in before rendering
    useEffect(() => {
        setLoggedIn(!!user);
    }, [user]);

    return (
        <div className="flex h-screen">
            <div className="flex flex-col items-center justify-center w-screen bg-gradient-to-b from-rose-china to-rose-copper text-white">
                <h1 className="text-5xl font-bold mb-6">
                    Welcome to{" "}
                    <a className="font-card main-header text-dark">
                        Copium Tutor
                    </a>
                </h1>
                <p className="text-xl mb-8">
                    A backboard.io app for learning and coping.
                </p>
                {loggedIn ? (
                    <div className="space-x-4">
                        <button
                            className="bg-white text-dark px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
                            onClick={() =>
                                (window.location.href = "/dashboard")
                            }
                        >
                            Access Dashboard
                        </button>
                    </div>
                ) : (
                    <div className="space-x-4">
                        <button
                            className="bg-white text-dark px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
                            onClick={() => setShowLogin(true)}
                        >
                            Login
                        </button>
                        <button
                            className="bg-white text-dark px-6 py-3 rounded-full font-semibold hover:bg-gray-200 transition"
                            onClick={() => setShowSignup(true)}
                        >
                            Sign Up
                        </button>
                    </div>
                )}

                {showLogin && (
                    <LoginPopup
                        onClose={() => setShowLogin(false)}
                        onLogin={async () => {
                            const ok = await login();
                            setLoggedIn(!!ok);
                            setShowLogin(false);
                        }}
                    />
                )}
                {showSignup && (
                    <SignupPopup
                        onClose={() => setShowSignup(false)}
                        onSignup={async () => {
                            // After successful signup the backend sets the session cookie,
                            // re-fetch current user from backend to populate context.
                            const ok = await login();
                            setLoggedIn(!!ok);
                            setShowSignup(false);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
