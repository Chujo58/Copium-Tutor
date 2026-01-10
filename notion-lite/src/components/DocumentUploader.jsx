import { useState } from "react";
import { API_URL } from "../config";


export function DocumentUploader({ projectsList }) {
    // If the projectsList is only one project, we default to that project for file uploads.
    
}


export default function DriveStyleUploader() {
    const [files, setFiles] = useState([]);
    const [previewFile, setPreviewFile] = useState(null);
    const [selectedProject, setSelectedProject] = useState("All");

    const projects = ["All", "test", "Project A", "Project B", "Project C"];

    // Handle dropped files
    const handleDrop = (e) => {
        e.preventDefault();
        const droppedFiles = Array.from(e.dataTransfer.files);
        const mappedFiles = droppedFiles.map((file) => ({
            file,
            id: Date.now() + Math.random(),
            project: selectedProject || "All",
            thumbnail: null,
            progress: 0,
        }));
        setFiles((prev) => [...prev, ...mappedFiles]);

        // Generate thumbnails for PDFs
        // mappedFiles.forEach((f) => {
        //     if (f.file.type.includes("pdf")) {
        //         generatePDFThumbnail(f.file).then((thumb) => {
        //             setFiles((prev) =>
        //                 prev.map((pf) =>
        //                     pf.id === f.id ? { ...pf, thumbnail: thumb } : pf
        //                 )
        //             );
        //         });
        //     }
        // });

        // Upload to backend
        mappedFiles.forEach(uploadFile);
    };

    const handleDragOver = (e) => e.preventDefault();
    const removeFile = (id) => setFiles(files.filter((f) => f.id !== id));

    const filteredFiles =
        selectedProject === "All"
            ? files
            : files.filter((f) => f.project === selectedProject);

    // Generate thumbnail for PDF (first page)
    const generatePDFThumbnail = async (file) => {
        // Using pdfjs-dist for client-side PDF rendering
        const pdfjsLib = await import("pdfjs-dist/build/pdf");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.101/pdf.worker.min.js";
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: context, viewport }).promise;
        return canvas.toDataURL();
    };

    // Upload file to backend with progress
    const uploadFile = (f) => {
        // Do it with fetch:
        const formData = new FormData();
        formData.append("file", f.file);
        formData.append("project", f.project);

        fetch(`${API_URL}/upload`, {
            method: "POST",
            body: formData,
            credentials: "include",
        }).then((response) => {
            if (!response.ok) {
                console.error("Upload failed:", response.statusText);
            } else {
                console.log("Upload successful");
            }
        });
        // const formData = new FormData();
        // formData.append("file", f.file);
        // formData.append("project", f.project);

        // const xhr = new XMLHttpRequest();
        // xhr.open("POST", `${API_URL}/upload`);
        // xhr.upload.onprogress = (e) => {
        //     if (e.lengthComputable) {
        //         const progress = Math.round((e.loaded / e.total) * 100);
        //         setFiles((prev) =>
        //             prev.map((pf) =>
        //                 pf.id === f.id ? { ...pf, progress } : pf
        //             )
        //         );
        //     }
        // };
        // xhr.send(formData);
    };

    return (
        <div className="max-w-4xl mx-auto mt-10">
            <h2 className="text-xl font-semibold mb-4 text-center">
                Document Manager
            </h2>

            {/* Project Filter */}
            <div className="mb-4 flex justify-end">
                <select
                    className="border rounded px-2 py-1"
                    value={selectedProject}
                    onChange={(e) => setSelectedProject(e.target.value)}
                >
                    {projects.map((p) => (
                        <option key={p} value={p}>
                            {p}
                        </option>
                    ))}
                </select>
            </div>

            {/* Gallery */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                {filteredFiles.map((f) => (
                    <div
                        key={f.id}
                        className="relative border rounded p-2 flex flex-col items-center justify-center hover:shadow-lg cursor-pointer"
                    >
                        <div
                            className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded overflow-hidden"
                            onClick={() => setPreviewFile(f)}
                        >
                            {f.thumbnail ? (
                                <img
                                    src={f.thumbnail}
                                    alt={f.file.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <span
                                    className={`font-bold ${
                                        f.file.type.includes("pdf")
                                            ? "text-red-600"
                                            : "text-blue-600"
                                    }`}
                                >
                                    {f.file.type.includes("pdf")
                                        ? "PDF"
                                        : "DOC"}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-center mt-1 truncate w-16">
                            {f.file.name}
                        </p>

                        {/* Remove button */}
                        <button
                            onClick={() => removeFile(f.id)}
                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 hover:opacity-100 transition"
                        >
                            ×
                        </button>

                        {/* Progress bar */}
                        {f.progress > 0 && f.progress < 100 && (
                            <div className="w-full h-1 bg-gray-200 rounded mt-1">
                                <div
                                    className="h-1 bg-rose-600 rounded"
                                    style={{ width: `${f.progress}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Drag & Drop Zone */}
            <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg h-40 flex items-center justify-center cursor-pointer hover:border-rose-500 transition-colors text-gray-400 text-center"
            >
                Drag & drop files here
            </div>

            {/* Preview Popup */}
            {previewFile && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-4 max-w-2xl w-full relative">
                        <button
                            onClick={() => setPreviewFile(null)}
                            className="absolute top-2 right-2 text-red-500 text-lg font-bold"
                        >
                            ×
                        </button>

                        <h3 className="font-semibold mb-2">
                            {previewFile.file.name}
                        </h3>

                        {previewFile.file.type.includes("pdf") ? (
                            <iframe
                                src={URL.createObjectURL(previewFile.file)}
                                className="w-full h-96"
                            />
                        ) : (
                            <p className="text-gray-600">
                                Preview not available for this file type. You
                                can download it.
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
