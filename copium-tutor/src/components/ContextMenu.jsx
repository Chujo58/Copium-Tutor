import React, { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";

export default function ContextMenu() {
    const [visible, setVisible] = useState(false);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const menuRef = useRef(null);

    useEffect(() => {
        function handleContext(e) {
            e.preventDefault();
            setPos({ x: e.clientX, y: e.clientY });
            setVisible(true);
        }

        function handleClick(e) {
            if (!menuRef.current) return setVisible(false);
            if (!menuRef.current.contains(e.target)) setVisible(false);
        }

        function handleKey(e) {
            if (e.key === "Escape") setVisible(false);
        }

        window.addEventListener("contextmenu", handleContext);
        window.addEventListener("mousedown", handleClick);
        window.addEventListener("scroll", () => setVisible(false));
        window.addEventListener("keydown", handleKey);

        return () => {
            window.removeEventListener("contextmenu", handleContext);
            window.removeEventListener("mousedown", handleClick);
            window.removeEventListener("scroll", () => setVisible(false));
            window.removeEventListener("keydown", handleKey);
        };
    }, []);

    function doBack() {
        setVisible(false);
        try {
            window.history.back();
        } catch (e) {
            // noop
        }
    }

    function doForward() {
        setVisible(false);
        try {
            window.history.forward();
        } catch (e) {
            // noop
        }
    }

    function doReload() {
        setVisible(false);
        try {
            window.location.reload();
        } catch (e) {
            // noop
        }
    }

    if (!visible) return null;

    // simple bounds checking so menu doesn't overflow right/bottom
    const style = {
        position: "fixed",
        top: pos.y + "px",
        left: pos.x + "px",
        zIndex: 9999,
    };

    return (
        <div style={style} ref={menuRef} className="z-50">
            <div className="bg-dark text-surface rounded-md shadow-lg border border-surface/10 w-44 py-1 font-card font-medium">
                <div
                    onClick={doBack}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-rose-water hover:text-dark cursor-pointer"
                >
                    <ArrowLeft size={16} />
                    <span>Back</span>
                </div>
                <div
                    onClick={doForward}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-rose-water hover:text-dark cursor-pointer"
                >
                    <ArrowRight size={16} />
                    <span>Forward</span>
                </div>
                <div
                    onClick={doReload}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-rose-water hover:text-dark cursor-pointer"
                >
                    <RefreshCw size={16} />
                    <span>Reload</span>
                </div>
            </div>
        </div>
    );
}
