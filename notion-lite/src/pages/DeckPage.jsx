import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder } from "lucide-react";

export default function DeckPage() {
  const { projectId, deckId } = useParams();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  // flashcard viewer state
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

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

  // Keyboard: ←/→ to navigate, Space/Enter to flip
  useEffect(() => {
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
  }, [goPrev, goNext, flip, total]);

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
            <div className="mt-4">
              <div className="text-3xl main-header font-sans text-dark">{deck.name}</div>
              <div className="opacity-70">{deck.prompt}</div>
              <div className="mt-2 text-sm opacity-60">
                {course.name} · projectId: {projectId}
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Cards</h2>

              {total === 0 ? (
                <div className="mt-2 opacity-70">No cards yet</div>
              ) : (
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

                  {/* no animation required yet; keep your CSS later */}
                  <div
                    className="border bg-white rounded mt-4 p-6 cursor-pointer"
                    onClick={flip}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="font-semibold mb-2 opacity-80">
                      {flipped ? "Back" : "Front"}
                    </div>
                    <div className="text-lg">
                      {flipped ? current?.back : current?.front}
                    </div>
                  </div>

                  <div className="mt-2 text-sm opacity-60">
                    Tip: click the card to flip. Use ← → to navigate.
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
