// Create a login page popup:
import React from "react";
import CloseIcon from "../assets/close.svg?react";
import { API_URL } from "../config";



export default function Popup({ title, children, onClose }) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-lg w-11/12 max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-primary hover:text-accent focus:outline-none"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>
                {title && (
                    <h2 className="text-xl text-primary font-semibold font-card main-header mb-4">
                        {title}
                    </h2>
                )}
                <div className="text-dark">{children}</div>
            </div>
        </div>
    );
}

// Create the login popup which should have fields for username and password and a login button.
export function LoginPopup({ onClose, onLogin }) {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        onLogin(username, password);
    };

    return (
        <Popup title="Login" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4 ">
                <div>
                    <label>Username</label>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Login</button>
            </form>
        </Popup>
    );
}

// Similarly, you can create a SignupPopup component with firstname, lastname, email, password fields and a signup button.
export function SignupPopup({ onClose, onSignup }) {
    const [firstName, setFirstName] = React.useState("");
    const [lastName, setLastName] = React.useState("");
    const [email, setEmail] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [confirmPassword, setConfirmPassword] = React.useState("");
    const [error, setError] = React.useState("");

    const signUp = async (
        firstName,
        lastName,
        email,
        password,
        confirmPassword
    ) => {
        const response = await fetch(`${API_URL}/signup`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                email: email,
                password: password,
                confirm_password: confirmPassword,
                fname: firstName,
                lname: lastName,
            })
        });

        const data = await response.json();
        if (!data.success){
            setError(data.message);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        signUp(firstName, lastName, email, password, confirmPassword);
    };

    return (
        <Popup title="Sign Up" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label>First Name</label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Last Name</label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Password</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Confirm Password</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                    />
                </div>
                <div>{error}</div>
                <button type="submit">Sign Up</button>
            </form>
        </Popup>
    );
}
