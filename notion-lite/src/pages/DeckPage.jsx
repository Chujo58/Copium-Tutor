import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_URL } from "../config";

export default function DeckPage() {
  const { projectId, deckId } = useParams();

  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDeck = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/decks/${deckId}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setDeck(data.deck);
        setCards(data.cards || []);
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
  };

  useEffect(() => {
    fetchDeck();
  }, [deckId]);

  return (
    <div className="p-10">
      <Link to={`/project/${projectId}/flashcards`} className="underline">
        ← Back to Flashcards
      </Link>

      {loading ? (
        <div className="mt-4 opacity-70">Loading deck…</div>
      ) : !deck ? (
        <div className="mt-4">Deck not found.</div>
      ) : (
        <>
          <h1 className="text-3xl mt-4">{deck.name}</h1>
          <div className="opacity-70 mt-1">{deck.prompt}</div>

          <div className="mt-8">
            <h2 className="text-xl font-semibold">Cards</h2>
            {cards.length === 0 ? (
              <div className="mt-2 opacity-70">
                No cards yet (Backboard generation comes next).
              </div>
            ) : (
              <ul className="mt-3 space-y-3">
                {cards.map((c) => (
                  <li key={c.cardid} className="border p-3">
                    <div className="font-semibold">Front</div>
                    <div className="mb-2">{c.front}</div>
                    <div className="font-semibold">Back</div>
                    <div>{c.back}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
