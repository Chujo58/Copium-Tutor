import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function EditableCardRow({ card, onSave, onDelete, disabled }) {
  const [front, setFront] = useState(card.front || "");
  const [back, setBack] = useState(card.back || "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setFront(card.front || "");
    setBack(card.back || "");
    setDirty(false);
  }, [card.cardid, card.front, card.back]);

  const canSave = dirty && front.trim().length > 0 && back.trim().length > 0 && !disabled;

  return (
    <div className="border bg-white rounded p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="font-semibold opacity-80">Card</div>
        <button
          className="text-sm underline opacity-70 disabled:opacity-40"
          onClick={onDelete}
          disabled={disabled}
          title="Delete card"
        >
          Delete
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <input
          className="border p-2 rounded"
          value={front}
          onChange={(e) => {
            setFront(e.target.value);
            setDirty(true);
          }}
          disabled={disabled}
          placeholder="Front"
        />

        <textarea
          className="border p-2 rounded"
          rows={3}
          value={back}
          onChange={(e) => {
            setBack(e.target.value);
            setDirty(true);
          }}
          disabled={disabled}
          placeholder="Back"
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="border px-3 py-2 rounded disabled:opacity-40"
          onClick={() => onSave(front, back)}
          disabled={!canSave}
          title="Save changes"
        >
          Save
        </button>

        {dirty ? <div className="text-sm opacity-60">Unsaved changes</div> : null}
      </div>
    </div>
  );
}

export default function DeckPage() {
  const { projectId, deckId } = useParams();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // viewer state
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // edit state
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");

  // Fetch projects and find the current course
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

  // Fetch deck and its cards
  const fetchDeck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/decks/${deckId}`, {
        credentials: "include",
      });
      const data = await res.json();

      if (data.success) {
        setDeck(data.deck);
        setCards(data.cards || []);
        setIndex(0);
        setFlipped(false);
      } else {
        setDeck(null);
        setCards([]);
      }
    } catch (e) {
      console.error(e);
      setDeck(null);
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    fetchProjectsAndCourse();
    fetchDeck();
  }, [fetchProjectsAndCourse, fetchDeck]);

  const projectsList = useMemo(() => {
    return projects.map((p) => ({ name: p.name, href: `/project/${p.projectid}` }));
  }, [projects]);

  const total = cards.length;
  const current = useMemo(() => (total > 0 ? cards[index] : null), [cards, index, total]);
  const canPrev = index > 0;
  const canNext = index < total - 1;

  const goPrev = useCallback(() => {
    if (!canPrev) return;
    setIndex((i) => i - 1);
    setFlipped(false);
  }, [canPrev]);

  const goNext = useCallback(() => {
    if (!canNext) return;
    setIndex((i) => i + 1);
    setFlipped(false);
  }, [canNext]);

  const flip = useCallback(() => {
    if (total === 0) return;
    setFlipped((f) => !f);
  }, [total]);

  const shuffleCards = useCallback(() => {
    if (cards.length === 0) return;
    setCards((prev) => shuffleArray(prev));
    setIndex(0);
    setFlipped(false);
  }, [cards.length]);

  // Keyboard shortcuts only in viewer mode (so typing in edit fields is safe)
  useEffect(() => {
    if (editMode) return;

    const onKeyDown = (e) => {
      if (total === 0) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        flip();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goPrev, goNext, flip, total, editMode]);

  // --------
  // CRUD API calls
  // --------
  const addCard = useCallback(async () => {
    const front = newFront.trim();
    const back = newBack.trim();

    if (!front || !back) {
      alert("Front and back are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/decks/${deckId}/cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front, back }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || "Failed to add card.");
        return;
      }
      setNewFront("");
      setNewBack("");
      await fetchDeck();
    } catch (e) {
      console.error(e);
      alert("Failed to add card (network error).");
    } finally {
      setSaving(false);
    }
  }, [API_URL, deckId, newFront, newBack, fetchDeck]);

  const updateCard = useCallback(
    async (cardid, front, back) => {
      const f = (front ?? "").trim();
      const b = (back ?? "").trim();
      if (!f || !b) {
        alert("Front and back cannot be empty.");
        return;
      }

      setSaving(true);
      try {
        const res = await fetch(`${API_URL}/cards/${cardid}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ front: f, back: b }),
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.message || "Failed to update card.");
          return;
        }
        await fetchDeck();
      } catch (e) {
        console.error(e);
        alert("Failed to update card (network error).");
      } finally {
        setSaving(false);
      }
    },
    [fetchDeck]
  );

  const deleteCard = useCallback(
    async (cardid) => {
      const ok = confirm("Delete this card?");
      if (!ok) return;

      setSaving(true);
      try {
        const res = await fetch(`${API_URL}/cards/${cardid}`, {
          method: "DELETE",
          credentials: "include",
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.message || "Failed to delete card.");
          return;
        }
        await fetchDeck();
      } catch (e) {
        console.error(e);
        alert("Failed to delete card (network error).");
      } finally {
        setSaving(false);
      }
    },
    [fetchDeck]
  );

  return (
    <div className="flex">
      <Sidebar projectsList={[
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
                        color:
                            project.color !== null ? project.color : "#754B4D",
                    })),
      ]} />

      <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">
        <Link to={`/project/${projectId}/flashcards`} className="underline">
          ← Back to Flashcards
        </Link>

        {courseLoading ? (
          <div className="mt-6">Loading…</div>
        ) : !course ? (
          <div className="mt-6">
            <div className="text-2xl font-semibold">Course not found</div>
            <div className="opacity-70">(Either it doesn’t exist, or you’re not logged in.)</div>
          </div>
        ) : loading ? (
          <div className="mt-6 opacity-70">Loading deck…</div>
        ) : !deck ? (
          <div className="mt-6">Deck not found.</div>
        ) : (
          <>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl main-header font-sans text-dark">{deck.name}</div>
                <div className="opacity-70">{deck.prompt}</div>
                <div className="mt-2 text-sm opacity-60">
                  {course.name} · projectId: {projectId}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="border px-3 py-2 rounded opacity-90"
                  onClick={() => setEditMode((v) => !v)}
                  title={editMode ? "Back to viewer" : "Edit cards"}
                >
                  {editMode ? "Done editing" : "Edit cards"}
                </button>

                <button
                  className="border px-3 py-2 rounded opacity-90"
                  onClick={fetchDeck}
                  disabled={saving}
                  title="Refresh"
                >
                  Refresh
                </button>
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Cards</h2>

              {total === 0 ? (
                <div className="mt-2 opacity-70">No cards yet</div>
              ) : null}

              {!editMode ? (
                <>
                  {total > 0 ? (
                    <>
                      <div className="mt-3 flex items-center justify-between gap-4">
                        <div className="opacity-70">
                          Card {index + 1} / {total} {flipped ? "(Back)" : "(Front)"}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            className="border px-3 py-2 rounded opacity-90 disabled:opacity-40"
                            onClick={goPrev}
                            disabled={!canPrev}
                          >
                            ← Prev
                          </button>

                          <button
                            className="border px-3 py-2 rounded opacity-90"
                            onClick={shuffleCards}
                            title="Shuffle cards"
                          >
                            Shuffle
                          </button>

                          <button
                            className="border px-3 py-2 rounded opacity-90"
                            onClick={flip}
                            title="Flip (Space / Enter)"
                          >
                            Flip
                          </button>

                          <button
                            className="border px-3 py-2 rounded opacity-90 disabled:opacity-40"
                            onClick={goNext}
                            disabled={!canNext}
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      <div
                        className="border bg-white rounded mt-4 p-6 cursor-pointer"
                        onClick={flip}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="font-semibold mb-2 opacity-80">
                          {flipped ? "Back" : "Front"}
                        </div>
                        <div className="text-lg whitespace-pre-wrap">
                          {flipped ? current?.back : current?.front}
                        </div>
                      </div>

                      <div className="mt-2 text-sm opacity-60">
                        Tip: click the card to flip. Use ← → to navigate. (Keyboard disabled in Edit mode.)
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  {/* Add card */}
                  <div className="mt-4 border bg-white rounded p-4 max-w-3xl">
                    <div className="font-semibold opacity-80">Add a card</div>
                    <div className="mt-3 grid gap-2">
                      <input
                        className="border p-2 rounded"
                        placeholder="Front"
                        value={newFront}
                        onChange={(e) => setNewFront(e.target.value)}
                        disabled={saving}
                      />
                      <textarea
                        className="border p-2 rounded"
                        placeholder="Back"
                        rows={3}
                        value={newBack}
                        onChange={(e) => setNewBack(e.target.value)}
                        disabled={saving}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          className="border px-3 py-2 rounded disabled:opacity-40"
                          onClick={addCard}
                          disabled={saving || !newFront.trim() || !newBack.trim()}
                        >
                          Add
                        </button>
                        {saving ? <div className="text-sm opacity-60">Saving…</div> : null}
                      </div>
                    </div>
                  </div>

                  {/* Edit list */}
                  <div className="mt-6 space-y-3 max-w-3xl">
                    {cards.map((c) => (
                      <EditableCardRow
                        key={c.cardid}
                        card={c}
                        disabled={saving}
                        onSave={(front, back) => updateCard(c.cardid, front, back)}
                        onDelete={() => deleteCard(c.cardid)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
