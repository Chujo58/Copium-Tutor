import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import { Trash2 } from "lucide-react";
import AskBar from "../components/AskBar";
import { ChatAPI } from "../services/chat";
import { API_URL } from "../config";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Palette:
 * - Copper Rose: #A86A65
 * - Dusty Rose:  #AB8882
 * - Rosewater:   #D8A694
 * - China Doll:  #E0CBB9
 * - Plum Wine:   #754B4D
 */

const MODEL_OPTIONS = [
  { label: "GPT-4o (fast)", llm_provider: "openai", model_name: "gpt-4o" },
  { label: "GPT-4.1 (better reasoning)", llm_provider: "openai", model_name: "gpt-4.1" },
  { label: "o3-mini (reasoning)", llm_provider: "openai", model_name: "o3-mini" },
];

function fmtTime(iso) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString();
}

// --- Pretty markdown styles, tuned to match your typography/colors
function MarkdownNice({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-lg font-semibold text-[#754B4D] mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-semibold text-[#754B4D] mt-4 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-[#754B4D] mt-3 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-sm text-[#2b1b1c] leading-relaxed mb-2">{children}</p>,
        ul: ({ children }) => <ul className="list-disc pl-5 text-sm text-[#2b1b1c] space-y-1 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5 text-sm text-[#2b1b1c] space-y-1 mb-2">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-[#2b1b1c]">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ inline, children }) =>
          inline ? (
            <code className="rounded-md bg-black/5 px-1 py-0.5 text-[12px] text-[#2b1b1c]">
              {children}
            </code>
          ) : (
            <pre className="rounded-2xl bg-black/5 p-4 text-[12px] text-[#2b1b1c] overflow-x-auto border border-black/10">
              <code>{children}</code>
            </pre>
          ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 rounded-2xl border-l-4 border-[#754B4D]/40 bg-white/65 px-4 py-2">
            <div className="text-sm text-[#2b1b1c]/90">{children}</div>
          </blockquote>
        ),
      }}
    >
      {content || ""}
    </ReactMarkdown>
  );
}

function MessageBubble({ role, content, created_at }) {
  const isUser = role === "user";
  const shell = isUser ? "bg-[#D8A694]/25 border-white/40" : "bg-white/70 border-white/40";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={["max-w-[86%] rounded-3xl border backdrop-blur shadow-sm px-5 py-4", shell].join(" ")}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[#754B4D]/60">{isUser ? "You" : "Copium Tutor"}</div>
          {created_at ? <div className="text-[11px] text-[#754B4D]/45">{fmtTime(created_at)}</div> : null}
        </div>

        <div className="mt-2">
          {isUser ? (
            <div className="whitespace-pre-wrap text-sm text-[#2b1b1c] leading-relaxed">{content}</div>
          ) : (
            <MarkdownNice content={content} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function CourseChatPage() {
  const { projectid, chatid } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarChats, setSidebarChats] = useState([]);
  const [busy, setBusy] = useState(false);

  const [llmProvider, setLlmProvider] = useState("openai");
  const [modelName, setModelName] = useState("gpt-4o");

  const [courseName, setCourseName] = useState("");
  const [allCourses, setAllCourses] = useState([]);

  const bottomRef = useRef(null);
  const didAutoSendRef = useRef(false);

  const selectedKey = `${llmProvider}::${modelName}`;
  const firstMessage = location.state?.firstMessage;

  // ---- load projects list (for course switch + course name)
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/projects`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const courses = data.projects || [];
        setAllCourses(courses);

        const found = courses.find((p) => p.projectid === projectid);
        if (found?.name) setCourseName(found.name);
      } catch (e) {
        console.warn("[CourseChatPage] course fetch failed (non-blocking)", e);
      }
    })();
  }, [projectid]);

  // ---- sidebar chat list
  async function refreshSidebar(pid = projectid) {
    try {
      const list = await ChatAPI.listChats(pid);
      if (list?.success) setSidebarChats(list.chats || []);
    } catch (e) {
      console.error("[CourseChatPage] refreshSidebar error:", e);
    }
  }

  useEffect(() => {
    refreshSidebar(projectid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectid]);

  // ---- current chat + messages
  useEffect(() => {
    (async () => {
      const data = await ChatAPI.getChat(chatid);
      if (!data?.success) return;

      setChat(data.chat);
      setMessages(data.messages || []);
      setLlmProvider(data.chat.llm_provider || "openai");
      setModelName(data.chat.model_name || "gpt-4o");
    })().catch((err) => console.error("[CourseChatPage] getChat error:", err));
  }, [chatid]);

  // ---- autoscroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // ---- typewriter helper (GPT-like gradual reveal)
  async function typeOutAssistant(msgid, fullText) {
    const text = fullText || "";
    let i = 0;

    // adaptive step: longer answers move faster per tick
    const stepSize = Math.max(1, Math.floor(text.length / 420));
    const delayMs = 12;

    return new Promise((resolve) => {
      function step() {
        i = Math.min(text.length, i + stepSize);
        const slice = text.slice(0, i);

        setMessages((prev) => prev.map((m) => (m.msgid === msgid ? { ...m, content: slice } : m)));

        if (i >= text.length) return resolve();
        setTimeout(step, delayMs);
      }
      step();
    });
  }

  async function handleAsk(text) {
    const trimmed = (text || "").trim();
    if (!trimmed) return;

    setBusy(true);
    try {
      // optimistic user message
      const tempUser = {
        msgid: `temp-user-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, tempUser]);

      // optimistic assistant "Thinking..."
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      const tempAssistant = {
        msgid: tempAssistantId,
        role: "assistant",
        content: "Thinking…",
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, tempAssistant]);

      const resp = await ChatAPI.sendMessage(chatid, {
        content: trimmed,
        llm_provider: llmProvider,
        model_name: modelName,
      });

      if (!resp?.success) {
        // replace thinking with error
        setMessages((prev) =>
          prev.map((m) =>
            m.msgid === tempAssistantId
              ? { ...m, content: "⚠️ Failed to get response. Try again." }
              : m
          )
        );
        return;
      }

      // remove temps
      setMessages((prev) => prev.filter((x) => x.msgid !== tempUser.msgid && x.msgid !== tempAssistantId));

      const userMsg = (resp.messages || []).find((m) => m.role === "user");
      const assistantMsg = (resp.messages || []).find((m) => m.role === "assistant");

      // add real user
      if (userMsg) setMessages((prev) => [...prev, userMsg]);

      // add assistant placeholder then type out
      if (assistantMsg) {
        const full = assistantMsg.content || "";
        setMessages((prev) => [...prev, { ...assistantMsg, content: "" }]);
        await typeOutAssistant(assistantMsg.msgid, full);
      }

      // NEW: sync auto-generated title from backend
      if (resp.chat_title) {
        setChat((prev) => (prev ? { ...prev, title: resp.chat_title } : prev));
      }

      await refreshSidebar(projectid);
    } catch (e) {
      console.error("[CourseChatPage] handleAsk error:", e);
      setMessages((prev) => [
        ...prev,
        {
          msgid: `err-${Date.now()}`,
          role: "assistant",
          content: "⚠️ Network/server error. Try again.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  // ---- auto-send first message once
  useEffect(() => {
    if (!firstMessage) return;
    if (didAutoSendRef.current) return;
    if (!chatid) return;

    didAutoSendRef.current = true;
    handleAsk(firstMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMessage, chatid]);

  async function handleNewChat() {
    try {
      const created = await ChatAPI.createChat(projectid, {
        title: "New chat",
        llm_provider: llmProvider,
        model_name: modelName,
      });

      if (created?.success) {
        nav(`/project/${projectid}/chat/${created.chat.chatid}`);
      }
    } catch (e) {
      console.error("[CourseChatPage] handleNewChat error:", e);
    }
  }

  async function handleDeleteChat(targetChatid) {
    if (!targetChatid) return;

    try {
      await ChatAPI.deleteChat(targetChatid);

      // if deleted current chat, go to next available or back to course
      if (targetChatid === chatid) {
        const list = await ChatAPI.listChats(projectid);
        const remaining = (list?.chats || []).filter((c) => c.chatid !== targetChatid);
        if (remaining.length > 0) {
          nav(`/project/${projectid}/chat/${remaining[0].chatid}`);
        } else {
          nav(`/project/${projectid}`);
        }
        return;
      }

      await refreshSidebar(projectid);
    } catch (e) {
      console.error("[CourseChatPage] delete chat failed:", e);
    }
  }

  async function handleSwitchCourse(nextProjectid) {
    if (!nextProjectid || nextProjectid === projectid) return;

    try {
      const list = await ChatAPI.listChats(nextProjectid);
      const chats = list?.chats || [];

      if (chats.length > 0) {
        nav(`/project/${nextProjectid}/chat/${chats[0].chatid}`);
        return;
      }

      // create a new chat if none exist
      const created = await ChatAPI.createChat(nextProjectid, {
        title: "New chat",
        llm_provider: llmProvider,
        model_name: modelName,
      });

      if (created?.success) {
        nav(`/project/${nextProjectid}/chat/${created.chat.chatid}`);
      } else {
        nav(`/project/${nextProjectid}`);
      }
    } catch (e) {
      console.error("[CourseChatPage] switch course failed:", e);
      nav(`/project/${nextProjectid}`);
    }
  }

  return (
    <div className="h-screen w-full">
      <div className="flex h-full bg-gradient-to-b from-[#F6EFEA] via-[#E0CBB9]/35 to-[#F6EFEA]">
        {/* Sidebar */}
        <aside className="w-[320px] shrink-0 border-r border-white/40 bg-white/35 backdrop-blur">
          <div className="px-4 py-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[#754B4D]">Chats</div>
              <button
                onClick={handleNewChat}
                className="rounded-xl border border-[#AB8882]/50 bg-white/70 px-3 py-1.5 text-xs text-[#754B4D] hover:bg-white transition"
                type="button"
              >
                + New
              </button>
            </div>

            {/* Course switch */}
            <div className="mt-4">
              <label className="text-xs text-[#754B4D]/60">Course</label>
              <select
                value={projectid}
                onChange={(e) => handleSwitchCourse(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 text-sm text-[#2b1b1c] outline-none focus:ring-2 focus:ring-[#D8A694]/50"
              >
                {allCourses.map((c) => (
                  <option key={c.projectid} value={c.projectid}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Model */}
            <div className="mt-4">
              <label className="text-xs text-[#754B4D]/60">Model</label>
              <select
                value={selectedKey}
                onChange={(e) => {
                  const [p, m] = e.target.value.split("::");
                  setLlmProvider(p);
                  setModelName(m);
                }}
                className="mt-1 w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 text-sm text-[#2b1b1c] outline-none focus:ring-2 focus:ring-[#D8A694]/50"
              >
                {MODEL_OPTIONS.map((opt) => (
                  <option
                    key={`${opt.llm_provider}::${opt.model_name}`}
                    value={`${opt.llm_provider}::${opt.model_name}`}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
              <div className="mt-2 text-[11px] text-[#754B4D]/60">
                Model is saved per chat when you send a message.
              </div>
            </div>
          </div>

          {/* Chat list */}
          <div className="px-3 pb-6">
            {sidebarChats.map((c) => {
              const active = c.chatid === chatid;

              return (
                <Link
                  key={c.chatid}
                  to={`/project/${projectid}/chat/${c.chatid}`}
                  className={[
                    "block rounded-2xl px-3 py-2 mb-2 border transition",
                    active
                      ? "bg-white/75 border-white/40 shadow-sm"
                      : "bg-white/45 border-transparent hover:bg-white/60",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[#754B4D]">{c.title}</div>
                      <div className="truncate text-xs text-[#754B4D]/60">{c.model_name}</div>
                    </div>

                    <button
                      type="button"
                      className="shrink-0 rounded-xl border border-[#AB8882]/40 bg-white/60 p-2 text-[#754B4D] hover:bg-white transition"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteChat(c.chatid);
                      }}
                      title="Delete chat"
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Header */}
          <div className="px-10 pt-8">
            <div className="rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-[#E0CBB9] bg-white/70 px-3 py-1.5 text-sm font-semibold text-[#754B4D]">
                      {courseName || "Course"}
                    </div>
                    <div className="truncate text-2xl font-semibold text-[#754B4D]">
                      {chat?.title || "Chat"}
                    </div>
                  </div>

                  <div className="mt-2 text-sm text-[#754B4D]/70">
                    Course memory is shared across all chats in this course.
                  </div>

                  <div className="mt-2 text-xs text-[#754B4D]/55">
                    debug: projectid={projectid} · chatid={chatid}
                  </div>
                </div>

                <Link
                  to={`/project/${projectid}`}
                  className="rounded-xl border border-[#AB8882]/50 bg-white/70 px-3 py-2 text-sm text-[#754B4D] hover:bg-white transition"
                >
                  Back to course
                </Link>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 min-h-0 px-10 pt-6 pb-6">
            <div className="h-full rounded-3xl border border-white/40 bg-white/55 backdrop-blur shadow-sm overflow-hidden flex flex-col">
              <div className="flex-1 overflow-auto p-6">
                <div className="mx-auto max-w-3xl flex flex-col gap-4">
                  {messages.length === 0 ? (
                    <div className="rounded-3xl border border-white/40 bg-white/70 shadow-sm p-6">
                      <div className="text-sm font-semibold text-[#754B4D]">No messages yet</div>
                      <div className="mt-2 text-sm text-[#754B4D]/70">
                        Ask about assignments, concepts, practice problems, or request step-by-step reasoning.
                      </div>
                    </div>
                  ) : null}

                  {messages.map((m) => (
                    <MessageBubble key={m.msgid} role={m.role} content={m.content} created_at={m.created_at} />
                  ))}

                  <div ref={bottomRef} />
                </div>
              </div>

              {/* Ask bar */}
              <div className="border-t border-white/40 bg-white/50 px-6 py-4">
                <div className="mx-auto max-w-3xl">
                  <AskBar
                    disabled={busy}
                    placeholder={busy ? "Thinking…" : "Ask a question…"}
                    onSubmit={(text) => handleAsk(text)}
                    className="bg-white/90 border border-[#E0CBB9] shadow-sm"
                  />
                  <div className="mt-2 text-[11px] text-[#754B4D]/60">
                    Tip: paste the problem statement + what you tried + where you’re stuck.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
