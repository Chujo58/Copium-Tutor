import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

/**
 * Rose palette inspired by your image:
 * - Copper Rose: #A86A65
 * - Dusty Rose:  #AB8882
 * - Rosewater:   #D8A694
 * - China Doll:  #E0CBB9
 * - Plum Wine:   #754B4D
 */

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function parseDueMs(due_at) {
  if (!due_at) return null;
  const t = Date.parse(due_at);
  return Number.isNaN(t) ? null : t;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString();
}

function masteryLabel(card) {
  const reps = card?.reps ?? 0;
  const interval = card?.interval_days ?? 0;

  if (reps === 0) return "New";
  if (interval < 2) return "Learning";
  if (interval < 14) return "Reviewing";
  return "Mastered";
}

function cardStatus(card) {
  const reps = card?.reps ?? 0;
  const interval = card?.interval_days ?? 0;

  const dueMs = card?.due_at ? Date.parse(card.due_at) : NaN;
  const isDue = !card?.due_at || Number.isNaN(dueMs) || dueMs <= Date.now();

  if (reps === 0) return { label: "New", tone: "neutral", hint: "Not reviewed yet" };
  if (isDue) return { label: "Due", tone: "accent", hint: "Ready to review" };
  if (interval < 2) return { label: "Learning", tone: "warm", hint: `Interval: ${interval.toFixed(2)} days` };
  if (interval < 14) return { label: "Reviewing", tone: "warm", hint: `Interval: ${interval.toFixed(1)} days` };
  return { label: "Mastered", tone: "strong", hint: `Interval: ${interval.toFixed(0)} days` };
}

function Badge({ label, title, tone = "neutral" }) {
  const toneClass =
    tone === "accent"
      ? "border-[#A86A65] text-dark bg-[#E0CBB9]/60"
      : tone === "warm"
      ? "border-[#D8A694] text-dark bg-[#D8A694]/20"
      : tone === "strong"
      ? "border-[#754B4D] text-white bg-[#754B4D]/90"
      : "border-[#AB8882] text-dark bg-white/60";

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs border ${toneClass}`}
      title={title}
    >
      {label}
    </span>
  );
}

function SoftButton({ children, onClick, disabled, title }) {
  return (
    <button
      className="px-3 py-2 rounded-lg border border-[#AB8882]/50 bg-white/70 hover:bg-white transition disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

function RatingButton({ label, hintKey, onClick, disabled, variant }) {
  const cls =
    variant === "again"
      ? "border-[#A86A65]/60 bg-[#A86A65]/10 hover:bg-[#A86A65]/20"
      : variant === "hard"
      ? "border-[#AB8882]/60 bg-[#AB8882]/10 hover:bg-[#AB8882]/20"
      : variant === "good"
      ? "border-[#D8A694]/60 bg-[#D8A694]/10 hover:bg-[#D8A694]/20"
      : "border-[#E0CBB9]/80 bg-[#E0CBB9]/40 hover:bg-[#E0CBB9]/60";

  return (
    <button
      className={`px-4 py-2 rounded-xl border transition disabled:opacity-40 ${cls}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
      title={hintKey ? `Hotkey: ${hintKey}` : undefined}
    >
      <div className="flex items-center gap-2">
        <span className="font-medium text-dark">{label}</span>
        {hintKey ? (
          <span className="text-xs px-2 py-0.5 rounded-full border border-[#754B4D]/20 bg-white/50 text-dark/80">
            {hintKey}
          </span>
        ) : null}
      </div>
    </button>
  );
}

function EditableCardRow({ card, onSave, onDelete, disabled }) {
  const [front, setFront] = useState(card.front || "");
  const [back, setBack] = useState(card.back || "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFront(card.front || "");
    setBack(card.back || "");
    setDirty(false);
  }, [card.cardid, card.front, card.back]);

  const canSave = dirty && front.trim().length > 0 && back.trim().length > 0 && !disabled;
  const s = cardStatus(card);

  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="font-semibold text-dark">Card</div>
          <Badge label={s.label} title={s.hint} tone={s.tone} />
        </div>

        <button
          className="text-sm underline text-dark/80 hover:text-dark disabled:opacity-40"
          onClick={onDelete}
          disabled={disabled}
          type="button"
          title="Delete card"
        >
          Delete
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <input
          className="w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-[#D8A694]/50"
          value={front}
          onChange={(e) => {
            setFront(e.target.value);
            setDirty(true);
          }}
          disabled={disabled}
          placeholder="Front"
        />

        <textarea
          className="w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-[#D8A694]/50"
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

      <div className="mt-3 text-xs text-dark/70 flex flex-wrap gap-x-4 gap-y-1">
        <span>Reps: {card?.reps ?? 0}</span>
        <span>Ease: {card?.ease ?? "—"}</span>
        <span>Interval (days): {card?.interval_days ?? "—"}</span>
        <span>Lapses: {card?.lapses ?? 0}</span>
        <span>Due: {fmtDate(card?.due_at)}</span>
        <span>Last: {fmtDate(card?.last_reviewed_at)}</span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          className="px-4 py-2 rounded-xl border border-[#AB8882]/60 bg-[#754B4D] text-white hover:bg-[#754B4D]/90 transition disabled:opacity-40"
          onClick={() => onSave(front, back)}
          disabled={!canSave}
          type="button"
        >
          Save
        </button>

        {dirty ? <div className="text-sm text-dark/70">Unsaved changes</div> : null}
      </div>
    </div>
  );
}

export default function DeckPage() {
  const { projectid, deckId } = useParams();

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

  // study options
  const [dueOnly, setDueOnly] = useState(true);

  // Fetch projects + current course
  const fetchProjectsAndCourse = useCallback(async () => {
    setCourseLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setProjects(data.projects || []);
        const found = (data.projects || []).find((p) => p.projectid === projectid);
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
  }, [projectid]);

  // Fetch deck + cards
  const fetchDeck = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/decks/${deckId}`, { credentials: "include" });
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

  const projectsList = useMemo(
    () => projects.map((p) => ({ name: p.name, href: `/project/${p.projectid}` })),
    [projects]
  );

  // Due filter
  const nowMs = Date.now();

  const dueCount = useMemo(() => {
    const due = cards.filter((c) => {
      const t = parseDueMs(c?.due_at);
      return t === null || t <= nowMs;
    });
    return due.length;
  }, [cards, nowMs]);

  const studyCards = useMemo(() => {
    if (!dueOnly) return cards;

    const due = cards.filter((c) => {
      const t = parseDueMs(c?.due_at);
      return t === null || t <= nowMs;
    });

    // Never empty: if nothing due, fallback to all
    return due.length > 0 ? due : cards;
  }, [cards, dueOnly, nowMs]);

  // Viewer derived state
  const total = studyCards.length;
  const current = useMemo(() => (total > 0 ? studyCards[index] : null), [studyCards, index, total]);

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

  // --------
  // CRUD
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
  }, [deckId, newFront, newBack, fetchDeck]);

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

  // --------
  // Review (Again / Hard / Good / Easy)
  // --------
  const reviewCard = useCallback(
    async (rating) => {
      if (!current?.cardid) return;

      // Anki-like: must flip first
      if (!flipped) {
        alert("Flip the card to see the answer before rating.");
        return;
      }

      setSaving(true);
      try {
        const res = await fetch(`${API_URL}/cards/${current.cardid}/review`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating }),
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.message || "Failed to review card.");
          return;
        }

        await fetchDeck();
        setFlipped(false);

        // Keep index safe after refresh
        setIndex((i) => {
          if (total <= 1) return 0;
          return Math.min(i, total - 1);
        });
      } catch (e) {
        console.error(e);
        alert("Failed to review card (network error).");
      } finally {
        setSaving(false);
      }
    },
    [current?.cardid, flipped, fetchDeck, total]
  );

  // Keyboard shortcuts (viewer only)
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
      } else if (flipped && (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4")) {
        e.preventDefault();
        if (e.key === "1") void reviewCard("again");
        if (e.key === "2") void reviewCard("hard");
        if (e.key === "3") void reviewCard("good");
        if (e.key === "4") void reviewCard("easy");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editMode, total, goPrev, goNext, flip, flipped, reviewCard]);

  // If dueOnly changes, reset viewer
  useEffect(() => {
    setIndex(0);
    setFlipped(false);
  }, [dueOnly]);

  // Guard index if queue shrinks
  useEffect(() => {
    if (index >= total) {
      setIndex(0);
      setFlipped(false);
    }
  }, [index, total]);

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

      <div className="flex-1 h-screen overflow-auto bg-gradient-to-b from-[#F6EFEA] via-[#E0CBB9]/35 to-[#F6EFEA]">
        <div className="p-10">
          <Link
            to={`/project/${projectid}/flashcards`}
            className="inline-flex items-center gap-2 text-dark hover:opacity-80"
          >
            <span className="px-2 py-1 rounded-lg border border-[#E0CBB9] bg-white/50">←</span>
            Back to Flashcards
          </Link>

          {courseLoading ? (
            <div className="mt-8 text-dark/70">Loading…</div>
          ) : !course ? (
            <div className="mt-8">
              <div className="text-2xl font-semibold text-dark">Course not found</div>
              <div className="text-dark/70">(Either it doesn’t exist, or you’re not logged in.)</div>
            </div>
          ) : loading ? (
            <div className="mt-8 text-dark/70">Loading deck…</div>
          ) : !deck ? (
            <div className="mt-8 text-dark">Deck not found.</div>
          ) : (
            <>
              <div className="mt-6 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-3xl font-semibold text-dark">{deck.name}</div>
                    <div className="mt-1 text-dark/70">{deck.prompt}</div>
                    <div className="mt-3 text-sm text-dark/60">
                      {course.name} · projectid: {projectid}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <SoftButton onClick={() => setEditMode((v) => !v)} title="Toggle edit mode" disabled={saving}>
                      {editMode ? "Done editing" : "Edit cards"}
                    </SoftButton>
                    <SoftButton onClick={fetchDeck} title="Refresh" disabled={saving}>
                      Refresh
                    </SoftButton>
                  </div>
                </div>
              </div>

              <div className="mt-10">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-dark">Cards</h2>
                    <div className="text-sm text-dark/60">
                      {cards.length} total · {dueCount} due
                    </div>
                  </div>

                  {!editMode ? (
                    <label className="flex items-center gap-2 text-sm text-dark/80 select-none">
                      <input
                        type="checkbox"
                        checked={dueOnly}
                        onChange={(e) => setDueOnly(e.target.checked)}
                        className="accent-[#A86A65]"
                      />
                      Due only
                      <Badge label={`${dueCount}`} tone="accent" title="Cards due now" />
                    </label>
                  ) : null}
                </div>

                {cards.length === 0 ? (
                  <div className="mt-4 text-dark/70">No cards yet.</div>
                ) : null}

                {!editMode ? (
                  <>
                    {total > 0 ? (
                      <>
                        <div className="mt-5 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 text-dark/80">
                            <div className="text-sm">
                              Card <span className="font-semibold">{index + 1}</span> / {total}
                            </div>
                            <Badge
                              label={masteryLabel(current)}
                              tone={masteryLabel(current) === "Mastered" ? "strong" : "warm"}
                              title="Mastery estimate from interval/reps"
                            />
                            <Badge label={flipped ? "Back" : "Front"} tone="neutral" title="Current side" />
                          </div>

                          <div className="flex items-center gap-2">
                            <SoftButton onClick={goPrev} disabled={!canPrev} title="ArrowLeft">
                              ← Prev
                            </SoftButton>
                            <SoftButton onClick={shuffleCards} disabled={saving} title="Shuffle deck">
                              Shuffle
                            </SoftButton>
                            <button
                              className="px-4 py-2 rounded-xl bg-[#754B4D] text-white hover:bg-[#754B4D]/90 transition"
                              onClick={flip}
                              type="button"
                              title="Space / Enter"
                            >
                              Flip
                            </button>
                            <SoftButton onClick={goNext} disabled={!canNext} title="ArrowRight">
                              Next →
                            </SoftButton>
                          </div>
                        </div>

                        <div
                          className="mt-6 rounded-3xl border border-white/40 bg-white/60 backdrop-blur p-8 shadow-sm cursor-pointer hover:bg-white/70 transition"
                          onClick={flip}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="text-sm font-semibold text-dark/80">
                              {flipped ? "Answer" : "Question"}
                            </div>
                            <div className="text-xs text-dark/60">
                              click to flip · Space/Enter
                            </div>
                          </div>

                          <div className="mt-4 text-xl text-[#2b1b1c] whitespace-pre-wrap leading-relaxed">
                            {flipped ? current?.back : current?.front}
                          </div>
                        </div>

                        {/* Rating buttons (only after flip) */}
                        {flipped ? (
                          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                            <RatingButton
                              label="Again"
                              hintKey="1"
                              variant="again"
                              onClick={() => reviewCard("again")}
                              disabled={saving}
                            />
                            <RatingButton
                              label="Hard"
                              hintKey="2"
                              variant="hard"
                              onClick={() => reviewCard("hard")}
                              disabled={saving}
                            />
                            <RatingButton
                              label="Good"
                              hintKey="3"
                              variant="good"
                              onClick={() => reviewCard("good")}
                              disabled={saving}
                            />
                            <RatingButton
                              label="Easy"
                              hintKey="4"
                              variant="easy"
                              onClick={() => reviewCard("easy")}
                              disabled={saving}
                            />
                          </div>
                        ) : (
                          <div className="mt-4 text-sm text-center text-dark/60">
                            Flip to rate (Again/Hard/Good/Easy)
                          </div>
                        )}

                        <div className="mt-3 text-xs text-center text-dark/55">
                          Hotkeys: ← → to navigate · Space/Enter to flip · 1–4 to rate (after flip)
                        </div>
                      </>
                    ) : (
                      <div className="mt-6 text-dark/70">No cards in study queue.</div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Add card */}
                    <div className="mt-6 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm max-w-3xl">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold text-dark">Add a card</div>
                        {saving ? (
                          <div className="text-sm text-dark/60">Saving…</div>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-3">
                        <input
                          className="w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-[#D8A694]/50"
                          placeholder="Front"
                          value={newFront}
                          onChange={(e) => setNewFront(e.target.value)}
                          disabled={saving}
                        />
                        <textarea
                          className="w-full rounded-xl border border-[#E0CBB9] bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-[#D8A694]/50"
                          placeholder="Back"
                          rows={3}
                          value={newBack}
                          onChange={(e) => setNewBack(e.target.value)}
                          disabled={saving}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            className="px-4 py-2 rounded-xl bg-[#A86A65] text-white hover:bg-[#A86A65]/90 transition disabled:opacity-40"
                            onClick={addCard}
                            disabled={saving || !newFront.trim() || !newBack.trim()}
                            type="button"
                          >
                            Add
                          </button>
                          <div className="text-sm text-dark/60">
                            Tip: status + stats appear after first review.
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Edit list */}
                    <div className="mt-8 space-y-4 max-w-3xl">
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
    </div>
  );
}
