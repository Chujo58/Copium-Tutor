import { useEffect, useState } from "react";
import GalleryView from "../components/GalleryView";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import { CreateProjectPopup } from "../components/Popup";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";
import { DocumentCard } from "../components/Card";

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
                if (data.success) {
                    setProjects(data.projects);
                    console.log("Fetched projects:", data.projects);
                }
            })
            .catch((err) => {
                console.error(err);
            });
    };

    useEffect(() => {
        fetchProjects();
    }, []);

    return (
        <div className="flex">
            <Sidebar
                projectsList={[
                    // Get the rest of the projects from the backend
                    ...projects.map((project) => ({
                        projectid: project.projectid,
                        name: project.name,
                        href: `/project/${project.projectid}`,
                        description: project.description,
                        image: project.image,
                        icon:
                            project.icon in Icons && project.icon !== null
                                ? Icons[project.icon]
                                : Folder,
                        color:
                            project.color !== null ? project.color : "#754B4D",
                    })),
                ]}
            />

            <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
                <div className="text-3xl main-header font-sans mb-2 text-dark">
                    Dashboard
                </div>
                <GalleryView
                    subjects={[
                        ...projects.map((project) => ({
                            projectid: project.projectid,
                            name: project.name,
                            href: `/project/${project.projectid}`,
                            description: project.description,
                            image: project.image,
                            icon:
                                project.icon in Icons && project.icon !== null
                                    ? Icons[project.icon]
                                    : Folder,
                            color:
                                project.color !== null
                                    ? project.color
                                    : "#754B4D",
                        })),
                    ]}
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
                {/* <DriveStyleUploader /> */}
                <DocumentCard
                    docTitle="Sample Document"
                    docType="pdf"
                    id={"EHKFS7o6"}
                />
            </div>
        </div>
    );
}
