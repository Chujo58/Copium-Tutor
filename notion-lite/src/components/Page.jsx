import GalleryView from "./GalleryView";
import DriveStyleUploader from "./DocumentUploader";
import { useState } from "react";
import { LoginPopup, SignupPopup } from "./Popup";

// User dashboard page

export function UserDashboard() {
    // Query the projects from the backend (localhost:8000/projects) and display them in a gallery view
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "http://localhost:8000/projects", false);
    xhr.send(null);
    const projects = JSON.parse(xhr.responseText);
    console.log("Projects:", projects);

    return (
        <main className="flex-1 p-10 overflow-auto">
            
            <DriveStyleUploader />
        </main>
    );
}

// Landing page, should have some sort of login and signup buttons that will open the corresponding popups
export function LandingPage() {
    const [showLogin, setShowLogin] = useState(false);
    const [showSignup, setShowSignup] = useState(false);

    // Create method to handle the Signup and login from the backend
    const handleSignup = (firstName, lastName, email, password, confirmPassword) => {
        // Send the signup request to the backend
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:8000/signup", true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                alert("Signup successful! Please login.");
                setShowSignup(false);
            } else if (xhr.readyState === 4) {
                alert("Signup failed: " + xhr.responseText);
            }
        };
        xhr.send(
            JSON.stringify({
                firstName,
                lastName,
                email,
                password,
                confirmPassword,
            })
        );
    };

    const handleLogin = (username, password) => {
        // Send the login request to the backend
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:8000/login", true);
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4 && xhr.status === 200) {
                alert("Login successful!");
                setShowLogin(false);
            } else if (xhr.readyState === 4) {
                alert("Login failed: " + xhr.responseText);
            }
        };
        xhr.send(
            JSON.stringify({
                username,
                password,
            })
        );
    };

    return (
        <div className="flex flex-col items-center justify-center w-screen bg-gradient-to-b from-rose-china to-rose-copper text-white">
            <h1 className="text-5xl font-bold mb-6">Welcome to <a className="font-card main-header text-dark">Copium Tutor</a></h1>
            <p className="text-xl mb-8">A backboard.io app for learning and coping.</p>
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
            {showLogin && <LoginPopup onClose={() => setShowLogin(false)} />}
            {showSignup && <SignupPopup onClose={() => setShowSignup(false)} onSignup={() => handleSignup()} />}
        </div>
    );
}