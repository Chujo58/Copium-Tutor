import { useState } from "react";
import { UploadPopup } from "../components/Popup";

export default function CourseDocumentUploader({ projectName, onUploaded }) {
  const [showPopup, setShowPopup] = useState(false);

  const handleUploadComplete = () => {
    onUploaded?.();
    setShowPopup(false);
  };

  return (
    <div className="mt-4">
      <button onClick={() => setShowPopup(true)} className="px-4 py-2 bg-rose-plum text-white rounded hover:bg-rose-copper cursor-pointer">
        Upload Documents
      </button>
      {showPopup && (
        <UploadPopup
          onClose={() => setShowPopup(false)}
          projectName={projectName}
          onUploaded={handleUploadComplete}
        />
      )}
    </div>
  );
}
