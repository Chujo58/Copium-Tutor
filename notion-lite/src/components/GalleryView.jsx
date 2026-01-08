import SubjectCard from "./Card";

//  This stuff should create a gallery view for subjects for a user. The gallery should also show some button to add a new subject.
export default function GalleryView({ subjects, onAddSubject }) {
    return (
        <div className="p-6 bg-dark min-w-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl main-header text-surface">Your Subjects</h1>
                <button
                    onClick={onAddSubject}
                    className="
            bg-primary text-surface px-4 py-2 rounded hover:bg-accent
            transition
          "
                >
                    + Add Subject
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {subjects.map((subject) => (
                    <SubjectCard
                        key={subject.id}
                        title={subject.title}
                        image={subject.image}
                    />
                ))}
            </div>
        </div>
    );
}