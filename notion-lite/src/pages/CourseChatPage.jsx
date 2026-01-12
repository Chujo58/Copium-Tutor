import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import AskBar from "../components/AskBar";
import { ChatAPI } from "../services/chat";

const MODEL_OPTIONS = [
  { label: "GPT-4o (fast)", llm_provider: "openai", model_name: "gpt-4o" },
  { label: "GPT-4.1 (better reasoning)", llm_provider: "openai", model_name: "gpt-4.1" },
  { label: "o3-mini (reasoning)", llm_provider: "openai", model_name: "o3-mini" },
];

function MessageBubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={[
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-gradient-to-br from-rose-400/20 to-fuchsia-400/10 text-white border border-white/10"
            : "bg-white/5 text-white border border-white/10",
        ].join(" ")}
      >
        {content}
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

  const bottomRef = useRef(null);
  const didAutoSendRef = useRef(false);

  const selectedKey = `${llmProvider}::${modelName}`;
  const firstMessage = location.state?.firstMessage;

  // ---- LOG: mount + route params
  useEffect(() => {
    console.log("[CourseChatPage] mounted/route", {
      projectid,
      chatid,
      path: location.pathname,
      state: location.state,
      firstMessage,
    });
  }, [projectid, chatid, location.pathname, location.state, firstMessage]);

  // Load sidebar threads
  useEffect(() => {
    (async () => {
      console.log("[CourseChatPage] listChats()", { projectid });
      const list = await ChatAPI.listChats(projectid);
      console.log("[CourseChatPage] listChats result:", list);
      if (list?.success) setSidebarChats(list.chats || []);
    })().catch((err) => {
      console.error("[CourseChatPage] listChats error:", err);
    });
  }, [projectid]);

  // Load current chat messages
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
    })().catch((err) => {
      console.error("[CourseChatPage] getChat error:", err);
    });
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
    console.log("[CourseChatPage] handleAsk()", {
      chatid,
      projectid,
      trimmed,
      llmProvider,
      modelName,
    });

    if (!trimmed) return;

    setBusy(true);
    try {
      // optimistic append
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

  // Auto-send first message once after chat is loaded
  useEffect(() => {
    if (!firstMessage) return;
    if (didAutoSendRef.current) return;

    // Wait until chat is present (ensures we're on the correct session page)
    if (!chatid) return;

    didAutoSendRef.current = true;
    console.log("[CourseChatPage] auto-send firstMessage", { firstMessage });

    // Fire-and-forget; handleAsk has its own try/catch
    handleAsk(firstMessage);
    // Note: we can't easily clear location.state without navigating.
    // didAutoSendRef prevents repeats on re-render.
  }, [firstMessage, chatid]); // intentionally not depending on handleAsk to avoid re-trigger

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
    <div className="h-[calc(100vh-0px)] w-full bg-gradient-to-b from-[#120A14] via-[#0E0B14] to-[#07060A] text-white">
      <div className="flex h-full">
        {/* Left sidebar */}
        <aside className="w-[320px] shrink-0 border-r border-white/10 bg-black/20">
          <div className="flex items-center justify-between px-4 py-4">
            <div className="text-sm font-semibold opacity-90">Chats</div>
            <button
              onClick={handleNewChat}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
            >
              + New
            </button>
          </div>

          <div className="px-4 pb-3">
            <label className="text-xs opacity-60">Model</label>
            <select
              value={selectedKey}
              onChange={(e) => {
                const [p, m] = e.target.value.split("::");
                console.log("[CourseChatPage] model select changed", { p, m });
                setLlmProvider(p);
                setModelName(m);
              }}
              className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
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
            <div className="mt-2 text-[11px] opacity-50">
              Model is saved per chat when you send a message.
            </div>
          </div>

          <div className="px-2">
            {sidebarChats.map((c) => {
              const active = c.chatid === chatid;
              return (
                <Link
                  key={c.chatid}
                  to={`/project/${projectid}/chat/${c.chatid}`}
                  className={[
                    "block rounded-xl px-3 py-2 text-sm",
                    active ? "bg-white/10" : "hover:bg-white/5",
                  ].join(" ")}
                  onClick={() => console.log("[CourseChatPage] sidebar click", { to: c.chatid })}
                >
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="truncate text-xs opacity-50">{c.model_name}</div>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main chat */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">{chat?.title || "Chat"}</div>
              <div className="text-xs opacity-60">
                Course memory is shared across all chats in this course.
              </div>
              <div className="mt-1 text-[11px] opacity-50">
                debug: projectid={projectid} chatid={chatid}
              </div>
            </div>

            <Link
              to={`/project/${projectid}`}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
              onClick={() => console.log("[CourseChatPage] back to course clicked")}
            >
              Back to course
            </Link>
          </header>

          <div className="flex-1 overflow-auto px-6 py-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-3">
              {messages.length === 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm opacity-80">
                  Ask about assignments, concepts, practice problems, or request
                  step-by-step reasoning.
                </div>
              )}

              {messages.map((m) => (
                <MessageBubble key={m.msgid} role={m.role} content={m.content} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="border-t border-white/10 px-6 py-4">
            <div className="mx-auto max-w-3xl">
              <AskBar
                disabled={busy}
                placeholder={busy ? "Thinking…" : "Ask a question…"}
                onSubmit={(text) => {
                  console.log("[CourseChatPage] AskBar onSubmit fired", { text });
                  handleAsk(text);
                }}
              />
              <div className="mt-2 text-[11px] opacity-50">
                Tip: paste the problem statement + what you tried + where you’re stuck.
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
