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

const displayName = (filepath) => {
  const base = filepath.split("/").pop() || filepath;
  const idx = base.indexOf("_");
  return idx >= 0 ? base.slice(idx + 1) : base;
};

export default function QuizzesHomePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(true);

  const [topic, setTopic] = useState("");
  const [quizType, setQuizType] = useState("mcq");
  const [numQuestions, setNumQuestions] = useState(10);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [selectionReady, setSelectionReady] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectionStorageKey = useMemo(
    () => `quiz-file-selection-${projectId}`,
    [projectId]
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
        const found = (data.projects || []).find((p) => p.projectid === projectId);
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
  }, [projectId]);

  const fetchQuizzes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/quizzes`, {
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
  }, [projectId]);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/files`, {
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
  }, [projectId]);

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
    if (!projectId) return;
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
  }, [projectId, selectionStorageKey]);

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

  const selectedFileIds = useMemo(
    () =>
      Object.entries(selectedFiles)
        .filter(([, checked]) => checked)
        .map(([fileid]) => fileid),
    [selectedFiles]
  );

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
      const res = await fetch(`${API_URL}/projects/${projectId}/quizzes`, {
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
      setTopic("");
      await fetchQuizzes();
      navigate(`/project/${projectId}/quizzes/${data.quizid}`);
    } catch (e) {
      console.error(e);
      alert("Error creating quiz");
    } finally {
      setCreating(false);
    }
  };

  const deleteQuiz = async (quizid) => {
    if (!confirm("Delete this quiz? This will delete its attempts.")) return;

    try {
      const res = await fetch(`${API_URL}/quizzes/${quizid}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to delete quiz");
        return;
      }
      fetchQuizzes();
    } catch (e) {
      console.error(e);
      alert("Error deleting quiz");
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

      <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
        <Link to={`/project/${projectId}`} className="underline">
          ← Back to Course
        </Link>

        {courseLoading ? (
          <div className="mt-6">Loading…</div>
        ) : !course ? (
          <div className="mt-6">
            <div className="text-2xl font-semibold">Course not found</div>
            <div className="opacity-70">
              (Either it doesn’t exist, or you’re not logged in.)
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="text-3xl main-header font-sans text-dark">
                Quizzes
              </div>
              <div className="opacity-70">{course.name}</div>
              <div className="mt-2 text-sm opacity-60">
                projectId: {projectId}
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Create a quiz</h2>

              <div className="mt-3 flex flex-col gap-3 max-w-2xl">
                <input
                  className="border p-2"
                  placeholder="Quiz topic (e.g., Module 2 review)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  disabled={creating}
                />

                <div className="flex flex-wrap gap-3">
                  <label className="flex flex-col text-sm gap-1">
                    Type
                    <select
                      className="border p-2"
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

                  <label className="flex flex-col text-sm gap-1">
                    Number of questions
                    <input
                      type="number"
                      className="border p-2 w-40"
                      min={1}
                      max={50}
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(e.target.value)}
                      disabled={creating}
                    />
                  </label>
                </div>

                <div className="border rounded p-3 bg-white/60">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">Use these documents</div>
                    <div className="flex items-center gap-3 text-sm">
                      <button
                        className="underline opacity-80"
                        onClick={selectAll}
                        disabled={creating || files.length === 0}
                      >
                        Select all
                      </button>
                      <button
                        className="underline opacity-80"
                        onClick={clearAll}
                        disabled={creating || files.length === 0}
                      >
                        Clear
                      </button>
                      <button
                        className="underline opacity-80"
                        onClick={fetchFiles}
                        disabled={creating || filesLoading}
                      >
                        {filesLoading ? "Refreshing…" : "Refresh"}
                      </button>
                    </div>
                  </div>

                  {course ? (
                    <CourseDocumentUploader
                      projectName={course.name}
                      onUploaded={fetchFiles}
                    />
                  ) : null}

                  {filesLoading ? (
                    <div className="mt-2 opacity-70">Loading files…</div>
                  ) : files.length === 0 ? (
                    <div className="mt-2 opacity-70">No documents yet.</div>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {files.map((f) => (
                        <li key={f.fileid} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!selectedFiles[f.fileid]}
                            onChange={() => toggleFile(f.fileid)}
                            disabled={creating}
                          />
                          <span>{displayName(f.filepath)}</span>
                          <span className="text-xs opacity-60">
                            ({f.file_type || "file"})
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <button
                  className="border px-3 py-2 w-fit"
                  onClick={createQuiz}
                  disabled={creating}
                >
                  {creating ? "Creating…" : "Create quiz"}
                </button>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Your quizzes</h2>

              {loading ? (
                <div className="mt-2 opacity-70">Loading…</div>
              ) : quizzes.length === 0 ? (
                <div className="mt-2 opacity-70">No quizzes yet.</div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {quizzes.map((q) => (
                    <li
                      key={q.quizid}
                      className="flex items-start justify-between gap-4"
                    >
                      <div>
                        <Link
                          className="underline"
                          to={`/project/${projectId}/quizzes/${q.quizid}`}
                        >
                          {q.title}
                        </Link>
                        <div className="text-sm opacity-70">
                          {QUIZ_TYPE_LABELS[q.quiz_type] || q.quiz_type} ·{" "}
                          {q.num_questions} questions ·{" "}
                          {QUIZ_STATUS_LABELS[q.status] || q.status || "Ready"}
                        </div>
                      </div>
                      <button
                        className="text-sm underline text-rose-plum"
                        onClick={() => deleteQuiz(q.quizid)}
                        type="button"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
