import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

function fmtTime(iso) {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleString();
}

export default function AllChatsPage() {
  const [projects, setProjects] = useState([]);
  const [chats, setChats] = useState([]);
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

    const fetchChats = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/chats`, {
          credentials: "include",
        });
        const data = await res.json();
        setChats(data.success ? data.chats || [] : []);
      } catch (e) {
        console.error(e);
        setChats([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
    fetchChats();
  }, []);

  const filteredChats = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((chat) => {
      const hay = `${chat.title || ""} ${chat.project_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [chats, query]);

  return (
    <div className="flex">
      <Sidebar projects={projects}/>

      <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
        <div className="text-3xl main-header font-sans text-dark">
          All Chats
        </div>
        <div className="mt-2 text-sm opacity-60">
          Browse chatbot sessions across all courses.
        </div>

        <div className="mt-6 flex items-center gap-2 max-w-xl">
          <input
            className="border p-2 w-full"
            placeholder="Search chats..."
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
            <div className="opacity-70">Loading chats…</div>
          ) : filteredChats.length === 0 ? (
            <div className="opacity-70">No chats yet.</div>
          ) : (
            <ul className="space-y-3">
              {filteredChats.map((chat) => (
                <li key={chat.chatid} className="border bg-white/70 rounded p-4">
                  <Link
                    className="text-lg font-semibold underline"
                    to={`/project/${chat.projectid}/chat/${chat.chatid}`}
                  >
                    {chat.title}
                  </Link>
                  <div className="text-sm opacity-70">{chat.project_name}</div>
                  <div className="text-sm opacity-60 mt-1">
                    Updated {fmtTime(chat.updated_at)}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
