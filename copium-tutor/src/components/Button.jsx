import { RefreshCw, ExternalLink, TableOfContents, Upload } from "lucide-react";

export default function CustomButton({ onClick, disabled, label, icon: Icon, loading = null, style="secondary-btn", title="" }) {
    return (
        <button className={style} onClick={onClick} disabled={disabled} title={title}>
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

export function RefreshButton({ onClick, loading, disabled, title="Refresh documents" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Refresh" icon={RefreshCw} loading={loading} title={title} />
    )
}

export function OpenButton({ onClick, disabled, title="Open page" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Open" icon={ExternalLink} title={title} />
    )
}

export function IndexButton({ onClick, indexing, disabled, title="Index documents" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Index" icon={TableOfContents} loading={indexing} title={title} />
    )
}

export function UploadButton({ onClick, disabled, title="Upload documents" }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Upload" icon={Upload} primary title={title} />
    )
}