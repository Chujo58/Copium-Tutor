import Card from "./Card"

export default function Page() {
  return (
    <main className="flex-1 p-10 overflow-auto">
      <h2 className="text-3xl font-bold mb-6">Projects</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="AI Website" image="https://preview.redd.it/i-got-bored-so-i-decided-to-draw-a-random-image-on-the-v0-4ig97vv85vjb1.png?width=640&crop=smart&auto=webp&s=22ed6cc79cba3013b84967f32726d087e539b699" />
        <Card title="Physics Notes" />
        <Card title="Research Docs" />
      </div>
    </main>
  )
}
