import React, { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import SubjectCard from "./Card";
import { Link } from "react-router-dom";
import CardContextMenu from "./CardContextMenu";

// Gallery view for subjects. Right-click a card to edit/delete it.
export default function GalleryView({ subjects, onAddSubject, onDeleteSubject, onEditSubject }) {
    const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, subject: null });

    function openCardMenu(e, subject) {
        e.preventDefault();
        e.stopPropagation();
        setMenu({ visible: true, x: e.clientX, y: e.clientY, subject });
    }

    function closeMenu() {
        setMenu({ visible: false, x: 0, y: 0, subject: null });
    }

    return (
        <div className="p-6 bg-dark/75 min-w-screen rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl text-sans text-surface">Your Subjects</h1>
                <button
                    onClick={onAddSubject}
                    className={
                        "btn primary dark large-y font-card main-header"
                    }
                >
                    <Plus size={18} />
                    Add Subject
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {subjects.map((subject) => (
                    <div
                        key={subject.projectid}
                        className="relative"
                        onContextMenu={(e) => openCardMenu(e, subject)}
                    >
                        <Link to={`/project/${subject.projectid}`} className="block">
                            <SubjectCard
                                title={subject.name}
                                description={subject.description}
                                image={subject.image}
                                color={subject.color}
                                icon={subject.icon}
                            />
                        </Link>
                        {onDeleteSubject ? (
                            <button
                                type="button"
                                className="absolute top-3 right-3 rounded-full bg-white/80 p-2.5 text-xs text-dark shadow hover:bg-white/90 transition"
                                onClick={(e) => {
                                    // open the card context menu near the button
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    setMenu({
                                        visible: true,
                                        x: Math.max(rect.left, 8),
                                        y: rect.bottom + 6,
                                        subject,
                                    });
                                }}
                                title="Options"
                            >
                                <MoreHorizontal size={14} />
                            </button>
                        ) : null}
                    </div>
                ))}
            </div>

            {menu.visible && (
                <CardContextMenu
                    subject={menu.subject}
                    pos={{ x: menu.x, y: menu.y }}
                    onClose={closeMenu}
                    onEdit={(s) => {
                        closeMenu();
                        onEditSubject?.(s);
                    }}
                    onDelete={(s) => {
                        closeMenu();
                        onDeleteSubject?.(s);
                    }}
                />
            )}
        </div>
    );
}
