import Card from "./Card"

export default function Page() {
  return (
    <main className="flex-1 p-10 overflow-auto">
      <h2 className="text-3xl font-bold mb-6">Projects</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="AI Website" />
        <Card title="Physics Notes" />
        <Card title="Research Docs" />
      </div>
    </main>
  )
}
