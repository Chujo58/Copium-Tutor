// src/pages/CourseChatPage.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

  const [chat, setChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sidebarChats, setSidebarChats] = useState([]);
  const [busy, setBusy] = useState(false);

  const [llmProvider, setLlmProvider] = useState("openai");
  const [modelName, setModelName] = useState("gpt-4o");

  const bottomRef = useRef(null);

  const selectedKey = `${llmProvider}::${modelName}`;

  useEffect(() => {
    (async () => {
      const list = await ChatAPI.listChats(projectid);
      if (list?.success) setSidebarChats(list.chats || []);
    })().catch(() => {});
  }, [projectid]);

  useEffect(() => {
    (async () => {
      const data = await ChatAPI.getChat(chatid);
      if (!data?.success) return;

      setChat(data.chat);
      setMessages(data.messages || []);
      setLlmProvider(data.chat.llm_provider || "openai");
      setModelName(data.chat.model_name || "gpt-4o");
    })().catch(() => {});
  }, [chatid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleAsk(text) {
    setBusy(true);
    try {
      // optimistic append
      const tempUser = {
        msgid: `temp-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((m) => [...m, tempUser]);

      const resp = await ChatAPI.sendMessage(chatid, {
        content: text,
        llm_provider: llmProvider,
        model_name: modelName,
      });

      if (resp?.success) {
        // replace optimistic user msg + append assistant
        setMessages((prev) => {
          const withoutTemp = prev.filter((x) => x.msgid !== tempUser.msgid);
          return [...withoutTemp, ...resp.messages];
        });

        // refresh sidebar ordering
        const list = await ChatAPI.listChats(projectid);
        if (list?.success) setSidebarChats(list.chats || []);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleNewChat() {
    const created = await ChatAPI.createChat(projectid, {
      title: "New chat",
      llm_provider: llmProvider,
      model_name: modelName,
    });
    if (created?.success) {
      nav(`/projects/${projectid}/chat/${created.chat.chatid}`);
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
                  to={`/projects/${projectid}/chat/${c.chatid}`}
                  className={[
                    "block rounded-xl px-3 py-2 text-sm",
                    active ? "bg-white/10" : "hover:bg-white/5",
                  ].join(" ")}
                >
                  <div className="truncate font-medium">{c.title}</div>
                  <div className="truncate text-xs opacity-50">
                    {c.model_name}
                  </div>
                </Link>
              );
            })}
          </div>
        </aside>

        {/* Main chat */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold">
                {chat?.title || "Chat"}
              </div>
              <div className="text-xs opacity-60">
                Course memory is shared across all chats in this course.
              </div>
            </div>

            <Link
              to={`/projects/${projectid}`}
              className="rounded-xl bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
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
                onSubmit={handleAsk}
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
