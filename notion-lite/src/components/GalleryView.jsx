import SubjectCard from "./Card";
import { Link } from "react-router-dom";

//  This stuff should create a gallery view for subjects for a user. The gallery should also show some button to add a new subject.
export default function GalleryView({ subjects, onAddSubject, onDeleteSubject }) {
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
                <div key={subject.projectid} className="relative">
                    <Link
                        to={`/project/${subject.projectid}`}
                        className="block"
                    >
                        <SubjectCard
                            key={subject.projectid}
                            title={subject.name}
                            description={subject.description}
                            image={subject.image}
                            color={subject.color}
                            icon={subject.icon}
                        />
                    </Link>
                    {onDeleteSubject ? (
                        <button
                            className="absolute right-6 top-6 z-10 rounded bg-white/80 px-2 py-1 text-xs font-semibold text-red-700 shadow-sm hover:bg-white"
                            type="button"
                            onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                onDeleteSubject(subject);
                            }}
                        >
                            Delete
                        </button>
                    ) : null}
                </div>
                ))}
            </div>
        </div>
    );
}
