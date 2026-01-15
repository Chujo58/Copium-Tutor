import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import CourseDocumentUploader from "../components/CourseDocumentUploader";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

const QUIZ_TYPE_LABELS = {
  mcq: "QCM (Multiple choice)",
  short: "Short answer",
  long: "Long answer",
};

const QUIZ_STATUS_LABELS = {
  pending: "Generating",
  ready: "Ready",
  failed: "Failed",
};

function Badge({ label, title, tone = "neutral" }) {
  const toneClass =
    tone === "strong"
      ? "border-dark text-white bg-dark/90"
      : tone === "warm"
      ? "border-accent text-dark bg-accent/20"
      : tone === "danger"
      ? "border-primary text-dark bg-primary/10"
      : "border-secondary text-dark bg-white/60";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${toneClass}`}
      title={title}
    >
      {label}
    </span>
  );
}

function SoftButton({
  children,
  onClick,
  disabled,
  title,
  variant = "ghost",
  type = "button",
}) {
  const base =
    "px-4 py-2 rounded-xl border transition disabled:opacity-40 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? "border-dark/30 bg-dark text-white hover:bg-dark/90"
      : variant === "danger"
      ? "border-primary/40 bg-primary/10 text-dark hover:bg-primary/20"
      : "border-secondary/50 bg-white/70 text-dark hover:bg-white";

  return (
    <button className={`${base} ${cls}`} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/50 backdrop-blur p-5 shadow-sm">
      <div className="h-5 w-40 bg-[#E0CBB9]/60 rounded" />
      <div className="mt-3 h-4 w-full bg-[#E0CBB9]/40 rounded" />
      <div className="mt-2 h-4 w-2/3 bg-[#E0CBB9]/35 rounded" />
    </div>
  );
}

const displayName = (filepath) => {
  const base = filepath.split("/").pop() || filepath;
  const idx = base.indexOf("_");
  return idx >= 0 ? base.slice(idx + 1) : base;
};

export default function QuizzesHomePage() {
  const { projectid } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState(null);
  const [indexError, setIndexError] = useState("");

  const [topic, setTopic] = useState("");
  const [quizType, setQuizType] = useState("mcq");
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [selectionReady, setSelectionReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const loadingGif = `${API_URL}/public/cat.gif`;

  const selectionStorageKey = useMemo(
    () => `quiz-file-selection-${projectid}`,
    [projectid]
  );

  const fetchProjectsAndCourse = useCallback(async () => {
    setCourseLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects`, {
        credentials: "include",
        method: "GET",
      });
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
        const found = (data.projects || []).find((p) => p.projectid === projectid);
        setCourse(found ?? null);
      } else {
        setProjects([]);
        setCourse(null);
      }
    } catch (e) {
      console.error(e);
      setProjects([]);
      setCourse(null);
    } finally {
      setCourseLoading(false);
    }
  }, [projectid]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/quizzes`, {
        credentials: "include",
      });
      const data = await res.json();
      setQuizzes(data.success ? data.quizzes : []);
    } catch (e) {
      console.error(e);
      setQuizzes([]);
    } finally {
      setLoading(false);
    }
  }, [projectid]);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/files`, {
        credentials: "include",
      });
      const data = await res.json();
      setFiles(data.success ? data.files : []);
    } catch (e) {
      console.error(e);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [projectid]);

  const indexDocuments = useCallback(
    async ({ force = false } = {}) => {
      setIndexing(true);
      setIndexError("");
      setIndexResult(null);
      try {
        const url = force
          ? `${API_URL}/projects/${projectid}/index?force=1`
          : `${API_URL}/projects/${projectid}/index`;
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
    [projectid]
  );

  useEffect(() => {
    fetchProjectsAndCourse();
    fetchQuizzes();
    fetchFiles();
  }, [fetchProjectsAndCourse, fetchQuizzes, fetchFiles]);

  useEffect(() => {
    if (!selectionReady) return;
    setSelectedFiles((prev) => {
      const nextSelection = {};
      files.forEach((f) => {
        if (Object.prototype.hasOwnProperty.call(prev, f.fileid)) {
          nextSelection[f.fileid] = prev[f.fileid];
        } else {
          nextSelection[f.fileid] = true;
        }
      });
      return nextSelection;
    });
  }, [files, selectionReady]);

  useEffect(() => {
    if (!projectid) return;
    try {
      const stored = localStorage.getItem(selectionStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === "object") {
          setSelectedFiles(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to read quiz file selection", e);
    } finally {
      setSelectionReady(true);
    }
  }, [projectid, selectionStorageKey]);

  useEffect(() => {
    if (!selectionReady) return;
    try {
      localStorage.setItem(
        selectionStorageKey,
        JSON.stringify(selectedFiles)
      );
    } catch (e) {
      console.error("Failed to store quiz file selection", e);
    }
  }, [selectedFiles, selectionReady, selectionStorageKey]);

  const uploadedCount =
    (indexResult?.uploaded_documents || 0) +
    (indexResult?.uploaded_split_documents || 0);

  const alreadyIndexed =
    !!indexResult &&
    uploadedCount === 0 &&
    typeof indexResult.skipped_files === "number" &&
    indexResult.skipped_files > 0;

  const selectedFileIds = useMemo(
    () =>
      Object.entries(selectedFiles)
        .filter(([, checked]) => checked)
        .map(([fileid]) => fileid),
    [selectedFiles]
  );

  const filteredQuizzes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quizzes;
    return quizzes.filter((quiz) => {
      const hay = `${quiz.title || ""} ${quiz.topic || ""} ${quiz.quizid || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [quizzes, query]);

  const toggleFile = (fileid) => {
    setSelectedFiles((prev) => ({ ...prev, [fileid]: !prev[fileid] }));
  };

  const selectAll = () => {
    const nextSelection = {};
    files.forEach((f) => {
      nextSelection[f.fileid] = true;
    });
    setSelectedFiles(nextSelection);
  };

  const clearAll = () => {
    const nextSelection = {};
    files.forEach((f) => {
      nextSelection[f.fileid] = false;
    });
    setSelectedFiles(nextSelection);
  };

  const createQuiz = async () => {
    if (!topic.trim()) {
      alert("Please enter a quiz topic.");
      return;
    }
    if (selectedFileIds.length === 0) {
      alert("Please select at least one document.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/quizzes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          quiz_type: quizType,
          num_questions: Number(numQuestions),
          document_ids: selectedFileIds,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to create quiz");
        return;
      }
      if (data.warning) {
        alert(data.warning);
      }
      const nextQuizId = data.quizid || data.quiz?.quizid;
      if (!nextQuizId) {
        alert("Quiz created but missing quiz id. Please refresh and open it from the list.");
        await fetchQuizzes();
        return;
      }
      setTopic("");
      await fetchQuizzes();
      navigate(`/project/${projectid}/quizzes/${nextQuizId}`);
    } catch (e) {
      console.error(e);
      alert("Error creating quiz");
    } finally {
      setCreating(false);
    }
  };

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
            color: project.color !== null ? project.color : "#754B4D",
          })),
        ]}
      />

      <div className="flex-1 h-screen overflow-auto bg-gradient-to-b from-[#F6EFEA] via-[#E0CBB9]/35 to-[#F6EFEA]">
        {creating ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F6EFEA]/80 backdrop-blur">
            <div className="rounded-3xl border border-white/50 bg-white/80 px-8 py-7 shadow-lg text-center">
              <img
                src={loadingGif}
                alt="Generating quiz"
                className="mx-auto h-44 w-44 object-contain"
              />
              <div className="mt-3 text-dark font-semibold">
                Creating your quiz…
              </div>
              <div className="text-sm text-dark/70">
                Hang tight, this can take a minute.
              </div>
            </div>
          </div>
        ) : null}
        <div className="p-10">
          <Link
            to={`/project/${projectid}`}
            className="inline-flex items-center gap-2 text-dark hover:opacity-80"
          >
            <span className="px-2 py-1 rounded-lg border border-[#E0CBB9] bg-white/50">←</span>
            Back to Course
          </Link>

          {courseLoading ? (
            <div className="mt-8 text-dark/70">Loading…</div>
          ) : !course ? (
            <div className="mt-8">
              <div className="text-2xl font-semibold text-dark">Course not found</div>
              <div className="text-dark/70">
                (Either it doesn’t exist, or you’re not logged in.)
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-3xl font-semibold text-dark">Quizzes</div>
                    <div className="mt-1 text-dark/70">{course.name}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge label={projectid} title="Project id" />
                      <Badge
                        label={`${quizzes.length} quiz${quizzes.length === 1 ? "" : "zes"}`}
                        title="Total quizzes"
                        tone="warm"
                      />
                      <Badge
                        label={`${files.length} document${files.length === 1 ? "" : "s"}`}
                        title="Uploaded documents"
                      />
                    </div>
                  </div>

                  <div className="text-right text-sm text-dark/60">
                    Generate practice quizzes from your course materials.
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-dark">Create a quiz</h2>
                    {creating ? <Badge label="Creating…" title="Creating state" /> : null}
                  </div>

                  <div className="mt-4 grid gap-4">
                    <input
                      className="w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Quiz topic (e.g., Module 2 review)"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      disabled={creating}
                    />

                    <div className="flex flex-wrap gap-3">
                      <label className="flex flex-col text-sm gap-1 text-dark/80">
                        Type
                        <select
                          className="rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                          value={quizType}
                          onChange={(e) => setQuizType(e.target.value)}
                          disabled={creating}
                        >
                          {Object.entries(QUIZ_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="flex flex-col text-sm gap-1 text-dark/80">
                        Number of questions
                        <input
                          type="number"
                          className="w-40 rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                          min={1}
                          max={50}
                          value={numQuestions}
                          onChange={(e) => setNumQuestions(e.target.value)}
                          disabled={creating}
                        />
                      </label>
                    </div>

                    <div className="rounded-2xl border border-white/50 bg-white/60 backdrop-blur p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="font-semibold text-dark">Use these documents</div>
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <SoftButton
                            onClick={selectAll}
                            disabled={creating || files.length === 0}
                            title="Select all documents"
                          >
                            Select all
                          </SoftButton>
                          <SoftButton
                            onClick={clearAll}
                            disabled={creating || files.length === 0}
                            title="Clear selection"
                          >
                            Clear
                          </SoftButton>
                          <SoftButton
                            onClick={fetchFiles}
                            disabled={creating || filesLoading}
                            title="Refresh documents"
                          >
                            {filesLoading ? "Refreshing…" : "Refresh"}
                          </SoftButton>
                        </div>
                      </div>

                      <div className="mt-3 text-sm text-dark/70">
                        Selected {selectedFileIds.length} of {files.length} documents
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                        <SoftButton
                          onClick={() => indexDocuments({ force: false })}
                          disabled={indexing || files.length === 0 || alreadyIndexed}
                          title={
                            files.length === 0
                              ? "Upload documents first"
                              : alreadyIndexed
                              ? "Already indexed"
                              : "Index course documents"
                          }
                        >
                          {alreadyIndexed
                            ? "Indexed ✓"
                            : indexing
                            ? "Indexing…"
                            : "Index documents"}
                        </SoftButton>
                        <SoftButton
                          variant="danger"
                          onClick={() => indexDocuments({ force: true })}
                          disabled={indexing || files.length === 0}
                          title="Re-upload/index documents (use only if you changed files but kept same names)"
                        >
                          Force re-index
                        </SoftButton>
                        {indexError ? (
                          <span className="text-primary">{indexError}</span>
                        ) : null}
                      </div>

                      {indexResult ? (
                        <div className="mt-2 text-xs text-dark/70">
                          Index result — uploaded: {indexResult.uploaded_documents || 0}, split parts:{" "}
                          {indexResult.uploaded_split_documents || 0}
                          {typeof indexResult.skipped_files === "number"
                            ? `, skipped: ${indexResult.skipped_files}`
                            : ""}
                          {typeof indexResult.failed_files === "number"
                            ? `, failed: ${indexResult.failed_files}`
                            : ""}
                        </div>
                      ) : null}

                      {course ? (
                        <div className="mt-4">
                          <CourseDocumentUploader
                            projectName={course.name}
                            onUploaded={async () => {
                              await fetchFiles();
                              setIndexResult(null);
                              setIndexError("");
                            }}
                          />
                        </div>
                      ) : null}

                      {filesLoading ? (
                        <div className="mt-4 space-y-2">
                          <SkeletonRow />
                          <SkeletonRow />
                        </div>
                      ) : files.length === 0 ? (
                        <div className="mt-3 text-dark/70">No documents yet.</div>
                      ) : (
                        <ul className="mt-4 space-y-2">
                          {files.map((f) => (
                            <li
                              key={f.fileid}
                              className="flex items-center justify-between gap-3 rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2"
                            >
                              <label className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  className="accent-dark"
                                  checked={!!selectedFiles[f.fileid]}
                                  onChange={() => toggleFile(f.fileid)}
                                  disabled={creating}
                                />
                                <span className="text-dark">{displayName(f.filepath)}</span>
                              </label>
                              <Badge
                                label={f.file_type || "file"}
                                title="File type"
                                tone="warm"
                              />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <SoftButton
                        variant="primary"
                        onClick={createQuiz}
                        disabled={creating}
                        title="Create quiz"
                      >
                        {creating ? "Creating…" : "Create quiz"}
                      </SoftButton>
                      <SoftButton
                        onClick={() => {
                          setTopic("");
                          setQuizType("mcq");
                          setNumQuestions(10);
                        }}
                        disabled={creating}
                        title="Reset fields"
                      >
                        Reset
                      </SoftButton>
                    </div>

                    <div className="text-sm text-dark/60">
                      Tip: Use a focused topic and fewer questions for quicker generation.
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-dark">Your quizzes</h2>
                    <SoftButton onClick={fetchQuizzes} disabled={loading} title="Refresh quizzes">
                      Refresh
                    </SoftButton>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <input
                      className="w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Search quizzes (title, topic, id)…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={loading}
                    />
                    <SoftButton onClick={() => setQuery("")} disabled={loading || !query} title="Clear search">
                      Clear
                    </SoftButton>
                  </div>

                  <div className="mt-2 text-sm text-dark/60">
                    Showing <span className="font-semibold">{filteredQuizzes.length}</span> of{" "}
                    <span className="font-semibold">{quizzes.length}</span>
                    {query.trim() ? (
                      <>
                        {" "}
                        for <Badge label={query.trim()} title="Search query" />
                      </>
                    ) : null}
                  </div>

                  {loading ? (
                    <div className="mt-4 space-y-3">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : filteredQuizzes.length === 0 ? (
                    <div className="mt-4 text-dark/70">
                      {quizzes.length === 0
                        ? "No quizzes yet. Create one on the left ✨"
                        : "No quizzes match your search."}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {filteredQuizzes.map((q) => (
                        <div
                          key={q.quizid}
                          className="rounded-2xl border border-white/40 bg-white/65 backdrop-blur p-5 shadow-sm hover:bg-white/75 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <Link
                                className="text-lg font-semibold text-dark hover:opacity-80 truncate block"
                                to={`/project/${projectid}/quizzes/${q.quizid}`}
                              >
                                {q.title}
                              </Link>
                              <div className="mt-1 text-sm text-dark/70 line-clamp-2">
                                {q.topic}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge
                                  label={QUIZ_TYPE_LABELS[q.quiz_type] || q.quiz_type}
                                  title="Quiz type"
                                  tone="warm"
                                />
                                <Badge
                                  label={`${q.num_questions} questions`}
                                  title="Question count"
                                />
                                <Badge
                                  label={QUIZ_STATUS_LABELS[q.status] || q.status || "Ready"}
                                  title="Status"
                                  tone={
                                    q.status === "failed"
                                      ? "danger"
                                      : q.status === "pending"
                                      ? "warm"
                                      : "strong"
                                  }
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
