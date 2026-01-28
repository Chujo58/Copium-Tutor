import { useEffect, useMemo, useState } from "react";

export default function AskBar({
  placeholder = "Ask a question…",
  disabled = false,
  onSubmit,
  initialValue = "",
  autoFocus = false,
  className = "",
}) {
  const [text, setText] = useState(initialValue);

  useEffect(() => {
    setText(initialValue || "");
  }, [initialValue]);

  const canSend = useMemo(() => {
    return !disabled && text.trim().length > 0;
  }, [disabled, text]);

  const submit = () => {
    const value = text.trim();
    console.log("[AskBar] submit()", { value, disabled, canSend });

    if (!onSubmit) {
      console.warn("[AskBar] onSubmit is missing");
      return;
    }
    if (!canSend) return;

    onSubmit(value);
    setText("");
  };

  return (
    <div
      className={[
        // Stronger contrast than before
        "rounded-3xl border border-rose-plum/40 bg-white/60 shadow-sm",
        "px-3 py-2",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          className={[
            "flex-1 bg-transparent px-3 py-2 outline-none",
            "text-dark placeholder:text-dark/40",
          ].join(" ")}
        />

        <button
          type="button"
          onClick={submit}
          disabled={!canSend}
          className={[
            "btn primary dark font-card main-header medium rounded disabled:opacity-70 disabled:cursor-not-allowed"
          ].join(" ")}
          style={{ minWidth: 84 }} // smaller than before, but still tappable
        >
          ASK
        </button>
      </div>
    </div>
  );
}
