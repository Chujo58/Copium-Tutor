import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

const QUIZ_TYPE_LABELS = {
  mcq: "QCM (Multiple choice)",
  short: "Short answer",
  long: "Long answer",
};

export default function QuizPage() {
  const { projectid, quizId } = useParams();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [result, setResult] = useState(null);

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

  const fetchQuiz = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/quizzes/${quizId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setQuiz(data.quiz);
        setQuestions(data.questions?.questions || []);
        setAnswers({});
        setResult(null);
      } else {
        setQuiz(null);
        setQuestions([]);
      }
    } catch (e) {
      console.error(e);
      setQuiz(null);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    fetchProjectsAndCourse();
    fetchQuiz();
  }, [fetchProjectsAndCourse, fetchQuiz]);

  useEffect(() => {
    if (!quiz || quiz.status !== "pending") return;
    const interval = setInterval(() => {
      fetchQuiz();
    }, 5000);
    return () => clearInterval(interval);
  }, [quiz, fetchQuiz]);

  const total = questions.length;
  const quizReady = total > 0 && (quiz?.status === "ready" || !quiz?.status);

  const updateAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const submitQuiz = async () => {
    if (!quiz) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/quizzes/${quizId}/submit`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to submit quiz");
        return;
      }
      setResult(data);
    } catch (e) {
      console.error(e);
      alert("Error submitting quiz");
    } finally {
      setSubmitting(false);
    }
  };

  const regenerateQuiz = async () => {
    if (!quiz) return;
    setRegenerating(true);
    try {
      const res = await fetch(`${API_URL}/quizzes/${quizId}/generate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to regenerate quiz");
        return;
      }
      await fetchQuiz();
    } catch (e) {
      console.error(e);
      alert("Error regenerating quiz");
    } finally {
      setRegenerating(false);
    }
  };

  const resetAttempt = () => {
    setAnswers({});
    setResult(null);
  };

  const feedbackFor = (qid) => {
    if (!result?.feedback) return null;
    return result.feedback[qid] || null;
  };

  const choiceLabel = (q, idx) => {
    if (!q?.choices || idx == null) return "—";
    const parsed = Number(idx);
    if (!Number.isFinite(parsed)) return "—";
    return q.choices[parsed] || "—";
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
        <Link to={`/project/${projectid}/quizzes`} className="underline">
          ← Back to Quizzes
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
        ) : loading ? (
          <div className="mt-6 opacity-70">Loading quiz…</div>
        ) : !quiz ? (
          <div className="mt-6">Quiz not found.</div>
        ) : (
          <>
            <div className="mt-4">
              <div className="text-3xl main-header font-sans text-dark">
                {quiz.title}
              </div>
              <div className="opacity-70">{quiz.topic}</div>
              <div className="mt-2 text-sm opacity-60">
                {course.name} · {QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}
              </div>
            </div>

            {!quizReady ? (
              <div className="mt-6 space-y-3">
                {quiz?.status === "failed" ? (
                  <div className="text-red-700">
                    Generation failed: {quiz.generation_error || "Unknown error"}
                  </div>
                ) : (
                  <div className="opacity-70">
                    {quiz?.generation_error
                      ? quiz.generation_error
                      : "Generating quiz questions… This can take a few minutes."}
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <button
                    className="border px-3 py-2"
                    onClick={fetchQuiz}
                    disabled={regenerating}
                  >
                    Refresh
                  </button>
                  <button
                    className="border px-3 py-2"
                    onClick={regenerateQuiz}
                    disabled={regenerating}
                  >
                    {regenerating ? "Retrying…" : "Retry generation"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <div className="opacity-70">
                    {result ? `Score: ${result.score} / ${total}` : `Questions: ${total}`}
                  </div>
                  {result ? (
                    <button className="border px-3 py-2" onClick={resetAttempt}>
                      Redo quiz
                    </button>
                  ) : null}
                </div>

                <div className="mt-6 space-y-6">
                  {questions.map((q, idx) => {
                    const feedback = feedbackFor(q.id);
                    const isMcq = quiz.quiz_type === "mcq";
                    return (
                      <div key={q.id} className="border bg-white rounded p-4">
                        <div className="font-semibold">
                          {idx + 1}. {q.question}
                        </div>

                        {isMcq ? (
                          <div className="mt-3 space-y-2">
                            {(q.choices || []).map((choice, cidx) => (
                              <label key={cidx} className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name={`q-${q.id}`}
                                  checked={answers[q.id] === cidx}
                                  onChange={() => updateAnswer(q.id, cidx)}
                                  disabled={submitting || !!result}
                                />
                                <span>{choice}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <textarea
                            className="mt-3 border p-2 w-full"
                            rows={quiz.quiz_type === "long" ? 5 : 3}
                            placeholder="Write your answer here"
                            value={answers[q.id] || ""}
                            onChange={(e) => updateAnswer(q.id, e.target.value)}
                            disabled={submitting || !!result}
                          />
                        )}

                        {feedback ? (
                          <div className="mt-3 text-sm">
                            <div className={feedback.correct ? "text-green-700" : "text-red-700"}>
                              {feedback.correct ? "Correct" : "Incorrect"}
                            </div>
                            <div className="opacity-80">
                              Expected:{" "}
                              {isMcq
                                ? choiceLabel(q, feedback.expected)
                                : feedback.expected || "—"}
                            </div>
                            <div className="opacity-80">
                              Your answer:{" "}
                              {isMcq
                                ? choiceLabel(q, feedback.response)
                                : feedback.response || "—"}
                            </div>
                            {feedback.explanation ? (
                              <div className="mt-1 opacity-70">
                                Feedback: {feedback.explanation}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 flex items-center gap-3">
                  <button
                    className="border px-3 py-2"
                    onClick={submitQuiz}
                    disabled={submitting || !!result}
                  >
                    {submitting ? "Submitting…" : "Submit quiz"}
                  </button>

                  <Link to={`/project/${projectid}/quizzes`} className="underline">
                    Back to quizzes
                  </Link>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
