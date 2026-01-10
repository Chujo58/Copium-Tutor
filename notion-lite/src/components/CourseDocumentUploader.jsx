import { useState } from "react";
import { API_URL } from "../config";

export default function CourseDocumentUploader({ projectName, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  const uploadOne = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("project", projectName); // backend expects course name

    const res = await fetch(`${API_URL}/upload`, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.message || `Upload failed: ${file.name}`);
    }
  };

  const handleFileChange = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    setUploading(true);
    setProgress({ done: 0, total: selected.length });

    try {
      for (let i = 0; i < selected.length; i++) {
        await uploadOne(selected[i]);
        setProgress({ done: i + 1, total: selected.length });
      }
      onUploaded?.(); // refresh list once at the end
    } catch (err) {
      console.error(err);
      alert(err.message || "Upload error");
    } finally {
      setUploading(false);
      e.target.value = ""; // allow selecting same files again
    }
  };

  return (
    <div className="mt-4">
      <input
        type="file"
        multiple
        onChange={handleFileChange}
        disabled={uploading}
        accept=".pdf,.doc,.docx,.txt"
      />

      {uploading && (
        <div className="text-sm opacity-70 mt-2">
          Uploading {progress.done}/{progress.total}…
        </div>
      )}
    </div>
  );
}
