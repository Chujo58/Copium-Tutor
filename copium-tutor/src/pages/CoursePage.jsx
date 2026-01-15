import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import CourseDocumentUploader from "../components/CourseDocumentUploader";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder, MessageSquare, Layers, FileText, Trash2 } from "lucide-react";
import { BlockWithDivider, PlumDivider } from "../components/Divider";
import { DocumentCard } from "../components/Card";
import AskBar from "../components/AskBar";
import { ChatAPI } from "../services/chat";
import { RefreshButton, OpenButton, IndexButton } from "../components/Button";

const QUIZ_TYPE_LABELS = {
  mcq: "QCM (Multiple choice)",
  short: "Short answer",
  long: "Long answer",
};

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function CoursePage() {
  const { projectid } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [creatingChat, setCreatingChat] = useState(false);

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  const [files, setFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  const [indexing, setIndexing] = useState(false);
  const [indexResult, setIndexResult] = useState(null);
  const [indexError, setIndexError] = useState("");

  const [recentDecks, setRecentDecks] = useState([]);
  const [recentDecksLoading, setRecentDecksLoading] = useState(false);
  const [recentDecksError, setRecentDecksError] = useState("");

  // Recent chats (course page)
  const [recentChats, setRecentChats] = useState([]);
  const [recentChatsLoading, setRecentChatsLoading] = useState(false);
  const [recentChatsError, setRecentChatsError] = useState("");

  useEffect(() => {
    console.log("[CoursePage] mounted", { projectid, path: location.pathname });
  }, [projectid, location.pathname]);

  const startChatFromQuestion = useCallback(
    async (question) => {
      const text = (question || "").trim();
      if (!text) return;
      if (creatingChat) return;

      setCreatingChat(true);
      try {
        // IMPORTANT: create placeholder title; backend will auto-title on first message
        const created = await ChatAPI.createChat(projectid, {
          title: "New chat",
          llm_provider: "openai",
          model_name: "gpt-4o",
        });

        if (!created?.success) return;

        const chatid = created.chat?.chatid;
        if (!chatid) return;

        navigate(`/project/${projectid}/chat/${chatid}`, { state: { firstMessage: text } });
      } catch (e) {
        console.error("[CoursePage] startChatFromQuestion error:", e);
      } finally {
        setCreatingChat(false);
      }
    },
    [projectid, navigate, creatingChat]
  );

  const fetchRecentDecks = useCallback(async () => {
    setRecentDecksLoading(true);
    setRecentDecksError("");
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/decks`, {
        method: "GET",
        credentials: "include",
      });
      const data = await res.json();

      if (!data?.success) {
        setRecentDecks([]);
        setRecentDecksError(data?.message || "Failed to load decks");
        return;
      }

      const decks = data.decks || [];
      setRecentDecks(decks.slice(0, 6));
    } catch (e) {
      console.error("[CoursePage] fetchRecentDecks error:", e);
      setRecentDecks([]);
      setRecentDecksError("Failed to load decks (network/server)");
    } finally {
      setRecentDecksLoading(false);
    }
  }, [projectid]);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/files`, {
        credentials: "include",
        method: "GET",
      });
      const data = await res.json();
      if (data.success) setFiles(data.files || []);
      else setFiles([]);
    } catch (err) {
      console.error("[CoursePage] fetchFiles error:", err);
      setFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [projectid]);

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
        const found = (data.projects || []).find((p) => p.projectid === projectid);
        setCourse(found ?? null);
      } else {
        setProjects([]);
        setCourse(null);
      }
    } catch (err) {
      console.error("[CoursePage] fetchProjectsAndCourse error:", err);
      setProjects([]);
      setCourse(null);
    } finally {
      setLoading(false);
    }
  }, [projectid]);

  const fetchRecentChats = useCallback(async () => {
    setRecentChatsLoading(true);
    setRecentChatsError("");
    try {
      const resp = await ChatAPI.listChats(projectid);

      if (!resp?.success) {
        setRecentChats([]);
        setRecentChatsError(resp?.message || "Failed to load chats");
        return;
      }

      setRecentChats((resp.chats || []).slice(0, 5));
    } catch (e) {
      console.error("[CoursePage] fetchRecentChats error:", e);
      setRecentChats([]);
      setRecentChatsError("Failed to load chats (network/server)");
    } finally {
      setRecentChatsLoading(false);
    }
  }, [projectid]);

  const deleteRecentChat = useCallback(
    async (chatid) => {
      try {
        await ChatAPI.deleteChat(chatid);
        await fetchRecentChats();
      } catch (e) {
        console.error("[CoursePage] deleteRecentChat failed:", e);
      }
    },
    [fetchRecentChats]
  );

  const fetchQuizzes = useCallback(async () => {
    setQuizzesLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/quizzes`, {
        credentials: "include",
        method: "GET",
      });
      const data = await res.json();
      if (data.success) setQuizzes(data.quizzes || []);
      else setQuizzes([]);
    } catch (err) {
      console.error(err);
      setQuizzes([]);
    } finally {
      setQuizzesLoading(false);
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
        console.error("[CoursePage] indexDocuments error:", e);
        setIndexError("Indexing failed (network/server error)");
      } finally {
        setIndexing(false);
      }
    },
    [projectid]
  );

  useEffect(() => {
    fetchProjectsAndCourse();
    fetchFiles();
    fetchQuizzes();
    fetchRecentChats();
    fetchRecentDecks();
  }, [projectid, fetchProjectsAndCourse, fetchFiles, fetchRecentChats, fetchRecentDecks, fetchQuizzes]);

  const projectsList = useMemo(() => {
    return projects.map((project) => ({
      name: project.name,
      href: `/project/${project.projectid}`,
    }));
  }, [projects]);

  const displayName = (filepath) => {
    const base = filepath.split("/").pop() || filepath;
    const idx = base.indexOf("_");
    return idx >= 0 ? base.slice(idx + 1) : base;
  };

  const quizStatusLabel = (status) => {
    if (!status) return "Ready";
    if (status === "pending") return "Generating";
    if (status === "failed") return "Failed";
    return status;
  };

  const uploadedCount =
    (indexResult?.uploaded_documents || 0) + (indexResult?.uploaded_split_documents || 0);

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
            icon: project.icon in Icons && project.icon !== null ? Icons[project.icon] : Folder,
            color: project.color !== null ? project.color : "#754B4D",
          })),
        ]}
      />

      <div className="flex-1 overflow-auto bg-rose-china h-screen">
        {loading ? (
          <div className="p-10">Loading course…</div>
        ) : !course ? (
          <div className="p-10">
            <div className="text-2xl font-semibold">Course not found</div>
            <div className="opacity-70">(Either the course doesn’t exist, or you’re not logged in.)</div>
          </div>
        ) : (
          <div className="p-8 md:p-10">
            {/* Title */}
            <div className="inline-block">
              <div className="text-3xl main-header font-card text-dark">{course.name}</div>
              <PlumDivider />
            </div>

            {/* Description */}
            {course.description ? (
              <div className="mt-2 block">
                <div className="inline-block">
                  <BlockWithDivider color="border-rose-plum">
                    <div className="p-1 whitespace-nowrap">{course.description}</div>
                  </BlockWithDivider>
                </div>
              </div>
            ) : null}

            <div className="mt-2 text-sm opacity-60">projectid: {course.projectid} (debug)</div>

            {/* Ask bar */}
            <div className="mt-8">
              <div className="mx-auto max-w-3xl">
                <div className="text-center text-lg font-semibold text-dark font-card">Stuck? Have some copium :)</div>
                <div className="mt-3">
                  <AskBar
                    placeholder={creatingChat ? "Starting chat…" : "Ask anything about assignments, concepts, or practice problems…"}
                    disabled={creatingChat}
                    onSubmit={(text) => startChatFromQuestion(text)}
                  />
                </div>
                <div className="mt-2 text-center text-xs opacity-60 font-card">
                  Tip: paste the problem statement + what you tried + where you’re stuck.
                </div>
              </div>
            </div>

            {/* Recent chats */}
            <div className="mt-8 mx-auto max-w-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-dark font-semibold font-card">
                  <MessageSquare size={18} className="opacity-70" />
                  Recent chats
                </div>

                <RefreshButton
                  onClick={fetchRecentChats}
                  loading={recentChatsLoading}
                  disabled={recentChatsLoading}
                />                
              </div>

              {recentChatsError ? <div className="mt-2 text-sm opacity-80">⚠️ {recentChatsError}</div> : null}

              {recentChatsLoading ? (
                <div className="mt-3 opacity-70">Loading chats…</div>
              ) : recentChats.length === 0 ? (
                <div className="mt-3 opacity-70">No chats yet — ask your first question above.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {recentChats.map((c) => (
                    <div
                      key={c.chatid}
                      className="group rounded-2xl border border-black/10 bg-white/40 hover:bg-white/55 transition px-4 py-3 flex items-start justify-between gap-3"
                    >
                      <Link
                        to={`/project/${projectid}/chat/${c.chatid}`}
                        className="min-w-0 flex-1"
                        onClick={() => console.log("[CoursePage] open recent chat", c.chatid)}
                      >
                        <div className="font-semibold text-dark truncate">{c.title}</div>
                        <div className="text-xs opacity-60 mt-1 truncate">
                          {c.model_name} • {formatWhen(c.updated_at)}
                        </div>
                      </Link>

                      <button
                        type="button"
                        className="shrink-0 rounded-xl border border-black/10 bg-white/50 p-2 text-[#754B4D] hover:bg-white transition
                                  opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          deleteRecentChat(c.chatid);
                        }}
                        title="Delete chat"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}

                  <div className="pt-1">
                    <Link to={`/project/${projectid}/chat/${recentChats[0].chatid}`} className="text-sm underline opacity-80">
                      See all (opens chat history)
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Main grid */}
            <div className="mt-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* LEFT */}
              <div className="lg:col-span-8 space-y-6">
                {/* Flashcards */}
                <div className="rounded-3xl border border-black/10 bg-white/35 shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-dark font-semibold text-xl font-card">
                      <Layers size={20} className="opacity-70" />
                      Flashcards
                    </div>
                    <OpenButton
                      onClick={() => navigate(`/project/${projectid}/flashcards`)}
                    />
                    {/* <Link
                      className="rounded-xl bg-white/30 px-3 py-1.5 text-sm text-dark border border-black/10 hover:bg-white/40"
                      to={`/project/${projectid}/flashcards`}
                    >
                      Open
                    </Link> */}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm opacity-70">Recent decks</div>
                      <RefreshButton
                        onClick={fetchRecentDecks}
                        loading={recentDecksLoading}
                        disabled={recentDecksLoading}
                      />
                    </div>

                    {recentDecksError ? <div className="mt-2 text-sm opacity-80">⚠️ {recentDecksError}</div> : null}

                    {recentDecksLoading ? (
                      <div className="mt-3 opacity-70">Loading decks…</div>
                    ) : recentDecks.length === 0 ? (
                      <div className="mt-3 opacity-70">No decks yet — create one in Flashcards.</div>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {recentDecks.map((d) => (
                          <Link
                            key={d.deckid}
                            to={`/project/${projectid}/flashcards/${d.deckid}`}
                            className="rounded-2xl border border-black/10 bg-white/40 p-4 hover:bg-white/55 transition"
                          >
                            <div className="font-semibold text-dark truncate">{d.name}</div>
                            <div className="text-xs opacity-60 mt-1 truncate">
                              {d.card_count != null ? `${d.card_count} cards` : "Deck"}{" "}
                              {d.createddate ? `• ${formatWhen(d.createddate)}` : ""}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Quizzes */}
                <div className="rounded-3xl border border-black/10 bg-white/35 shadow-sm p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-dark font-semibold text-xl font-card">
                      <FileText size={20} className="opacity-70" />
                      Quizzes
                    </div>
                    <OpenButton
                      onClick={() => navigate(`/project/${projectid}/quizzes`)}
                    />
                    {/* <Link
                      className="rounded-xl bg-white/30 px-3 py-1.5 text-sm text-dark border border-black/10 hover:bg-white/40"
                      to={`/project/${projectid}/quizzes`}
                    >
                      Open
                    </Link> */}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm opacity-70">Recent quizzes</div>
                      <RefreshButton
                        onClick={fetchQuizzes}
                        loading={quizzesLoading}
                        disabled={quizzesLoading}
                      />
                    </div>

                    {quizzesLoading ? (
                      <div className="mt-3 opacity-70">Loading quizzes…</div>
                    ) : quizzes.length === 0 ? (
                      <div className="mt-3 opacity-70">No quizzes yet — create one in Quizzes.</div>
                    ) : (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {quizzes.slice(0, 6).map((q) => (
                          <Link
                            key={q.quizid}
                            to={`/project/${projectid}/quizzes/${q.quizid}`}
                            className="rounded-2xl border border-black/10 bg-white/40 p-4 hover:bg-white/55 transition"
                          >
                            <div className="font-semibold text-dark truncate">{q.title}</div>
                            <div className="text-xs opacity-60 mt-1 truncate">
                              {QUIZ_TYPE_LABELS[q.quiz_type] || q.quiz_type}{" "}
                              {q.num_questions ? `• ${q.num_questions} questions` : ""}{" "}
                              {q.status ? `• ${quizStatusLabel(q.status)}` : ""}
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT: Documents */}
              <div className="lg:col-span-4">
                <div className="rounded-3xl border border-black/10 bg-white/45 shadow-sm p-6">
                  <div className="flex items-center justify-between font-card">
                    <div className="text-dark font-semibold text-xl">Documents</div>
                    <div className="text-xs opacity-60">{files.length} file(s)</div>
                  </div>

                  <div className="mt-3">
                    <CourseDocumentUploader
                      projectName={course.name}
                      projectID={course.projectid}
                      onUploaded={async () => {
                        await fetchFiles();
                        setIndexResult(null);
                        setIndexError("");
                        fetchRecentChats();
                      }}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <RefreshButton onClick={fetchFiles} loading={filesLoading} disabled={filesLoading} />
                    {/* <button
                      className="rounded-xl bg-white/30 px-3 py-1.5 text-sm text-dark border border-black/10 hover:bg-white/40"
                      onClick={fetchFiles}
                      disabled={filesLoading}
                    >
                      {filesLoading ? "Refreshing…" : "Refresh"}
                    </button> */}

                    <IndexButton onClick={() => indexDocuments({ force: false })} indexing={indexing} disabled={indexing || files.length === 0 || alreadyIndexed} />

                    {/* <button
                      className="rounded-xl bg-white/30 px-3 py-1.5 text-sm text-dark border border-black/10 hover:bg-white/40 disabled:opacity-50"
                      onClick={() => indexDocuments({ force: false })}
                      disabled={indexing || files.length === 0 || alreadyIndexed}
                      title={files.length === 0 ? "Upload documents first" : alreadyIndexed ? "Already indexed" : ""}
                    >
                      {alreadyIndexed ? "Indexed ✓" : indexing ? "Indexing…" : "Index"}
                    </button> */}

                    <button
                      className="rounded-xl bg-white/20 px-3 py-1.5 text-sm text-dark border border-black/10 hover:bg-white/30 disabled:opacity-50"
                      onClick={() => indexDocuments({ force: true })}
                      disabled={indexing || files.length === 0}
                      title="Re-upload/index documents (use only if you changed files but kept same names)"
                    >
                      Force
                    </button>
                  </div>

                  {indexError ? <div className="mt-2 text-sm opacity-80">⚠️ {indexError}</div> : null}

                  {indexResult ? (
                    <div className="mt-2 text-xs opacity-70">
                      ✅ uploaded: {indexResult.uploaded_documents || 0}, split:{" "}
                      {indexResult.uploaded_split_documents || 0}
                      {typeof indexResult.skipped_files === "number" ? `, skipped: ${indexResult.skipped_files}` : ""}
                      {typeof indexResult.failed_files === "number" ? `, failed: ${indexResult.failed_files}` : ""}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    {filesLoading ? (
                      <div className="opacity-70">Loading files…</div>
                    ) : files.length === 0 ? (
                      <div className="opacity-70">No documents yet.</div>
                    ) : (
                      <ul className="space-y-2">
                        {files.map((f) => (
                          <DocumentCard
                            key={f.fileid}
                            docTitle={displayName(f.filepath)}
                            docType={f.file_type}
                            id={f.fileid}
                            onDeleted={() => {
                              fetchFiles();
                              setIndexResult(null);
                              setIndexError("");
                            }}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="h-10" />
          </div>
        )}
      </div>
    </div>
  );
}
