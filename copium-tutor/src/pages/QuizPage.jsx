import { useEffect, useMemo, useState, useCallback } from "react";
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

const QUIZ_STATUS_LABELS = {
  pending: "Generating",
  ready: "Ready",
  failed: "Failed",
};

function Badge({ label, title, tone = "neutral" }) {
  const toneClass =
    tone === "strong"
      ? "border-[#754B4D] text-white bg-dark/90"
      : tone === "warm"
      ? "border-[#D8A694] text-dark bg-[#D8A694]/20"
      : tone === "danger"
      ? "border-[#A86A65] text-dark bg-[#A86A65]/10"
      : "border-[#AB8882] text-dark bg-white/60";

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
      ? "border-[#754B4D]/30 bg-dark text-white hover:bg-dark/90"
      : variant === "danger"
      ? "border-[#A86A65]/40 bg-[#A86A65]/10 text-dark hover:bg-[#A86A65]/20"
      : "border-[#AB8882]/50 bg-white/70 text-dark hover:bg-white";

  return (
    <button className={`${base} ${cls}`} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

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
        setQuestions(data.questions || data.questions?.questions || []);
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

  const answeredCount = useMemo(() => {
    if (!quiz) return 0;
    return questions.reduce((count, q) => {
      const value = answers[q.id];
      if (quiz.quiz_type === "mcq") {
        return count + (value !== undefined && value !== null ? 1 : 0);
      }
      return count + (typeof value === "string" && value.trim().length > 0 ? 1 : 0);
    }, 0);
  }, [answers, questions, quiz]);
  const loadingGif = `${API_URL}/public/cat.gif`;
  const showGeneratingOverlay = !!quiz && !quizReady && quiz?.status !== "failed";

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
        {showGeneratingOverlay ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F6EFEA]/80 backdrop-blur">
            <div className="rounded-3xl border border-white/50 bg-white/80 px-8 py-7 shadow-lg text-center">
              <img
                src={loadingGif}
                alt="Generating quiz"
                className="mx-auto h-44 w-44 object-contain"
              />
              <div className="mt-3 text-dark font-semibold">
                Generating quiz…
              </div>
              <div className="text-sm text-dark/70">
                Hang tight, this can take a minute.
              </div>
            </div>
          </div>
        ) : null}
        <div className="p-10">
          <Link
            to={`/project/${projectid}/quizzes`}
            className="inline-flex items-center gap-2 text-dark hover:opacity-80"
          >
            <span className="px-2 py-1 rounded-lg border border-[#E0CBB9] bg-white/50">←</span>
            Back to Quizzes
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
          ) : loading ? (
            <div className="mt-8 text-dark/70">Loading quiz…</div>
          ) : !quiz ? (
            <div className="mt-8 text-dark/70">Quiz not found.</div>
          ) : (
            <>
              <div className="mt-6 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="text-3xl font-semibold text-dark">
                      {quiz.title}
                    </div>
                    <div className="mt-1 text-dark/70">{quiz.topic}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge label={course.name} title="Course" />
                      <Badge
                        label={QUIZ_TYPE_LABELS[quiz.quiz_type] || quiz.quiz_type}
                        title="Quiz type"
                        tone="warm"
                      />
                      <Badge
                        label={QUIZ_STATUS_LABELS[quiz.status] || quiz.status || "Ready"}
                        title="Quiz status"
                        tone={
                          quiz.status === "failed"
                            ? "danger"
                            : quiz.status === "pending"
                            ? "warm"
                            : "strong"
                        }
                      />
                    </div>
                  </div>

                  <div className="text-right text-sm text-dark/70">
                    {result ? (
                      <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-dark/60">
                          Latest score
                        </div>
                        <div className="text-2xl font-semibold text-dark">
                          {result.score} / {total}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
                        <div className="text-xs uppercase tracking-wide text-dark/60">
                          Progress
                        </div>
                        <div className="text-base font-semibold text-dark">
                          {answeredCount} / {total} answered
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {!quizReady ? (
                <div className="mt-6 rounded-3xl border border-white/40 bg-white/60 backdrop-blur p-6 shadow-sm space-y-4">
                  {quiz?.status === "failed" ? (
                    <div className="text-[#A86A65] font-semibold">
                      Generation failed: {quiz.generation_error || "Unknown error"}
                    </div>
                  ) : (
                    <div className="text-dark/70">
                      {quiz?.generation_error
                        ? quiz.generation_error
                        : "Generating quiz questions… This can take a few minutes."}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <SoftButton onClick={fetchQuiz} disabled={regenerating}>
                      Refresh
                    </SoftButton>
                    <SoftButton
                      variant="danger"
                      onClick={regenerateQuiz}
                      disabled={regenerating}
                    >
                      {regenerating ? "Retrying…" : "Retry generation"}
                    </SoftButton>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    <Badge label={`${total} questions`} title="Total questions" />
                    <Badge label={`${answeredCount} answered`} title="Answered" />
                    {result ? (
                      <SoftButton variant="danger" onClick={resetAttempt}>
                        Redo quiz
                      </SoftButton>
                    ) : null}
                  </div>

                  <div className="mt-6 space-y-6">
                    {questions.map((q, idx) => {
                      const feedback = feedbackFor(q.id);
                      const isMcq = quiz.quiz_type === "mcq";
                      return (
                        <div
                          key={q.id}
                          className="rounded-3xl border border-white/40 bg-white/70 backdrop-blur p-6 shadow-sm"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-lg font-semibold text-dark">
                              {idx + 1}. {q.question}
                            </div>
                            {feedback ? (
                              <Badge
                                label={feedback.correct ? "Correct" : "Incorrect"}
                                tone={feedback.correct ? "strong" : "danger"}
                              />
                            ) : null}
                          </div>

                          {isMcq ? (
                            <div className="mt-4 space-y-2">
                              {(q.choices || []).map((choice, cidx) => {
                                const selected = answers[q.id] === cidx;
                                return (
                                  <label
                                    key={cidx}
                                    className={`flex items-start gap-3 rounded-xl border px-3 py-2 transition ${
                                      selected
                                        ? "border-[#754B4D]/40 bg-[#E0CBB9]/40"
                                        : "border-[#E0CBB9] bg-white/80 hover:bg-white"
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      name={`q-${q.id}`}
                                      className="mt-1 accent-[#754B4D]"
                                      checked={answers[q.id] === cidx}
                                      onChange={() => updateAnswer(q.id, cidx)}
                                      disabled={submitting || !!result}
                                    />
                                    <span className="text-dark">{choice}</span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <textarea
                              className="mt-4 w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-[#D8A694]/50"
                              rows={quiz.quiz_type === "long" ? 5 : 3}
                              placeholder="Write your answer here"
                              value={answers[q.id] || ""}
                              onChange={(e) => updateAnswer(q.id, e.target.value)}
                              disabled={submitting || !!result}
                            />
                          )}

                          {feedback ? (
                            <div className="mt-4 rounded-2xl border border-white/60 bg-white/70 p-4 text-sm text-dark">
                              <div className="font-semibold">
                                {feedback.correct ? "Correct" : "Incorrect"}
                              </div>
                              <div className="mt-1 text-dark/80">
                                Expected:{" "}
                                {isMcq
                                  ? choiceLabel(q, feedback.expected)
                                  : feedback.expected || "—"}
                              </div>
                              <div className="text-dark/80">
                                Your answer:{" "}
                                {isMcq
                                  ? choiceLabel(q, feedback.response)
                                  : feedback.response || "—"}
                              </div>
                              {feedback.explanation ? (
                                <div className="mt-2 text-dark/70">
                                  Feedback: {feedback.explanation}
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <SoftButton
                      variant="primary"
                      onClick={submitQuiz}
                      disabled={submitting || !!result}
                    >
                      {submitting ? "Submitting…" : "Submit quiz"}
                    </SoftButton>

                    <Link
                      to={`/project/${projectid}/quizzes`}
                      className="text-dark underline hover:opacity-80"
                    >
                      Back to quizzes
                    </Link>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
