import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { Folder } from "lucide-react";
import { API_URL } from "../config";

export default function CoursePage() {
  const { projectId } = useParams();

  const [projects, setProjects] = useState([]);
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/projects`, {
        credentials: "include",
        method: "GET",
      });

      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();

      if (data.success) {
        setProjects(data.projects);
        const found = data.projects.find(
          (p) => p.projectid === projectId
        );
        setCourse(found ?? null);
      }
    } catch (err) {
      console.error(err);
      setProjects([]);
      setCourse(null);
    } finally {
      setLoading(false);
    }
  };

  fetchProjects();
}, [projectId]);

  const projectsList = useMemo(() => {
    return projects.map((project) => ({
      name: project.name,
      href: `/project/${project.projectid}`, // keep consistent with dashboard 
    }));
  }, [projects]);

  return (
    <div className="flex">
      <Sidebar projectsList={projectsList} />

      <div className="flex-1 p-10 overflow-auto bg-rose-china h-screen">

        {loading ? (
          <div className="mt-6">Loading course…</div>
        ) : !course ? (
          <div className="mt-6">
            <div className="text-2xl font-semibold">Course not found</div>
            <div className="opacity-70">
              (Either the course doesn’t exist, or you’re not logged in.)
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4">
              <div className="text-3xl main-header font-sans text-dark">
                {course.name}
              </div>

              {course.description ? (
                <div className="mt-1 opacity-80">{course.description}</div>
              ) : null}

              <div className="mt-2 text-sm opacity-60">
                projectId: {course.projectid} (for debugging)
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Documents</h2>
              <div className="opacity-70">
                (Document upload & list goes here)
              </div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Flashcards</h2>
              <div className="opacity-70">(Deck list goes here)</div>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-semibold">Quizzes</h2>
              <div className="opacity-70">(Quiz list goes here)</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
