import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { API_URL } from "../config";
import * as Icons from "lucide-react";
import { Folder, Sparkles, Layers, FileText, MessageSquare, CheckCircle2 } from "lucide-react";

function Badge({ label }) {
  return (
    <span className="inline-flex items-center rounded-full border border-surface bg-white/70 px-2.5 py-1 text-xs text-dark">
      {label}
    </span>
  );
}

function FeatureCard({ id, icon: Icon, title, description, steps, badges, delay = 0 }) {
  return (
    <div
      id={id}
      className="feature-card rounded-3xl border border-white/40 bg-white/60 backdrop-blur p-6 shadow-sm scroll-mt-24"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface/60 text-dark">
          <Icon size={20} />
        </div>
        <div>
          <div className="text-xl font-semibold text-dark">{title}</div>
          <div className="text-sm text-dark/70">{description}</div>
        </div>
      </div>

      {badges?.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {badges.map((label) => (
            <Badge key={label} label={label} />
          ))}
        </div>
      ) : null}

      <ul className="mt-4 space-y-2 text-sm text-dark/80">
        {steps.map((step) => (
          <li key={step} className="flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 text-primary" />
            <span>{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function FeaturesPage() {
  const [projects, setProjects] = useState([]);

  const featureLinks = [
    { href: "/features", icon: Sparkles, name: "Feature guide", color: "#754B4D" },
  ];

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_URL}/projects`, {
          credentials: "include",
          method: "GET",
        });
        const data = await res.json();
        if (data.success) {
          setProjects(data.projects || []);
        } else {
          setProjects([]);
        }
      } catch (err) {
        console.error(err);
        setProjects([]);
      }
    };

    fetchProjects();
  }, []);

  return (
    <div className="flex">
      <Sidebar
        projectsList={[
          ...projects.map((project) => ({
            projectid: project.projectid,
            name: project.name,
            href: `/project/${project.projectid}`,
            description: project.description,
            image: project.image,
            icon:
              project.icon in Icons && project.icon !== null
                ? Icons[project.icon]
                : Folder,
            color: project.color !== null ? project.color : "#754B4D",
          })),
        ]}
        featureLinks={featureLinks}
      />

      <div className="flex-1 h-screen overflow-auto bg-gradient-to-b from-[#F6EFEA] via-surface/35 to-[#F6EFEA]">
        <div className="p-10">
          <style>{`
            .feature-card {
              opacity: 0;
              transform: translateX(-28px) translateY(18px);
              animation: feature-slide-in 600ms ease-out forwards;
            }
            .pro-tips {
              opacity: 0;
              transform: translateX(28px) translateY(18px);
              animation: feature-slide-in-opposite 600ms ease-out forwards;
              animation-delay: 320ms;
            }
            @keyframes feature-slide-in {
              0% {
                opacity: 0;
                transform: translateX(-28px) translateY(18px);
              }
              100% {
                opacity: 1;
                transform: translateX(0) translateY(0);
              }
            }
            @keyframes feature-slide-in-opposite {
              0% {
                opacity: 0;
                transform: translateX(28px) translateY(18px);
              }
              100% {
                opacity: 1;
                transform: translateX(0) translateY(0);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .feature-card {
                animation: none;
                opacity: 1;
                transform: none;
              }
              .pro-tips {
                animation: none;
                opacity: 1;
                transform: none;
              }
            }
          `}</style>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-dark hover:opacity-80"
          >
            <span className="px-2 py-1 rounded-lg border border-surface bg-white/50">←</span>
            Back to Dashboard
          </Link>

          <div className="mt-6 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/60 text-dark">
                <Sparkles size={22} />
              </div>
              <div>
                <div className="text-3xl font-semibold text-dark">Feature Guide</div>
                <div className="text-sm text-dark/70">
                  Learn the core workflows for flashcards, quizzes, and chat.
                </div>
              </div>
            </div>

            <div className="mt-4 text-sm text-dark/70">
              Quick start: create a subject, upload documents, click Index documents, then explore the tools below.
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <FeatureCard
              id="flashcards"
              icon={Layers}
              title="Flashcards"
              description="Generate study cards from your course docs."
              delay={0}
              steps={[
                "Open a subject and go to Flashcards.",
                "Create a deck with a clear study prompt.",
                "Review cards and rate them to schedule repeats.",
              ]}
            />

            <FeatureCard
              id="quizzes"
              icon={FileText}
              title="Quizzes"
              description="Practice with MCQ, short, or long answers."
              badges={["MCQ", "Short", "Long"]}
              delay={120}
              steps={[
                "Go to Quizzes and choose a topic.",
                "Select documents and quiz type.",
                "Submit answers to get score + feedback.",
              ]}
            />

            <FeatureCard
              id="chat"
              icon={MessageSquare}
              title="Chat with the bot"
              description="Ask questions and get answers grounded in your notes."
              delay={240}
              steps={[
                "Open a subject and start a chat.",
                "Ask about concepts, examples, or summaries.",
                "Use follow-ups to refine the explanation.",
              ]}
            />
          </div>

          <div className="pro-tips mt-8 rounded-3xl border border-white/40 bg-white/55 backdrop-blur p-6 shadow-sm">
            <div className="text-lg font-semibold text-dark">Pro tips</div>
            <div className="mt-3 grid gap-3 text-sm text-dark/75 md:grid-cols-2">
              <div>Index documents after uploads so quizzes and chat can use them.</div>
              <div>Keep quiz topics focused for faster, higher quality results.</div>
              <div>Use flashcard prompts like “exam 2 key formulas” for targeted decks.</div>
              <div>Chat is best for clarifying topics you just studied or missed on a quiz.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
