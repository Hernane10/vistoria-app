// @ts-nocheck
import { useState } from "react";
import { X, QrCode } from "lucide-react";
import { getUrlFoto, qrCodeUrl, fichaText, fmtDateTime } from "../utils/helpers";

export function PromptModal({ title, placeholder = "", defaultValue = "", confirmLabel = "Salvar", onSubmit, onCancel }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="no-print modal-fade" onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.85)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card modal-pop p-5" style={{ maxWidth: 360, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <h3 className="display text-sm font-bold mb-3">{title}</h3>
        <input autoFocus className="input w-full px-4 py-2.5 text-sm mb-4" placeholder={placeholder} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onSubmit(value.trim()); if (e.key === "Escape") onCancel(); }} />
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn-ghost rounded-full px-4 py-2 text-sm">Cancelar</button>
          <button disabled={!value.trim()} onClick={() => onSubmit(value.trim())} className="btn-primary rounded-full px-4 py-2 text-sm">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

export function QrCodeModal({ inspection, onClose }) {
  const text = fichaText(inspection);
  return (
    <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card p-5" style={{ maxWidth: 320, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="display text-sm font-bold flex items-center gap-1.5"><QrCode size={16} /> QR do imóvel</h3>
          <button onClick={onClose} className="btn-ghost rounded-full p-1.5"><X size={14} /></button>
        </div>
        <div className="flex justify-center mb-3">
          <img src={qrCodeUrl(text)} alt="QR code do imóvel" style={{ width: 200, height: 200, borderRadius: 8, background: "#fff", padding: 8 }} />
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)", whiteSpace: "pre-line" }}>{text}</p>
        <p className="text-[10px]" style={{ color: "var(--ink-faint)" }}>Ao escanear, aparece a ficha resumida deste imóvel como texto.</p>
      </div>
    </div>
  );
}


export function Lightbox({ src, marcas = null, onClose }) {
  if (!src) return null;

  // src agora é o objeto completo da foto
  const imageSource = typeof src === "object" ? (src.url || src.src) : src;
  const marcasAtivas = marcas || (typeof src === "object" ? src.marcas : null);
  const pontos = Array.isArray(marcasAtivas) ? marcasAtivas : (marcasAtivas?.points || []);
  const comentarioMarcacao = Array.isArray(marcasAtivas) ? "" : (marcasAtivas?.comentario || "");
  const dataFoto = typeof src === "object" ? (src.date || src.createdAt || "") : "";

  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: 24, cursor: "zoom-out",
      }}
    >
      <button onClick={onClose} style={{ position: "absolute", top: 18, right: 18, width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>

      <div className="relative" style={{ maxWidth: "94vw", maxHeight: "85vh" }}>
        <img src={getUrlFoto(imageSource)} alt="Ampliada" style={{ maxWidth: "94vw", maxHeight: "85vh", width: "auto", height: "auto", objectFit: "contain", borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
        {pontos.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 26, height: 26, borderRadius: "50%", border: "3px solid #E23B3B", background: "rgba(226,59,59,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer" }} title={comentarioMarcacao || undefined}>{i + 1}</div>
        ))}
      </div>

      {/* Rodapé com data e observação */}
      <div style={{ marginTop: 16, textAlign: "center", color: "#fff" }}>
        {dataFoto && (
          <p style={{ fontSize: 14, margin: 0, opacity: 0.8 }}>
            {fmtDateTime(dataFoto)}
          </p>
        )}
        {comentarioMarcacao && (
          <p style={{ fontSize: 16, margin: "8px 0 0", fontWeight: "600", color: "#ff6b6b" }}>
            ⚠ {comentarioMarcacao}
          </p>
        )}
      </div>
    </div>
  );
}
