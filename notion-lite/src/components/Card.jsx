export default function Card({ title }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-4 hover:shadow-md transition">
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-neutral-500 mt-2">
        Click to open
      </p>
    </div>
  )
}
