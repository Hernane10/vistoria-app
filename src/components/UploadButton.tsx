// @ts-nocheck
import { useRef } from "react";
import { Camera } from "lucide-react";

export function HeaderCameraButton({ onUpload, locked }) {
  const inputRef = useRef(null);
  
  if (locked) return null;

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    onUpload([file]);
    e.target.value = "";
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      <button
        onClick={() => inputRef.current?.click()}
        className="btn-ghost rounded-full p-2"
        style={{ color: "var(--accent)" }}
        title="Tirar foto rápida"
      >
        <Camera size={16} />
      </button>
    </>
  );
}