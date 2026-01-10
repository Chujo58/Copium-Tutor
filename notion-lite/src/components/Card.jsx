import React, { useState } from "react";
import { FileText, FileSpreadsheet } from "lucide-react";
import Popup from "./Popup";
import { API_URL } from "../config";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";



// Subject Card for the general subjects like projects, notes, etc.
export default function SubjectCard({ title, image }) {
    return (
        <div
            className="
      m-4 rounded-lg cursor-pointer transition ease-in-out
      shadow hover:shadow-md
      bg-dark
      text-surface 
      hover:bg-rose-water
      hover:text-dark
    "
        >
            {image ? (
                <img
                    src={image}
                    alt={title}
                    className="mb-2 w-full h-40 object-cover rounded-t-lg"
                />
            ) : (
                <div
                    className="
            mb-2 w-full h-40 rounded-t-lg
            bg-accent/30
          "
                />
            )}

            <h3 className="p-4 pt-1 main-header font-card">{title}</h3>
        </div>
    );
}    
// Document Card for individual documents within a subject (uploaded documents), the top of the Card shows the document preview, and the bottom shows a document icon and the title (should somehow be grabbed from the uploaded file metadata)
export function DocumentCard({ docTitle, docType, id }) {
    const [open, setOpen] = useState(false);
    const [thumb, setThumb] = useState(null);
    const [thumbError, setThumbError] = useState(false);
    const [filepath, setFilepath] = useState("");

    const icon = docType === "spreadsheet" ? <FileSpreadsheet /> : <FileText />;
    const preview = docType === "pdf";

    
    // Fetch the path from id
    async function fetchFilePath(id) {
        try {
            const response = await fetch(`${API_URL}/files/${id}/path`);
            const data = await response.json();
            // console.log("Fetched file path data:", data);
            if (data.success) {
                // API returns an absolute filesystem path; use the file download endpoint instead
                const fileUrl = `${API_URL}/files/${id}`;
                setFilepath(fileUrl);
                // console.log("File URL set to:", fileUrl);
            } else {
                console.error("Failed to fetch file path:", data.message);
            }
        } catch (error) {
            console.error("Error fetching file path:", error);
        }
    }

    React.useEffect(() => {
        fetchFilePath(id);
    }, [id]);

    React.useEffect(() => {
        if (!preview || !filepath) return;
        let cancelled = false;

        (async () => {
            try {
                if (!preview) return;

                const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf");
                pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

                const loadingTask = pdfjsLib.getDocument(filepath);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);
                const viewport = page.getViewport({ scale: 1.5 });

                
                const canvas = document.createElement("canvas");
                const context = canvas.getContext("2d");
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                await page.render({ canvasContext: context, viewport }).promise;
                const dataUrl = canvas.toDataURL("image/png");
                if (!cancelled) setThumb(dataUrl);
                // cleanup
                try {
                    pdf.destroy?.();
                } catch (e) {}
            } catch (err) {
                if (!cancelled) setThumbError(true);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [filepath, preview]);

    return (
        <>
            <div
                onClick={() => setOpen(true)}
                className={
                    "m-4 rounded-lg cursor-pointer transition ease-in-out shadow hover:shadow-md bg-dark text-surface hover:bg-rose-water hover:text-dark"
                }
            >
                {preview ? (
                    <div className="mb-2 w-full h-40 rounded-t-lg overflow-hidden bg-black/5 flex items-center justify-center">
                        {thumb ? (
                            <img src={thumb} alt={docTitle} className="w-full h-full object-cover" />
                        ) : thumbError ? (
                            <div className="w-full h-full bg-accent/30 flex items-center justify-center text-2xl">
                                {icon}
                            </div>
                        ) : (
                            <div className="w-full h-full bg-accent/10 flex items-center justify-center text-sm text-gray-400">
                                Loading preview...
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className="mb-2 w-full h-40 rounded-t-lg bg-accent/30 flex items-center justify-center"
                    ></div>
                )}

                <h3 className="p-4 pt-1 main-header font-card items-center gap-2 flex">{icon} {docTitle}</h3>
            </div>

            {open && (
                <Popup title={docTitle} onClose={() => setOpen(false)} wide>
                    <div className="w-full h-[75vh]">
                        <iframe
                            src={filepath}
                            title={docTitle}
                            className="w-full h-full"
                        />
                    </div>
                </Popup>
            )}
        </>
    );
}