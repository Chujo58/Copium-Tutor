import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../config";

export default function FlashcardsHomePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchDecks = async () => {
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
  };

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
      // optional: jump straight into the new deck
      navigate(`/project/${projectId}/flashcards/${data.deckid}`);
    } catch (e) {
      console.error(e);
      alert("Error creating deck");
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    fetchDecks();
  }, [projectId]);

  return (
    <div className="p-10">
      <Link to={`/project/${projectId}`} className="underline">
        ← Back to Course
      </Link>

      <h1 className="text-3xl mt-4">Flashcards</h1>
      <div className="opacity-70">projectId: {projectId}</div>

      <div className="mt-8">
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
          <button
            className="border px-3 py-2"
            onClick={createDeck}
            disabled={creating}
          >
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
              <li key={d.deckid}>
                <Link
                  className="underline"
                  to={`/project/${projectId}/flashcards/${d.deckid}`}
                >
                  {d.name}
                </Link>
                <div className="text-sm opacity-70">{d.prompt}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
