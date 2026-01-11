import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import CourseDocumentUploader from "../components/CourseDocumentUploader";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

export default function CoursePage() {
    const { projectId } = useParams();

    const [projects, setProjects] = useState([]);
    const [course, setCourse] = useState(null);
    const [loading, setLoading] = useState(true);

    const [files, setFiles] = useState([]);
    const [filesLoading, setFilesLoading] = useState(false);

    const [indexing, setIndexing] = useState(false);
    const [indexResult, setIndexResult] = useState(null);
    const [indexError, setIndexError] = useState("");

    const fetchFiles = useCallback(async () => {
        setFilesLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects/${projectId}/files`, {
                credentials: "include",
                method: "GET",
            });
            const data = await res.json();
            if (data.success) setFiles(data.files || []);
            else setFiles([]);
        } catch (err) {
            console.error(err);
            setFiles([]);
        } finally {
            setFilesLoading(false);
        }
    }, [projectId]);

    const fetchProjectsAndCourse = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects`, {
                credentials: "include",
                method: "GET",
            });
            if (!res.ok) throw new Error("Failed to fetch projects");
            const data = await res.json();

            if (data.success) {
                setProjects(data.projects || []);
                const found = (data.projects || []).find(
                    (p) => p.projectid === projectId
                );
                setCourse(found ?? null);
            } else {
                setProjects([]);
                setCourse(null);
            }
        } catch (err) {
            console.error(err);
            setProjects([]);
            setCourse(null);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    const indexDocuments = useCallback(
        async ({ force = false } = {}) => {
            setIndexing(true);
            setIndexError("");
            setIndexResult(null);

            try {
                const url = force
                    ? `${API_URL}/projects/${projectId}/index?force=1`
                    : `${API_URL}/projects/${projectId}/index`;

                const res = await fetch(url, {
                    method: "POST",
                    credentials: "include",
                });

                const data = await res.json();

                if (!data.success) {
                    setIndexError(data.message || "Indexing failed");
                    return;
                }
                setIndexResult(data);
            } catch (e) {
                console.error(e);
                setIndexError("Indexing failed (network/server error)");
            } finally {
                setIndexing(false);
            }
        },
        [projectId]
    );

    useEffect(() => {
        fetchProjectsAndCourse();
        fetchFiles();
    }, [projectId, fetchProjectsAndCourse, fetchFiles]);

    const projectsList = useMemo(() => {
        return projects.map((project) => ({
            name: project.name,
            href: `/project/${project.projectid}`,
        }));
    }, [projects]);

    // helper: nicer label from "uploaded_files/<fileid>_OriginalName.pdf"
    const displayName = (filepath) => {
        const base = filepath.split("/").pop() || filepath;
        const idx = base.indexOf("_");
        return idx >= 0 ? base.slice(idx + 1) : base;
    };

    const uploadedCount =
        (indexResult?.uploaded_documents || 0) +
        (indexResult?.uploaded_split_documents || 0);

    // "Already indexed" heuristic: nothing uploaded, but something skipped
    const alreadyIndexed =
        !!indexResult &&
        uploadedCount === 0 &&
        typeof indexResult.skipped_files === "number" &&
        indexResult.skipped_files > 0;

    return (
        <div className="flex">
            <Sidebar
                projectsList={[
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
                {loading ? (
                    <div className="mt-6">Loading course…</div>
                ) : !course ? (
                    <div className="mt-6">
                        <div className="text-2xl font-semibold">
                            Course not found
                        </div>
                        <div className="opacity-70">
                            (Either the course doesn’t exist, or you’re not
                            logged in.)
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mt-4">
                            <div className="text-3xl main-header font-sans text-dark">
                                {course.name}
                            </div>

                            {course.description ? (
                                <div className="mt-1 opacity-80">
                                    {course.description}
                                </div>
                            ) : null}

                            <div className="mt-2 text-sm opacity-60">
                                projectId: {course.projectid} (debug)
                            </div>
                        </div>

                        {/* DOCUMENTS */}
                        <div className="mt-10">
                            <h2 className="text-xl font-semibold">Documents</h2>
                            <div className="opacity-70">
                                Upload PDFs/docs here. Index them once, then
                                generate flashcards instantly.
                            </div>

                            <CourseDocumentUploader
                                projectName={course.name}
                                onUploaded={async () => {
                                    // refresh list
                                    await fetchFiles();
                                    // new uploads mean indexing status might be stale
                                    setIndexResult(null);
                                    setIndexError("");
                                }}
                            />

                            <div className="mt-4">
                                <div className="flex items-center gap-3">
                                    <div className="font-semibold">
                                        Course files
                                    </div>

                                    <button
                                        className="text-sm underline opacity-80"
                                        onClick={fetchFiles}
                                        disabled={filesLoading}
                                    >
                                        {filesLoading
                                            ? "Refreshing…"
                                            : "Refresh"}
                                    </button>

                                    <button
                                        className="text-sm underline opacity-80"
                                        onClick={() =>
                                            indexDocuments({ force: false })
                                        }
                                        disabled={
                                            indexing ||
                                            files.length === 0 ||
                                            alreadyIndexed
                                        }
                                        title={
                                            files.length === 0
                                                ? "Upload documents first"
                                                : alreadyIndexed
                                                ? "Already indexed"
                                                : ""
                                        }
                                    >
                                        {alreadyIndexed
                                            ? "Indexed ✓"
                                            : indexing
                                            ? "Indexing…"
                                            : "Index documents"}
                                    </button>

                                    {/* Optional “force” link (safe even if backend ignores it) */}
                                    <button
                                        className="text-sm underline opacity-60"
                                        onClick={() =>
                                            indexDocuments({ force: true })
                                        }
                                        disabled={
                                            indexing || files.length === 0
                                        }
                                        title="Re-upload/index documents (use only if you changed files but kept same names)"
                                    >
                                        Force re-index
                                    </button>
                                </div>

                                {indexError ? (
                                    <div className="mt-2 text-sm opacity-80">
                                        ⚠️ {indexError}
                                    </div>
                                ) : null}

                                {indexResult ? (
                                    <div className="mt-2 text-sm opacity-80">
                                        ✅ Index result — uploaded:{" "}
                                        {indexResult.uploaded_documents || 0},
                                        split parts:{" "}
                                        {indexResult.uploaded_split_documents ||
                                            0}
                                        {typeof indexResult.skipped_files ===
                                        "number"
                                            ? `, skipped: ${indexResult.skipped_files}`
                                            : ""}
                                        {typeof indexResult.failed_files ===
                                        "number"
                                            ? `, failed: ${indexResult.failed_files}`
                                            : ""}
                                    </div>
                                ) : null}

                                {filesLoading ? (
                                    <div className="mt-2 opacity-70">
                                        Loading files…
                                    </div>
                                ) : files.length === 0 ? (
                                    <div className="mt-2 opacity-70">
                                        No documents yet.
                                    </div>
                                ) : (
                                    <ul className="mt-3 space-y-2">
                                        {files.map((f) => (
                                            <li
                                                key={f.fileid}
                                                className="flex items-center gap-3"
                                            >
                                                <a
                                                    className="underline"
                                                    href={`${API_URL}/files/${f.fileid}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {displayName(f.filepath)}
                                                </a>
                                                <span className="text-xs opacity-60">
                                                    ({f.file_type || "file"})
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>

                        {/* FLASHCARDS */}
                        <div className="mt-10">
                            <h2 className="text-xl font-semibold">
                                Flashcards
                            </h2>
                            <div className="opacity-70">
                                Tip: index documents first, then create decks
                                for specific prompts.
                            </div>
                            <Link
                                className="underline"
                                to={`/project/${projectId}/flashcards`}
                            >
                                Open Flashcards
                            </Link>
                        </div>

                        {/* QUIZZES */}
                        <div className="mt-10">
                            <h2 className="text-xl font-semibold">Quizzes</h2>
                            <div className="opacity-70">
                                (Quiz list goes here)
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
