import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import {
    Folder,
    Sparkles,
    Layers,
    FileText,
    MessageSquare,
    HeartHandshake,
    ArrowUpRight,
} from "lucide-react";

export default function BackboardThanksPage() {
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch(`${API_URL}/projects`, {
                    credentials: "include",
                    method: "GET",
                });
                const data = await res.json();
                if (data.success) {
                    setProjects(data.projects || []);
                } else {
                    setProjects([]);
                }
            } catch (err) {
                console.error(err);
                setProjects([]);
            }
        };

        fetchProjects();
    }, []);

    return (
        <div className="flex">
            <Sidebar projects={projects}/>

            <div className="flex-1 h-screen overflow-auto bg-rose-china">
                <div className="p-10">
                    <Link
                        to="/dashboard"
                        className="inline-flex items-center gap-2 text-dark hover:opacity-80"
                    >
                        <span className="px-2 py-1 rounded-lg border border-surface bg-white/50">
                            ←
                        </span>
                        Back to Dashboard
                    </Link>

                    <div className="mt-6 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/60 text-dark">
                            <HeartHandshake size={22} />
                        </div>
                        <div>
                            <div className="text-3xl font-semibold text-dark font-card">
                                Backboard.io Appreciation
                            </div>
                            <div className="text-sm text-dark/70">
                                The partner powering our indexed study workflows.
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 rounded-3xl border border-black/10 bg-white/70 p-6 shadow-sm relative overflow-hidden">
                        <div className="absolute -top-16 right-6 h-40 w-40 rounded-full bg-[#C28477]/40 blur-2xl" />
                        <div className="absolute bottom-0 left-10 h-32 w-32 rounded-full bg-[#E6D4C7]/60 blur-2xl" />

                        <div className="relative grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                            <div>
                                <div className="text-2xl font-semibold text-dark font-card">
                                    Special thanks to Backboard.io
                                </div>
                                <p className="mt-3 text-sm text-dark/75">
                                    Backboard.io makes our study workflows faster and more reliable by
                                    indexing documents once, keeping context organized, and letting us
                                    generate flashcards, quizzes, and chat answers from the exact files
                                    you choose. It helps our projects ship quicker, stay consistent, and
                                    scale to real course workloads without extra manual setup.
                                </p>
                                <div className="mt-4">
                                    <a
                                        href="https://backboard.io"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl bg-dark text-white px-4 py-2 hover:bg-dark/90 transition font-card"
                                    >
                                        Visit Backboard.io
                                        <ArrowUpRight size={16} />
                                    </a>
                                </div>
                            </div>
                            <div className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white/70 p-4">
                                <div className="text-sm font-semibold text-dark font-card">
                                    Why it powers Copium Tutor
                                </div>
                                <ul className="space-y-2 text-sm text-dark/80">
                                    <li>Indexes once, reuses everywhere for consistent tool.</li>
                                    <li>Keeps document context clear so answers stay grounded.</li>
                                    <li>Reduces latency when generating study content.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
