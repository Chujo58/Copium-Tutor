import { RefreshCw, ExternalLink, TableOfContents, Upload, Trash2, Plus } from "lucide-react";

export default function CustomButton({ onClick, disabled, label, icon: Icon, loading = null, style="btn secondary", title="" }) {
    return (
        <button className={`${style} disabled:opacity-70 disabled:cursor-not-allowed`} onClick={onClick} disabled={disabled} title={title} type="button">
            {loading !== null ? (
                <>
                    <Icon size={14} className={loading ? "animate-spin" : ""} />
                    {loading ? "Refreshing…" : label}
                </>
            ) : (
                <>
                    {Icon && <Icon size={14} />}
                    {label}
                </>
            )}
        </button>
    );
}

export function RefreshButton({ onClick, loading, disabled, title="Refresh documents", style="btn secondary" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Refresh" icon={RefreshCw} loading={loading} title={title} style={style} />
    )
}

export function OpenButton({ onClick, disabled, title="Open page", style }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Open" icon={ExternalLink} title={title} style={style} />
    )
}

export function IndexButton({ onClick, indexing, disabled, title="Index documents", style="btn secondary" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Index" icon={TableOfContents} loading={indexing} title={title} style={style} />
    )
}

export function UploadButton({ onClick, disabled, title="Upload documents", style="btn primary main-header font-card" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Upload" icon={Upload} style={style} title={title} />
    )
}

export function ClearButton({ onClick, disabled, title="Clear", style="btn secondary" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Clear" icon={Trash2} title={title} style={style} />
    )
}

export function DeleteButton({ onClick, disabled, title="Delete", style="btn secondary" , noLabel=false}) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label={noLabel ? "" : "Delete"} icon={Trash2} title={title} style={style} />
    )
}

export function CreateButton({ onClick, disabled, label="Create", loading, title="Create", style="btn primary dark main-header large-y" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label={label} icon={Plus} loading={loading} title={title} style={style} />
    )
}