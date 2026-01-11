import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";

export default function FlashcardsHomePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

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
        const found = (data.projects || []).find((p) => p.projectid === projectId);
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
  }, [projectId]);

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/decks`, {
        credentials: "include",
      });
      const data = await res.json();
      setDecks(data.success ? data.decks : []);
    } catch (e) {
      console.error(e);
      setDecks([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProjectsAndCourse();
    fetchDecks();
  }, [fetchProjectsAndCourse, fetchDecks]);

  const projectsList = useMemo(() => {
    return projects.map((p) => ({ name: p.name, href: `/project/${p.projectid}` }));
  }, [projects]);

  const createDeck = async () => {
    if (!name.trim() || !prompt.trim()) {
      alert("Please fill in deck name + prompt.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectId}/decks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, prompt }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to create deck");
        return;
      }
      setName("");
      setPrompt("");
      await fetchDecks();
      navigate(`/project/${projectId}/flashcards/${data.deckid}`);
    } catch (e) {
      console.error(e);
      alert("Error creating deck");
    } finally {
      setCreating(false);
    }
  };

  const deleteDeck = async (deckid) => {
    if (!confirm("Delete this deck? This will delete all its cards.")) return;

    const res = await fetch(`${API_URL}/decks/${deckid}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.message || "Failed to delete deck");
      return;
    }
    fetchDecks();
  };

  return (
    <div className="flex">
      <Sidebar projectsList={projectsList} />

      <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
        <Link to={`/project/${projectId}`} className="underline">
          ← Back to Course
        </Link>

        {courseLoading ? (
          <div className="mt-6">Loading…</div>
        ) : !course ? (
          <div className="mt-6">
            <div className="text-2xl font-semibold">Course not found</div>
            <div className="opacity-70">(Either it doesn’t exist, or you’re not logged in.)</div>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="text-3xl main-header font-sans text-dark">
                Flashcards
              </div>
              <div className="opacity-70">{course.name}</div>
              <div className="mt-2 text-sm opacity-60">projectId: {projectId}</div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Create a deck</h2>

              <div className="mt-3 flex flex-col gap-2 max-w-xl">
                <input
                  className="border p-2"
                  placeholder="Deck name (e.g., Midterm)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={creating}
                />
                <textarea
                  className="border p-2"
                  placeholder='Prompt: "What do you need to study?"'
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={creating}
                  rows={4}
                />
                <button className="border px-3 py-2" onClick={createDeck} disabled={creating}>
                  {creating ? "Creating…" : "Create deck"}
                </button>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Your decks</h2>

              {loading ? (
                <div className="mt-2 opacity-70">Loading…</div>
              ) : decks.length === 0 ? (
                <div className="mt-2 opacity-70">No decks yet.</div>
              ) : (
                <ul className="mt-3 space-y-2">
                  {decks.map((d) => (
                    <li key={d.deckid} className="flex items-start justify-between gap-4">
                      <div>
                        <Link
                          className="underline"
                          to={`/project/${projectId}/flashcards/${d.deckid}`}
                        >
                          {d.name}
                        </Link>
                        <div className="text-sm opacity-70">{d.prompt}</div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          deleteDeck(d.deckid);
                        }}
                        className="text-sm underline opacity-60 hover:opacity-100"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
