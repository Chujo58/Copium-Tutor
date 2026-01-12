import { useState } from "react";

export default function AskBar({
  placeholder = "Ask anything about this course…",
  onSubmit,
  disabled,
}) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (!text || disabled) return;
        onSubmit?.(text);
        setValue("");
      }}
      className="w-full"
    >
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="w-full bg-transparent text-sm text-white placeholder-white/40 outline-none"
        />
        <button
          type="submit"
          disabled={disabled}
          className="rounded-xl bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/15 disabled:opacity-50"
        >
          Ask
        </button>
      </div>
    </form>
  );
}
