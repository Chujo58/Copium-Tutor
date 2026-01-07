export default function Sidebar() {
  return (
    <aside className="w-64 bg-neutral-200 border-r border-neutral-300 p-4">
      <h1 className="text-lg font-semibold mb-4">Notion-Lite</h1>

      <nav className="space-y-2 text-sm">
        <div className="cursor-pointer hover:bg-neutral-300 p-2 rounded">
          📁 Projects
        </div>
        <div className="cursor-pointer hover:bg-neutral-300 p-2 rounded">
          🧠 Notes
        </div>
        <div className="cursor-pointer hover:bg-neutral-300 p-2 rounded">
          📄 Documents
        </div>
      </nav>
    </aside>
  )
}
