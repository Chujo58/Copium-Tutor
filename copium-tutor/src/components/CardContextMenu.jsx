import React, { useEffect, useRef } from "react";
import { Edit3, Trash } from "lucide-react";

export default function CardContextMenu({ subject, pos, onClose, onEdit, onDelete }) {
    const ref = useRef(null);

    useEffect(() => {
        function handleClick(e) {
            if (!ref.current) return;
            if (!ref.current.contains(e.target)) onClose?.();
        }

        function handleKey(e) {
            if (e.key === "Escape") onClose?.();
        }

        window.addEventListener("mousedown", handleClick);
        window.addEventListener("keydown", handleKey);

        return () => {
            window.removeEventListener("mousedown", handleClick);
            window.removeEventListener("keydown", handleKey);
        };
    }, [onClose]);

    if (!subject) return null;

    const style = {
        position: "fixed",
        top: pos.y + "px",
        left: pos.x + "px",
        zIndex: 10000,
    };

    return (
        <div style={style} ref={ref} className="z-50">
            <div className="bg-dark text-surface rounded-md shadow-lg border border-surface/10 w-44 py-1 font-card font-medium">
                <div
                    onClick={() => {
                        onClose?.();
                        onEdit?.(subject);
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-rose-water hover:text-dark cursor-pointer"
                >
                    <Edit3 size={16} />
                    <span>Edit</span>
                </div>

                <div
                    onClick={() => {
                        onClose?.();
                        onDelete?.(subject);
                    }}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-red-600 hover:text-white cursor-pointer"
                >
                    <Trash size={16} />
                    <span>Delete</span>
                </div>
            </div>
        </div>
    );
}
