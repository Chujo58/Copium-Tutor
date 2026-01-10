import SubjectCard from "./Card";

//  This stuff should create a gallery view for subjects for a user. The gallery should also show some button to add a new subject.
export default function GalleryView({ subjects, onAddSubject }) {
    return (
        <div className="p-6 bg-dark/75 min-w-screen rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl text-sans text-surface">Your Subjects</h1>
                <button
                    onClick={onAddSubject}
                    className="
            bg-dark text-surface px-4 py-2 rounded hover:bg-rose-water hover:text-dark ease-in-out font-card main-header transition
          "
                >
                    + Add Subject
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {subjects.map((subject) => (
                    <SubjectCard
                        key={subject.projectid}
                        title={subject.name}
                        description={subject.description}
                        image={subject.image}
                        color={subject.color}
                        icon={subject.icon}
                    />
                ))}
            </div>
        </div>
    );
}