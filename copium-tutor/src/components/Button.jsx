import { RefreshCw, ExternalLink, TableOfContents, Upload } from "lucide-react";

export default function CustomButton({ onClick, disabled, label, icon: Icon, loading = null, primary = false }) {
    return (
        <button className={primary ? "primary-btn" : "secondary-btn"} onClick={onClick} disabled={disabled}>
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

export function RefreshButton({ onClick, loading, disabled }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Refresh" icon={RefreshCw} loading={loading}  />
    )
}

export function OpenButton({ onClick, disabled }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Open" icon={ExternalLink} />
    )
}

export function IndexButton({ onClick, indexing, disabled }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Index" icon={TableOfContents} loading={indexing} />
    )
}

export function UploadButton({ onClick, disabled }) {
    return (
        <CustomButton onClick={onClick} disabled={disabled} label="Upload" icon={Upload} primary />
    )
}