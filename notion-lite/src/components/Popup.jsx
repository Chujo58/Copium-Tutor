// Create a login page popup:
import React from "react";
import CloseIcon from "../assets/close.svg?react";
import { API_URL } from "../config";
import { CircleX } from "lucide-react";

export default function Popup({ title, children, onClose, wide = false }) {
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div
                className={
                    "bg-white rounded-lg shadow-lg w-11/12 p-4 relative " +
                    (wide ? "max-w-6xl h-[85vh]" : "max-w-md")
                }
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-primary hover:text-accent focus:outline-none"
                >
                    <CircleX />
                </button>
                {title && (
                    <h2 className="text-xl text-primary font-semibold font-card main-header mb-4">
                        {title}
                    </h2>
                )}
                <div className="text-dark h-full overflow-auto">{children}</div>
            </div>
        </div>
    );
}

export function UploadPopup({ onClose }) {
    return (
        <Popup title="Upload file" onClose={onClose}>
            {/* Drag drop zone */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center cursor-pointer hover:border-rose-500 transition-colors text-gray-400 text-center">
                Drag and Drop files here or{" "}
                <a href="#" className="text-rose-600 underline">
                    Choose file
                </a>
            </div>
            {/* List of uploaded files added with popup */}
        </Popup>
    );
}

export function CreateProjectPopup({ onClose }) {
    const [projectName, setProjectName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [imageUrl, setImageUrl] = React.useState("");
    const [error, setError] = React.useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        createProject(projectName, description, imageUrl);
    };

    const createProject = async (name, description, imageUrl) => {
        const response = await fetch(`${API_URL}/projects`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                name: name,
                description: description,
                image: imageUrl,
            }),
        });

        const data = await response.json();
        if (!data.success) {
            setError(data.message);
        }
        onClose();
        return data;
    };

    return (
        <Popup title="Create New Project" onClose={onClose}>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label>Project Name</label>
                    <input
                        type="text"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label>Description</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </div>
                <div>
                    <label>Image URL</label>
                    <input
                        type="text"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                    />
                </div>
                <div>{error}</div>
                <button type="submit">Create Project</button>
            </form>
        </Popup>
    );
}

// Create the login popup which should have fields for username and password and a login button.
export function LoginPopup({ onClose, onLogin }) {
    const [username, setUsername] = React.useState("");
    const [password, setPassword] = React.useState("");
    const [error, setError] = React.useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        logIn(username, password);
    };

    const logIn = async (username, password) => {
        const response = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
                email: username,
                password: password,
            }),
        });

        const data = await response.json();
        if (!data.success) {
            // Handle login error (you might want to show an error message)
            setError(data.message);
        } else {
            setTimeout(() => {
                window.location.reload();
            }, 500);
        }
        return data;
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
                <div>{error}</div>
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
            }),
        });

        const data = await response.json();
        if (!data.success) {
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
