import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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

function SoftButton({ children, onClick, disabled, title, variant = "light", type = "button" }) {
  const base =
    "px-4 py-2 rounded-xl border transition disabled:opacity-40 disabled:cursor-not-allowed";
  const cls =
    variant === "primary"
      ? "border-dark/30 bg-dark text-white hover:bg-dark/90"
      : variant === "danger"
      ? "border-primary/40 bg-primary/10 text-dark hover:bg-primary/20"
      : "border-secondary/50 bg-white/70 text-dark hover:bg-white";

  return (
    <button className={`${base} ${cls}`} onClick={onClick} disabled={disabled} title={title} type={type}>
      {children}
    </button>
  );
}

function Badge({ children, title }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs border border-secondary/40 bg-white/60 text-dark"
      title={title}
    >
      {children}
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/50 backdrop-blur p-5 shadow-sm">
      <div className="h-5 w-40 bg-surface/60 rounded" />
      <div className="mt-3 h-4 w-full bg-surface/40 rounded" />
      <div className="mt-2 h-4 w-2/3 bg-surface/35 rounded" />
    </div>
  );
}

export default function FlashcardsHomePage() {
  const { projectid } = useParams();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [creating, setCreating] = useState(false);

  // NEW: search/filter
  const [query, setQuery] = useState("");
  const loadingGif = `${API_URL}/public/cat.gif`;

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

  const fetchDecks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects/${projectid}/decks`, {
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
  }, [projectid]);

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
      const res = await fetch(`${API_URL}/projects/${projectid}/decks`, {
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
      setQuery(""); // reset filter so new deck is visible
      await fetchDecks();
      navigate(`/project/${projectid}/flashcards/${data.deckid}`);
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

  const deckCount = decks?.length ?? 0;

  // NEW: filtered decks
  const filteredDecks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return decks;

    return decks.filter((d) => {
      const hay = `${d.name || ""} ${d.prompt || ""} ${d.deckid || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [decks, query]);

  return (
    <div className="flex">
    <Sidebar projects={projects} projectPopupStatus={{ onEdited: fetchProjectsAndCourse }} />

      <div className="flex-1 h-screen overflow-auto bg-gradient-to-b from-[#F6EFEA] via-surface/35 to-[#F6EFEA]">
        {creating ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F6EFEA]/80 backdrop-blur">
            <div className="rounded-3xl border border-white/50 bg-white/80 px-8 py-7 shadow-lg text-center">
              <img
                src={loadingGif}
                alt="Generating flashcards"
                className="mx-auto h-44 w-44 object-contain"
              />
              <div className="mt-3 text-dark font-semibold">
                Generating flashcards…
              </div>
              <div className="text-sm text-dark/70">
                Hang tight, this can take a minute.
              </div>
            </div>
          </div>
        ) : null}
        <div className="p-10">
          <Link
            to={`/project/${projectid}`}
            className="inline-flex items-center gap-2 text-dark hover:opacity-80"
          >
            <span className="px-2 py-1 rounded-lg border border-surface bg-white/50">←</span>
            Back to Course
          </Link>

          {courseLoading ? (
            <div className="mt-8 text-dark/70">Loading…</div>
          ) : !course ? (
            <div className="mt-8">
              <div className="text-2xl font-semibold text-dark">Course not found</div>
              <div className="text-dark/70">(Either it doesn’t exist, or you’re not logged in.)</div>
            </div>
          ) : (
            <>
              {/* Header card */}
              <div className="mt-6 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-3xl font-semibold text-dark font-card">Flashcards</div>
                    <div className="mt-1 text-dark/70">{course.name}</div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Badge title="Project identifier">{projectid}</Badge>
                      <Badge title="Number of decks">{deckCount} deck{deckCount === 1 ? "" : "s"}</Badge>
                    </div>
                  </div>

                  <div className="text-right text-sm text-dark/60">
                    Create decks from your uploaded course docs, then review :)
                  </div>
                </div>
              </div>

              {/* Create deck + Deck list */}
              <div className="mt-10 grid gap-6 lg:grid-cols-2">
                {/* Create deck */}
                <div className="rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-dark font-card">Create a deck</h2>
                    {creating ? <Badge title="Creating state">Creating…</Badge> : null}
                  </div>

                  <div className="mt-4 grid gap-3">
                    <input
                      className="w-full rounded-xl border border-surface bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Deck name (e.g., Midterm)"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={creating}
                    />

                    <textarea
                      className="w-full rounded-xl border border-surface bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder='Prompt: "What do you need to study?"'
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={creating}
                      rows={5}
                    />

                    <div className="flex items-center gap-2">
                      <SoftButton
                        variant="primary"
                        onClick={createDeck}
                        disabled={creating || !name.trim() || !prompt.trim()}
                        title="Create deck and generate cards"
                      >
                        {creating ? "Creating…" : "Create deck"}
                      </SoftButton>

                      <SoftButton
                        onClick={() => {
                          setName("");
                          setPrompt("");
                        }}
                        disabled={creating}
                        title="Clear fields"
                      >
                        Clear
                      </SoftButton>
                    </div>

                    <div className="text-sm text-dark/60 font-card">
                      Tip: Keep the prompt specific (chapters, topics, exam focus) for better cards.
                    </div>
                  </div>
                </div>

                {/* Deck list */}
                <div className="rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold text-dark font-card">Your decks</h2>
                    <SoftButton onClick={fetchDecks} disabled={loading} title="Refresh deck list">
                      Refresh
                    </SoftButton>
                  </div>

                  {/* NEW: Search bar */}
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      className="w-full rounded-xl border border-surface bg-white/80 px-3 py-2 outline-none focus:ring-2 focus:ring-accent/50"
                      placeholder="Search decks (name, prompt, id)…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      disabled={loading}
                    />
                    <SoftButton onClick={() => setQuery("")} disabled={loading || !query} title="Clear search">
                      Clear
                    </SoftButton>
                  </div>

                  {/* Search result meta */}
                  <div className="mt-2 text-sm text-dark/60">
                    Showing <span className="font-semibold">{filteredDecks.length}</span> of{" "}
                    <span className="font-semibold">{deckCount}</span>
                    {query.trim() ? (
                      <>
                        {" "}
                        for <Badge title="Search query">{query.trim()}</Badge>
                      </>
                    ) : null}
                  </div>

                  {loading ? (
                    <div className="mt-4 space-y-3">
                      <SkeletonRow />
                      <SkeletonRow />
                      <SkeletonRow />
                    </div>
                  ) : filteredDecks.length === 0 ? (
                    <div className="mt-4 text-dark/70">
                      {deckCount === 0 ? "No decks yet. Create one on the left ✨" : "No decks match your search."}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {filteredDecks.map((d) => (
                        <div
                          key={d.deckid}
                          className="rounded-2xl border border-white/40 bg-white/65 backdrop-blur p-5 shadow-sm hover:bg-white/75 transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <Link
                                to={`/project/${projectid}/flashcards/${d.deckid}`}
                                className="text-lg font-semibold text-dark hover:opacity-80 truncate block"
                              >
                                {d.name}
                              </Link>
                              <div className="mt-1 text-sm text-dark/70 line-clamp-2">
                                {d.prompt}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Badge title="Deck id">{d.deckid}</Badge>
                                {d.createddate ? (
                                  <Badge title="Created date">
                                    {new Date(d.createddate).toLocaleDateString()}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>

                            <SoftButton
                              variant="danger"
                              onClick={(e) => {
                                e.preventDefault();
                                deleteDeck(d.deckid);
                              }}
                              title="Delete deck"
                            >
                              Delete
                            </SoftButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 text-xs text-dark/55">
                    Deleting a deck deletes all its cards.
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
