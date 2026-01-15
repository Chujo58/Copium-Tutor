import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

export default function AllFlashcardsPage() {
  const [projects, setProjects] = useState([]);
  const [decks, setDecks] = useState([]);
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

    const fetchDecks = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/decks`, {
          credentials: "include",
        });
        const data = await res.json();
        setDecks(data.success ? data.decks || [] : []);
      } catch (e) {
        console.error(e);
        setDecks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
    fetchDecks();
  }, []);

  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;
    return decks.filter((d) => {
      const hay = `${d.name || ""} ${d.prompt || ""} ${d.project_name || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [decks, query]);

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
          All Flashcards
        </div>
        <div className="mt-2 text-sm opacity-60">
          Browse flashcard decks across all courses.
        </div>

        <div className="mt-6 flex items-center gap-2 max-w-xl">
          <input
            className="border p-2 w-full"
            placeholder="Search decks..."
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
            <div className="opacity-70">Loading decks…</div>
          ) : filteredDecks.length === 0 ? (
            <div className="opacity-70">No flashcard decks yet.</div>
          ) : (
            <ul className="space-y-3">
              {filteredDecks.map((deck) => (
                <li key={deck.deckid} className="border bg-white/70 rounded p-4">
                  <Link
                    className="text-lg font-semibold underline"
                    to={`/project/${deck.projectid}/flashcards/${deck.deckid}`}
                  >
                    {deck.name}
                  </Link>
                  <div className="text-sm opacity-70">{deck.project_name}</div>
                  {deck.prompt ? (
                    <div className="text-sm opacity-80 mt-2">{deck.prompt}</div>
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
