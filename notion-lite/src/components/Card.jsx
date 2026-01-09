// Subject Card for the general subjects like projects, notes, etc.
export default function SubjectCard({ title, image }) {
    return (
        <div
            className="
      m-4 rounded-lg cursor-pointer transition ease-in-out
      shadow hover:shadow-md
      bg-dark
      text-surface 
      hover:bg-rose-water
      hover:text-dark
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

            <h3 className="p-4 pt-1 main-header font-card">
                {title}
            </h3>
        </div>
    );
}

// Document Card for individual documents within a subject (uploaded documents), the top of the Card shows the document preview, and the bottom shows a document icon and the title (should somehow be grabbed from the uploaded file metadata) 

