export default function Card({ title, image }) {
    return (
        <div
            className="
      m-4 rounded-lg cursor-pointer transition
      shadow hover:shadow-md
      bg-dark
      text-surface 
      hover:bg-primary
    "
        >
            {image ? (
                <img
                    src={image}
                    alt={title}
                    className="mb-2 w-full h-40 object-cover rounded-t-lg"
                />
            ) : (
                <div
                    className="
            mb-2 w-full h-40 rounded-t-lg
            bg-accent/30
          "
                />
            )}

            <h3 className="font-bold font-card uppercase tracking-widest p-4 pt-1 tracking-tight">
                {title}
            </h3>
        </div>
    );
}
