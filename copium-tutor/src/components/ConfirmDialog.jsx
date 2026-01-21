import React, { useState } from "react";

export default function ConfirmDialog({
    open,
    title = "Confirm",
    message = "Are you sure?",
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
}) {
    const [armed, setArmed] = useState(false);

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
                className="absolute inset-0 bg-black/60"
                onClick={onCancel}
            />

            <div className={`relative w-full max-w-md rounded-2xl p-6 shadow-lg confirm-modal ${armed ? "armed" : ""}`}>
                <style>{`
                  .confirm-modal { background: rgba(255,255,255,0.92); border: 1px solid rgba(0,0,0,0.06); }
                  .confirm-modal.armed { background: linear-gradient(135deg, rgba(255,240,240,0.98), rgba(255,230,230,0.98)); border-color: rgba(220,38,38,0.9); transform-origin: center; animation: danger-swoop 420ms cubic-bezier(.2,.9,.3,1); }
                  @keyframes danger-swoop {
                    0% { transform: perspective(600px) translateY(6px) rotateX(6deg) scale(0.995); filter: saturate(0.95) hue-rotate(0deg); }
                    40% { transform: perspective(600px) translateY(-4px) rotateX(-2deg) scale(1.01); filter: saturate(1.05) hue-rotate(-6deg); }
                    100% { transform: perspective(600px) translateY(0) rotateX(0) scale(1); filter: saturate(1) hue-rotate(0deg); }
                  }
                  .confirm-modal.armed .title, .confirm-modal.armed .message { color: #7f1d1d; }
                `}</style>

                <div className="text-lg font-semibold text-dark title">{title}</div>
                <div className="mt-3 text-sm text-dark/80 message">{message}</div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="rounded-xl border border-black/10 bg-white/70 px-4 py-2 text-sm text-dark hover:bg-white transition"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        onMouseEnter={() => setArmed(true)}
                        onMouseLeave={() => setArmed(false)}
                        onFocus={() => setArmed(true)}
                        onBlur={() => setArmed(false)}
                        onTouchStart={() => setArmed(true)}
                        onTouchEnd={() => setArmed(false)}
                        onClick={onConfirm}
                        className="rounded-xl bg-rose-600 text-white px-4 py-2 text-sm hover:bg-rose-700 transition"
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
