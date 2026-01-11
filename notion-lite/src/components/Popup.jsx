// Create a login page popup:
import React from "react";
import { API_URL } from "../config";
import { CircleX } from "lucide-react";
import * as Icons from "lucide-react";
import IconPicker from "./IconPicker";

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

export function UploadPopup({ onClose, projectName, onUploaded }) {
    const [files, setFiles] = React.useState([]);
    const [uploadStatus, setUploadStatus] = React.useState({});
    const fileInputRef = React.useRef(null);

    const uploadOne = async (file) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("project", projectName);

        const res = await fetch(`${API_URL}/upload`, {
            method: "POST",
            body: formData,
            credentials: "include",
        });

        const data = await res.json();
        if (!data.success) {
            throw new Error(data.message || `Upload failed: ${file.name}`);
        }
        return data;
    };

    const handleFiles = async (selectedFiles) => {
        if (selectedFiles.length === 0) return;

        const fileArray = Array.from(selectedFiles);
        setFiles((prev) => [...prev, ...fileArray]);

        const newStatus = {};
        for (const file of fileArray) {
            newStatus[file.name] = { status: "pending", progress: 0 };
        }
        setUploadStatus((prev) => ({ ...prev, ...newStatus }));

        for (const file of fileArray) {
            try {
                setUploadStatus((prev) => ({
                    ...prev,
                    [file.name]: { status: "uploading", progress: 50 },
                }));
                await uploadOne(file);
                setUploadStatus((prev) => ({
                    ...prev,
                    [file.name]: { status: "success", progress: 100 },
                }));
            } catch (err) {
                setUploadStatus((prev) => ({
                    ...prev,
                    [file.name]: { status: "error", progress: 0, error: err.message },
                }));
            }
        }

        onUploaded?.();
    };

    function handleDrop(e) {
        e.preventDefault();
        const droppedFiles = e.dataTransfer.files;
        handleFiles(droppedFiles);
    }

    function handleDragOver(e) {
        e.preventDefault();
    }

    function handleFileSelect(e) {
        const selectedFiles = e.target.files;
        handleFiles(selectedFiles);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function handleChooseFile() {
        fileInputRef.current?.click();
    }

    return (
        <Popup title="Upload file" onClose={onClose}>
            {/* Drag drop zone */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center cursor-pointer hover:border-rose-500 transition-colors text-gray-400 text-center"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={handleChooseFile}
            >
                Drag and Drop files here or{" "}
                <span className="text-rose-600 underline ml-1 cursor-pointer">
                    Choose file
                </span>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.txt"
                style={{ display: "none" }}
            />
            {/* List of uploaded files added with popup */}
            {files.length > 0 && (
                <div className="mt-4">
                    <h3 className="font-semibold mb-2">Files:</h3>
                    <ul className="space-y-2">
                        {files.map((file, index) => {
                            const status = uploadStatus[file.name];
                            return (
                                <li key={index} className="flex items-center justify-between text-sm">
                                    <span className="truncate flex-1">{file.name}</span>
                                    <span className="ml-2">
                                        {status?.status === "pending" && (
                                            <span className="text-gray-500">Pending...</span>
                                        )}
                                        {status?.status === "uploading" && (
                                            <span className="text-blue-500">Uploading...</span>
                                        )}
                                        {status?.status === "success" && (
                                            <span className="text-green-500">✓ Uploaded</span>
                                        )}
                                        {status?.status === "error" && (
                                            <span className="text-red-500">✗ Failed</span>
                                        )}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </Popup>
    );
}

export function CreateProjectPopup({ onClose }) {
    const [projectName, setProjectName] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [imageUrl, setImageUrl] = React.useState("");
    const [color, setColor] = React.useState("#754B4D");
    const [icon, setIcon] = React.useState("Smile");
    const [showIconPicker, setShowIconPicker] = React.useState(false);
    const SelectedIcon = Icons[icon];
    const [error, setError] = React.useState("");

    const handleSubmit = (e) => {
        e.preventDefault();
        createProject(projectName, description, imageUrl, color, icon);
    };

    const createProject = async (name, description, imageUrl, color, icon) => {
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
                color: color,
                icon: icon,
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
                <div>
                    <label>Color</label>
                    <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                    />
                </div>
                <button className="flex items-center gap-2 rounded border px-3 py-2" onClick={()=>{
                    setShowIconPicker(!showIconPicker);
                }} type="button">
                    {SelectedIcon && <SelectedIcon size={18} />}
                    Choose Icon
                </button>
                {showIconPicker && <IconPicker value={icon} onChange={setIcon} />}
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
