// Create a login page popup:
import React, { useEffect } from "react";
import { API_URL } from "../config";
import { CircleX } from "lucide-react";
import * as Icons from "lucide-react";
import IconPicker from "./IconPicker";
import { DocumentCard } from "./Card";

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

export function UploadPopup({ projects, onClose }) {
    const [uploadedFiles, setUploadedFiles] = React.useState([]);
    const [fileIds, setFileIds] = React.useState([]);

    

    const handleDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        const mappedFiles = files.map((file) => ({
            file,
            id: Date.now() + Math.random(),
            thumbnail: null,
            progress: 0,
        }));
        setUploadedFiles((prev) => [...prev, ...mappedFiles]);

        console.log("Dropped files:", mappedFiles);
        mappedFiles.forEach(uploadFile);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleInput = (e) => {
        const files = Array.from(e.target.files);
        const mappedFiles = files.map((file) => ({
            file,
            id: Date.now() + Math.random(),
            thumbnail: null,
            progress: 0,
        }));
        setUploadedFiles((prev) => [...prev, ...mappedFiles]);

        console.log("Input files:", mappedFiles);
        mappedFiles.forEach(uploadFile);
    }

    const removeFile = (id) => {
        setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
        setFileIds((prev) => prev.filter((_, index) => uploadedFiles[index].id !== id));
    };

    const uploadFile = (f) => {
        // Upload the file to the first project in the list
        try {
            const formData = new FormData();
            formData.append("file", f.file);
            formData.append("project", projects[0]?.name || "default");

            fetch(`${API_URL}/upload`, {
                method: "POST",
                body: formData,
                credentials: "include",
            }).then((response) => {
                if (!response.ok) {
                    console.error("Upload failed:", response.statusText);
                } else {
                    console.log("Upload successful", response);
                    // Update uploadedFileId here
                    response.json().then((data) => {
                        const uploadedFileId = data.fileid;
                        // If there are multiple projects, link the uploaded file to them
                        for (let i = 1; i < projects.length; i++) {
                            const formDataLink = new FormData();
                            formDataLink.append(
                                "project",
                                projects[i]?.name || "default"
                            );

                            fetch(
                                `${API_URL}/files/${uploadedFileId}/add_project`,
                                {
                                    method: "POST",
                                    body: formDataLink,
                                    credentials: "include",
                                }
                            ).then((res) => {
                                if (!res.ok) {
                                    console.error(
                                        "Linking file to project failed:",
                                        res.statusText
                                    );
                                } else {
                                    console.log(
                                        "File linked to project successfully"
                                    );
                                }
                            });
                        }
                        // Store the uploaded file ID
                        setFileIds((prev) => [...prev, uploadedFileId]);
                    });
                }
            });
        } catch (err) {
            console.error("Error uploading file:", err);
        }
    };

    return (
        <Popup title="Upload file" onClose={onClose}>
            {/* Drag drop zone */}
            <div
                className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center cursor-pointer hover:border-rose-500 transition-colors text-gray-400 text-center"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                Drag and Drop files here or{" "}
                <label className="ml-1 cursor-pointer underline text-blue-500 hover:text-blue-600">
                    browse files
                    <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleInput}
                    />
                </label>
            </div>
            {/* List of uploaded files added with popup */}
            {uploadedFiles.map((f) => (
                <DocumentCard
                    key={f.id}
                    docTitle={f.file.name}
                    id={fileIds[uploadedFiles.indexOf(f)]}
                    onDeleted={() => {
                        removeFile(f.id);
                    }}
                />
            ))    
            }
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
                <button
                    className="flex items-center gap-2 rounded border px-3 py-2"
                    onClick={() => {
                        setShowIconPicker(!showIconPicker);
                    }}
                    type="button"
                >
                    {SelectedIcon && <SelectedIcon size={18} />}
                    Choose Icon
                </button>
                {showIconPicker && (
                    <IconPicker value={icon} onChange={setIcon} />
                )}
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
