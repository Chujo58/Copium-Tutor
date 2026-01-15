import React, { useState } from "react";
import { FileText, FileSpreadsheet, CircleX } from "lucide-react";
import Popup from "./Popup";
import { API_URL } from "../config";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

function getContrastTextColor(hex) {
    // Remove the hash if present
    hex = hex.replace("#", "");

    // Parse r, g, b values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return black for bright colors, white for dark colors
    return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

function darkenHex(hex, amount = 0.1) {
    // Remove hash if present
    hex = hex.replace("#", "");

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Reduce each channel by the given amount
    const newR = Math.max(Math.min(Math.round(r * (1 - amount)), 255), 0);
    const newG = Math.max(Math.min(Math.round(g * (1 - amount)), 255), 0);
    const newB = Math.max(Math.min(Math.round(b * (1 - amount)), 255), 0);

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, "0")}${newG
        .toString(16)
        .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
}

function IconWrapper({ iconNode, size = 24, color = "currentColor" }) {
    if (!iconNode) return null;

    // iconNode is a component, so you render it as JSX
    const IconComponent = iconNode;

    return (
        <IconComponent
            size={size}
            color={color}
            className="inline-block mr-2"
        />
    );
}

// Subject Card for the general subjects like projects, notes, etc.
export default function SubjectCard({
    title,
    image,
    description,
    color,
    icon,
}) {
    const [isHover, setIsHover] = useState(false);

    return (
        <div
            className={`m-4 rounded-lg cursor-pointer transition ease-in-out shadow hover:shadow-md`}
            // Show description on hover like a tooltip
            // title={description}
            style={{
                backgroundColor: isHover ? darkenHex(color, 0.25) : color,
                color: getContrastTextColor(
                    isHover ? darkenHex(color, 0.25) : color
                ),
            }}
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
        >
            {image ? (
                <img
                    src={image}
                    alt={title}
                    className="mb-2 w-full h-40 object-cover rounded-t-lg"
                />
            ) : (
                <div
                    className={`mb-2 w-full h-40 rounded-t-lg
            bg-white/30
          `}
                />
            )}

            <h3 className="p-4 pt-1 main-header font-card flex">
                {<IconWrapper iconNode={icon} />} {title}
            </h3>
        </div>
    );
}

export function DocumentCard({ docTitle, docType, id, onDeleted }) {
    const icon = docType === "spreadsheet" ? <FileSpreadsheet /> : <FileText />;
    const [backendFile, setBackendFile] = useState(null);
    const [showDocPreview, setDocPreview] = useState(false);

    React.useEffect(() => {
        // Fetch file metadata from backend
        async function fetchFileMetadata() {
            try {
                const response = await fetch(`${API_URL}/files/${id}`, {
                    method: "GET",
                    credentials: "include",
                });
                const data = await response.blob();
                setBackendFile(data);
            } catch (error) {
                console.error("Error fetching file metadata:", error);
            }
        }

        fetchFileMetadata();
    }, [id]);

    if (!backendFile) {
        return (
            <div className="m-4 p-4 rounded-xl bg-accent/30 shadow animate-pulse">
                Loading...
            </div>
        );
    }

    // A simple card showing the document icon and title with a delete button at the top right to remove the document from existence.
    return (
        <>
            <div
                className="
            flex items-center justify-between
            rounded-xl bg-accent/30 shadow
            px-4 py-4
            transition hover:shadow-md
        "
                onClick={() => setDocPreview(true)}
            >
                {/* Left side: icon + text */}
                <div
                    className="flex items-center gap-4 overflow-hidden"
                    // Add click to show preview:
                >
                    {/* File icon */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/40">
                        <div className="text-2xl text-dark">{icon}</div>
                    </div>

                    {/* File info */}
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium text-dark truncate">
                            {docTitle}
                        </span>
                        <span className="text-sm text-muted">
                            {/* optional: file size or type */}
                            {/* 3 MB */}
                        </span>
                    </div>
                </div>

                {/* Delete button */}
                <button
                    className="ml-4 text-muted text-dark hover:text-red-600 transition"
                    onClick={(e) => {
                        e.stopPropagation();
                        fetch(`${API_URL}/files/${id}`, {
                            method: "DELETE",
                            credentials: "include",
                        })
                            .then((res) => res.json())
                            .then((data) => {
                                if (!data.success) {
                                    console.error(
                                        `Failed to delete document: ${data.message}`
                                    );
                                }
                            })
                            .catch((err) => {
                                console.error(err);
                                alert("Error deleting document");
                            });
                        onDeleted?.();
                    }}
                >
                    <CircleX />
                </button>
            </div>
            {showDocPreview && (
                <Popup
                    title={docTitle}
                    onClose={() => setDocPreview(false)}
                    wide
                >
                    <div className="w-full h-[75vh]">
                        <iframe
                            src={URL.createObjectURL(backendFile)}
                            title={docTitle}
                            className="w-full h-full"
                        />
                    </div>
                </Popup>
            )}
        </>
    );
}

// // Document Card for individual documents within a subject (uploaded documents), the top of the Card shows the document preview, and the bottom shows a document icon and the title (should somehow be grabbed from the uploaded file metadata)
// export function DocumentCard({ docTitle, docType, id }) {
//     const [open, setOpen] = useState(false);
//     const [thumb, setThumb] = useState(null);
//     const [thumbError, setThumbError] = useState(false);
//     const [filepath, setFilepath] = useState("");

//     const icon = docType === "spreadsheet" ? <FileSpreadsheet /> : <FileText />;
//     const preview = docType === "pdf";

//     // Fetch the path from id
//     async function fetchFilePath(id) {
//         try {
//             const response = await fetch(`${API_URL}/files/${id}/path`);
//             const data = await response.json();
//             // console.log("Fetched file path data:", data);
//             if (data.success) {
//                 // API returns an absolute filesystem path; use the file download endpoint instead
//                 const fileUrl = `${API_URL}/files/${id}`;
//                 setFilepath(fileUrl);
//                 // console.log("File URL set to:", fileUrl);
//             } else {
//                 console.error("Failed to fetch file path:", data.message);
//             }
//         } catch (error) {
//             console.error("Error fetching file path:", error);
//         }
//     }

//     React.useEffect(() => {
//         fetchFilePath(id);
//     }, [id]);

//     React.useEffect(() => {
//         if (!preview || !filepath) return;
//         let cancelled = false;

//         (async () => {
//             try {
//                 if (!preview) return;

//                 const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
//                 pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

//                 const loadingTask = pdfjsLib.getDocument(filepath);
//                 const pdf = await loadingTask.promise;
//                 const page = await pdf.getPage(1);
//                 const viewport = page.getViewport({ scale: 1.5 });

//                 const canvas = document.createElement("canvas");
//                 const context = canvas.getContext("2d");
//                 canvas.width = viewport.width;
//                 canvas.height = viewport.height;

//                 await page.render({ canvasContext: context, viewport }).promise;
//                 const dataUrl = canvas.toDataURL("image/png");
//                 if (!cancelled) setThumb(dataUrl);
//                 // cleanup
//                 try {
//                     pdf.destroy?.();
//                 } catch (e) {}
//             } catch (err) {
//                 if (!cancelled) setThumbError(true);
//             }
//         })();

//         return () => {
//             cancelled = true;
//         };
//     }, [filepath, preview]);

//     return (
//         <>
//             <div
//                 onClick={() => setOpen(true)}
//                 className={
//                     "m-4 rounded-lg cursor-pointer transition ease-in-out shadow hover:shadow-md bg-dark text-surface hover:bg-rose-water hover:text-dark"
//                 }
//             >
//                 {preview ? (
//                     <div className="mb-2 w-full h-40 rounded-t-lg overflow-hidden bg-black/5 flex items-center justify-center">
//                         {thumb ? (
//                             <img
//                                 src={thumb}
//                                 alt={docTitle}
//                                 className="w-full h-full object-cover"
//                             />
//                         ) : thumbError ? (
//                             <div className="w-full h-full bg-accent/30 flex items-center justify-center text-2xl">
//                                 {icon}
//                             </div>
//                         ) : (
//                             <div className="w-full h-full bg-accent/10 flex items-center justify-center text-sm text-gray-400">
//                                 Loading preview...
//                             </div>
//                         )}
//                     </div>
//                 ) : (
//                     <div className="mb-2 w-full h-40 rounded-t-lg bg-accent/30 flex items-center justify-center"></div>
//                 )}

//                 <h3 className="p-4 pt-1 main-header font-card items-center gap-2 flex">
//                     {icon} {docTitle}
//                 </h3>
//             </div>

//             {open && (
//                 <Popup title={docTitle} onClose={() => setOpen(false)} wide>
//                     <div className="w-full h-[75vh]">
//                         <iframe
//                             src={filepath}
//                             title={docTitle}
//                             className="w-full h-full"
//                         />
//                     </div>
//                 </Popup>
//             )}
//         </>
//     );
// }
