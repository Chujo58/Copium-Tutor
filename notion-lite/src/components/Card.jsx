export default function Card({ title, image }) {
  return (
    <div className="bg-snow text-abyss dark:bg-abyss dark:text-snow m-4 rounded-lg shadow hover:shadow-md hover:bg-frost/50 hover:dark:bg-abyss/50 cursor-pointer transition">
      {/* Add image here for Card */}
      {image ? (
        <img src={image} alt={title} className="mb-2 w-full h-40 object-cover rounded-t-lg" />
      ) : (
        <div className="mb-2 w-full h-40 rounded-t-lg bg-mist" />
      )}
      <h3 className="font-medium font-sans p-4 pt-1">{title}</h3>
    </div>
  )
}
