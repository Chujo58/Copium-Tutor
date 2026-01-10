import * as Icons from "lucide-react";
import { useState } from "react";

export default function IconPicker({ value, onChange }) {
  const [query, setQuery] = useState("");

  const iconEntries = Object.entries(Icons).filter(
    ([name, Comp]) =>
      // Exclude non-icon exports and internal helpers
      name !== "createLucideIcon" &&
      name !== "icons" &&
      name !== "Icon" &&
      name !== "default" &&
      name !== "__esModule" &&
      // Ensure value exists and looks like a React component
      typeof Comp !== "undefined" &&
      (typeof Comp === "function" || (typeof Comp === "object" && Comp !== null)) &&
      name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="w-full rounded-lg border bg-dark p-3 shadow">
      {/* Search */}
      <input
        type="text"
        placeholder="Search icons..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-2 w-full rounded border bg-transparent px-2 py-1 text-sm text-white"
      />

      {/* Grid */}
      <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto">
        {iconEntries.map(([name, Icon]) => (
          <button
            key={name}
            onClick={() => onChange(name)}
            type="button"
            className={`flex items-center justify-center rounded p-2 hover:bg-white/10 ${
              value === name ? "bg-white/20" : ""
            }`}
          >
            <Icon size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}
