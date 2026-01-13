import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import AskBar from "../components/AskBar";
import { ChatAPI } from "../services/chat";
import { API_URL } from "../config";

// ✅ Markdown rendering
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Palette (same as your DeckPage comments):
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

// --- Pretty markdown styles, tuned to match DeckPage typography/colors
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

  // Cards > bubbles, like DeckPage cards
  const shell = isUser
    ? "bg-[#D8A694]/25 border-white/40"
    : "bg-white/70 border-white/40";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[86%] rounded-3xl border backdrop-blur shadow-sm px-5 py-4",
          shell,
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-[#754B4D]/60">
            {isUser ? "You" : "Copium Tutor"}
          </div>
          {created_at ? (
            <div className="text-[11px] text-[#754B4D]/45">{fmtTime(created_at)}</div>
          ) : null}
        </div>

        <div className="mt-2">
          {isUser ? (
            <div className="whitespace-pre-wrap text-sm text-[#2b1b1c] leading-relaxed">
              {content}
            </div>
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

  const bottomRef = useRef(null);
  const didAutoSendRef = useRef(false);

  const selectedKey = `${llmProvider}::${modelName}`;
  const firstMessage = location.state?.firstMessage;

  useEffect(() => {
    console.log("[CourseChatPage] mounted/route", {
      projectid,
      chatid,
      path: location.pathname,
      state: location.state,
      firstMessage,
    });
  }, [projectid, chatid, location.pathname, location.state, firstMessage]);

  // Load course name
  useEffect(() => {
    (async () => {
      try {
        console.log("[CourseChatPage] fetching course name via /projects", { projectid });
        const res = await fetch(`${API_URL}/projects`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const found = (data.projects || []).find((p) => p.projectid === projectid);
        if (found?.name) setCourseName(found.name);
      } catch (e) {
        console.warn("[CourseChatPage] course name fetch failed (non-blocking)", e);
      }
    })();
  }, [projectid]);

  // Sidebar chat list
  useEffect(() => {
    (async () => {
      console.log("[CourseChatPage] listChats()", { projectid });
      const list = await ChatAPI.listChats(projectid);
      console.log("[CourseChatPage] listChats result:", list);
      if (list?.success) setSidebarChats(list.chats || []);
    })().catch((err) => console.error("[CourseChatPage] listChats error:", err));
  }, [projectid]);

  // Current chat + messages
  useEffect(() => {
    (async () => {
      console.log("[CourseChatPage] getChat()", { chatid });
      const data = await ChatAPI.getChat(chatid);
      console.log("[CourseChatPage] getChat result:", data);

      if (!data?.success) return;

      setChat(data.chat);
      setMessages(data.messages || []);
      setLlmProvider(data.chat.llm_provider || "openai");
      setModelName(data.chat.model_name || "gpt-4o");
    })().catch((err) => console.error("[CourseChatPage] getChat error:", err));
  }, [chatid]);

  // Autoscroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function refreshSidebar() {
    try {
      console.log("[CourseChatPage] refreshSidebar()", { projectid });
      const list = await ChatAPI.listChats(projectid);
      console.log("[CourseChatPage] refreshSidebar result:", list);
      if (list?.success) setSidebarChats(list.chats || []);
    } catch (e) {
      console.error("[CourseChatPage] refreshSidebar error:", e);
    }
  }

  async function handleAsk(text) {
    const trimmed = (text || "").trim();
    console.log("[CourseChatPage] handleAsk()", { chatid, projectid, trimmed, llmProvider, modelName });
    if (!trimmed) return;

    setBusy(true);
    try {
      const tempUser = {
        msgid: `temp-${Date.now()}`,
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, tempUser]);

      console.log("[CourseChatPage] sendMessage() -> calling API");
      const resp = await ChatAPI.sendMessage(chatid, {
        content: trimmed,
        llm_provider: llmProvider,
        model_name: modelName,
      });
      console.log("[CourseChatPage] sendMessage response:", resp);

      if (resp?.success) {
        setMessages((prev) => {
          const withoutTemp = prev.filter((x) => x.msgid !== tempUser.msgid);
          return [...withoutTemp, ...(resp.messages || [])];
        });
        await refreshSidebar();
      } else {
        console.error("[CourseChatPage] sendMessage failed:", resp);
      }
    } catch (e) {
      console.error("[CourseChatPage] handleAsk error:", e);
    } finally {
      setBusy(false);
    }
  }

  // Auto-send first message once
  useEffect(() => {
    if (!firstMessage) return;
    if (didAutoSendRef.current) return;
    if (!chatid) return;

    didAutoSendRef.current = true;
    console.log("[CourseChatPage] auto-send firstMessage", { firstMessage });
    handleAsk(firstMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstMessage, chatid]);

  async function handleNewChat() {
    console.log("[CourseChatPage] handleNewChat()", { projectid, llmProvider, modelName });
    try {
      const created = await ChatAPI.createChat(projectid, {
        title: "New chat",
        llm_provider: llmProvider,
        model_name: modelName,
      });

      console.log("[CourseChatPage] createChat result:", created);

      if (created?.success) {
        const to = `/project/${projectid}/chat/${created.chat.chatid}`;
        console.log("[CourseChatPage] navigating to new chat", { to });
        nav(to);
      } else {
        console.error("[CourseChatPage] createChat failed:", created);
      }
    } catch (e) {
      console.error("[CourseChatPage] handleNewChat error:", e);
    }
  }

  return (
    <div className="h-screen w-full">
      {/* same “paper” background feel as DeckPage */}
      <div className="flex h-full bg-gradient-to-b from-[#F6EFEA] via-[#E0CBB9]/35 to-[#F6EFEA]">
        {/* Left sidebar (soft panel, like DeckPage cards) */}
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

            <div className="mt-4">
              <label className="text-xs text-[#754B4D]/60">Model</label>
              <select
                value={selectedKey}
                onChange={(e) => {
                  const [p, m] = e.target.value.split("::");
                  console.log("[CourseChatPage] model select changed", { p, m });
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
                  onClick={() => console.log("[CourseChatPage] sidebar click", { to: c.chatid })}
                >
                  <div className="truncate font-semibold text-[#754B4D]">{c.title}</div>
                  <div className="truncate text-xs text-[#754B4D]/60">{c.model_name}</div>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main */}
        <main className="flex min-w-0 flex-1 flex-col">
          {/* Header card (match DeckPage top card) */}
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
                  onClick={() => console.log("[CourseChatPage] back to course clicked")}
                >
                  Back to course
                </Link>
              </div>
            </div>
          </div>

          {/* Messages in a big “card” like DeckPage */}
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
                    <MessageBubble
                      key={m.msgid}
                      role={m.role}
                      content={m.content}
                      created_at={m.created_at}
                    />
                  ))}

                  <div ref={bottomRef} />
                </div>
              </div>

              {/* Ask bar footer (also card-like) */}
              <div className="border-t border-white/40 bg-white/50 px-6 py-4">
                <div className="mx-auto max-w-3xl">
                  <AskBar
                    disabled={busy}
                    placeholder={busy ? "Thinking…" : "Ask a question…"}
                    onSubmit={(text) => {
                      console.log("[CourseChatPage] AskBar onSubmit fired", { text });
                      handleAsk(text);
                    }}
                    // make it pop + match flashcards:
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
