import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import GalleryView from "../components/GalleryView";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import { CreateProjectPopup } from "../components/Popup";
import * as Icons from "lucide-react";
import {
    Folder,
    Sparkles,
    Layers,
    FileText,
    MessageSquare,
    PlusCircle,
    ArrowUpRight,
} from "lucide-react";

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

    const deleteProject = async (project) => {
        if (!project?.projectid) return;
        const ok = confirm(
            `Delete "${project.name || "this subject"}"? This cannot be undone.`,
        );
        if (!ok) return;

        try {
            const res = await fetch(
                `${API_URL}/projects/${project.projectid}`,
                {
                    method: "DELETE",
                    credentials: "include",
                },
            );
            const data = await res.json();
            if (!data.success) {
                alert(data.message || "Failed to delete subject");
                return;
            }
            fetchProjects();
        } catch (err) {
            console.error(err);
            alert("Error deleting subject");
        }
    };

    return (
        <div className="flex">
            <Sidebar projectPopupStatus={{ onEdited: fetchProjects }} />
            <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
                <div className="text-3xl main-header font-card mb-2 text-dark">
                    Dashboard
                </div>

                <style>{`
                  .intro-card {
                    opacity: 0;
                    transform: translateX(-18px) translateY(12px);
                    animation: intro-slide-in 650ms ease-out forwards;
                  }
                  @keyframes intro-slide-in {
                    0% {
                      opacity: 0;
                      transform: translateX(-18px) translateY(12px);
                    }
                    100% {
                      opacity: 1;
                      transform: translateX(0) translateY(0);
                    }
                  }
                  @media (prefers-reduced-motion: reduce) {
                    .intro-card {
                      animation: none;
                      opacity: 1;
                      transform: none;
                    }
                  }
                `}</style>

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
                    onDeleteSubject={deleteProject}
                />

                <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-dark/70">
                    <span>New here?</span>
                    <Link
                        to="/features"
                        className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-dark hover:bg-white transition"
                    >
                        Visit feature guide
                        <ArrowUpRight size={14} />
                    </Link>
                </div>

                <div className="intro-card mt-6 rounded-3xl border border-black/10 bg-white/65 shadow-sm p-6 relative overflow-hidden">
                    <div className="absolute -top-10 -right-16 h-44 w-44 rounded-full bg-accent/40 blur-2xl" />
                    <div className="absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-surface/45 blur-2xl" />

                    <div className="relative grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                        <div>
                            <div className="text-2xl font-card font-semibold text-dark">
                                Turn messy notes into confident study sessions.
                            </div>
                            <p className="mt-3 text-sm text-dark/75">
                                Copium Tutor helps you compress long PDFs into
                                flashcards, quizzes, and a memory-aware chatbot.
                                In real life, that means less time rereading and
                                more time practicing, so you walk into exams and
                                interviews with real recall, not just
                                recognition.
                            </p>

                            <div className="mt-4 flex flex-wrap items-center gap-3 font-card">
                                <button
                                    onClick={() => setShowAddProject(true)}
                                    className="inline-flex items-center gap-2 rounded-xl bg-dark text-white px-4 py-2 hover:bg-dark/90 transition"
                                >
                                    <PlusCircle size={18} />
                                    Create subject
                                </button>
                                <Link
                                    to="/features"
                                    className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-4 py-2 text-dark hover:bg-white transition"
                                >
                                    Explore feature guide
                                    <ArrowUpRight size={16} />
                                </Link>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-black/10 bg-white/70 p-4 hover:-translate-y-1 hover:shadow-md transition">
                            <div className="text-sm font-card font-semibold text-dark">
                                Why this matters
                            </div>
                            <ul className="mt-3 space-y-2 text-sm text-dark/80">
                                <li>
                                    Practice beats cramming. Quizzes show
                                    exactly what you miss.
                                </li>
                                <li>
                                    Flashcards keep facts fresh without
                                    rereading everything.
                                </li>
                                <li>
                                    Chat explains concepts in your own course
                                    context.
                                </li>
                            </ul>
                            <div className="mt-4 flex flex-wrap gap-2 text-xs text-dark/70">
                                <span className="rounded-full border border-black/10 bg-white/70 px-3 py-1">
                                    Upload once, study everywhere
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {showAddProject && (
                    <CreateProjectPopup
                        onClose={() => {
                            setShowAddProject(false);
                            fetchProjects();
                        }}
                    />
                )}
                {/* <DriveStyleUploader /> */}
            </div>
        </div>
    );
}
