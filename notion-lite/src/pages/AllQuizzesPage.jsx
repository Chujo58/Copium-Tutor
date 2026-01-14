import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

const QUIZ_TYPE_LABELS = {
  mcq: "QCM (Multiple choice)",
  short: "Short answer",
  long: "Long answer",
};

const STATUS_LABELS = {
  pending: "Generating",
  ready: "Ready",
  failed: "Failed",
};

export default function AllQuizzesPage() {
  const [projects, setProjects] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/projects`, {
          credentials: "include",
          method: "GET",
        });
        const data = await res.json();
        setProjects(data.success ? data.projects || [] : []);
      } catch (e) {
        console.error(e);
        setProjects([]);
      }
    };

    const fetchQuizzes = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/quizzes`, {
          credentials: "include",
        });
        const data = await res.json();
        setQuizzes(data.success ? data.quizzes || [] : []);
      } catch (e) {
        console.error(e);
        setQuizzes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
    fetchQuizzes();
  }, []);

  const filteredQuizzes = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return quizzes;
    return quizzes.filter((quiz) => {
      const hay = `${quiz.title || ""} ${quiz.topic || ""} ${quiz.project_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [quizzes, query]);

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
        <div className="text-3xl main-header font-sans text-dark">
          All Quizzes
        </div>
        <div className="mt-2 text-sm opacity-60">
          Browse quizzes across all courses.
        </div>

        <div className="mt-6 flex items-center gap-2 max-w-xl">
          <input
            className="border p-2 w-full"
            placeholder="Search quizzes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={loading}
          />
          <button
            className="border px-3 py-2"
            onClick={() => setQuery("")}
            disabled={loading || !query}
          >
            Clear
          </button>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="opacity-70">Loading quizzes…</div>
          ) : filteredQuizzes.length === 0 ? (
            <div className="opacity-70">No quizzes yet.</div>
          ) : (
            <ul className="space-y-3">
              {filteredQuizzes.map((quiz) => (
                <li key={quiz.quizid} className="border bg-white/70 rounded p-4">
                  <Link
                    className="text-lg font-semibold underline"
                    to={`/project/${quiz.projectid}/quizzes/${quiz.quizid}`}
                  >
                    {quiz.title}
                  </Link>
                  <div className="text-sm opacity-70">{quiz.project_name}</div>
                  <div className="text-sm opacity-70 mt-1">
                    {QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type} ·{" "}
                    {quiz.num_questions} questions ·{" "}
                    {STATUS_LABELS[quiz.status] || quiz.status || "Ready"}
                  </div>
                  {quiz.topic ? (
                    <div className="text-sm opacity-80 mt-2">{quiz.topic}</div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
