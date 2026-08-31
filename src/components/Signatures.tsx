import { useState, useRef } from "react";
import { PenLine, RotateCcw } from "lucide-react";
import { getUrlFoto } from "../utils/helpers";

export function AssinaturaTab({ inspection, locked, onUpdate }) {
  return (
    <div className="card p-5">
      <h3 className="display text-sm font-bold mb-1 flex items-center gap-2"><PenLine size={15} /> Assinatura digital</h3>
      <p className="text-xs mb-4" style={{ color: "var(--ink-soft)" }}>Vistoriador, locador e locatário podem assinar direto na tela — com o dedo ou o mouse. Se preferir, deixe em branco para assinar à caneta depois de imprimir.</p>

      {/* VISTORIADOR */}
      <div className="border rounded-lg p-3 bg-white mb-4">
        <p className="text-sm font-medium mb-2">Assinatura do vistoriador</p>
        <SignaturePad label="Assinatura do vistoriador" value={inspection.signatures?.vistoriador} locked={locked || inspection.signatures?.vistoriadorSalva} onSave={(dataUrl) => { window._assinaturaTempVistoriador = dataUrl; }} />
        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={(e) => { e.preventDefault(); const dados = window._assinaturaTempVistoriador; if (dados) { onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriador: dados, vistoriadorSalva: true } })); } }} type="button" className="btn-primary px-3 py-1.5 text-sm rounded">💾 Salvar</button>
          <button onClick={(e) => { e.preventDefault(); onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriador: null, vistoriadorSalva: false } })); }} type="button" className="btn-ghost px-3 py-1.5 text-sm rounded text-red-600">🗑️ Limpar</button>
          <button onClick={(e) => { e.preventDefault(); onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriadorSalva: false } })); }} type="button" className="btn-ghost px-3 py-1.5 text-sm rounded">✏️ Editar</button>
        </div>
      </div>

      {/* LOCADOR */}
      <div className="border rounded-lg p-3 bg-white mb-4">
        <p className="text-sm font-medium mb-2">Assinatura do locador</p>
        <SignaturePad label="Assinatura do locador" value={inspection.signatures?.locador} locked={locked || inspection.signatures?.locadorSalva} onSave={(dataUrl) => { window._assinaturaTempLocador = dataUrl; }} />
        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={(e) => { e.preventDefault(); const dados = window._assinaturaTempLocador; if (dados) { onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locador: dados, locadorSalva: true } })); } }} type="button" className="btn-primary px-3 py-1.5 text-sm rounded">💾 Salvar</button>
          <button onClick={(e) => { e.preventDefault(); onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locador: null, locadorSalva: false } })); }} type="button" className="btn-ghost px-3 py-1.5 text-sm rounded text-red-600">🗑️ Limpar</button>
          <button onClick={(e) => { e.preventDefault(); onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locadorSalva: false } })); }} type="button" className="btn-ghost px-3 py-1.5 text-sm rounded">✏️ Editar</button>
        </div>
      </div>

      {/* LOCATÁRIO */}
      <div className="border rounded-lg p-3 bg-white">
        <p className="text-sm font-medium mb-2">Assinatura do locatário</p>
        <SignaturePad label="Assinatura do locatário" value={inspection.signatures?.locatario} locked={locked || inspection.signatures?.locatarioSalva} onSave={(dataUrl) => { window._assinaturaTempLocatario = dataUrl; }} />
        <div className="flex gap-2 mt-2 flex-wrap">
          <button onClick={(e) => { e.preventDefault(); const dados = window._assinaturaTempLocatario; if (dados) { onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatario: dados, locatarioSalva: true } })); } }} type="button" className="btn-primary px-3 py-1.5 text-sm rounded">💾 Salvar</button>
          <button onClick={(e) => { e.preventDefault(); onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatario: null, locatarioSalva: false } })); }} type="button" className="btn-ghost px-3 py-1.5 text-sm rounded text-red-600">🗑️ Limpar</button>
          <button onClick={(e) => { e.preventDefault(); onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatarioSalva: false } })); }} type="button" className="btn-ghost px-3 py-1.5 text-sm rounded">✏️ Editar</button>
        </div>
      </div>
    </div>
  );
}


export function SignaturePad({ label, value, onSave, locked }) {
  const canvasRef = useRef(null);
  const [empty, setEmpty] = useState(true);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function start(e) {
    if (locked) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    canvas.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    hasDrawn.current = true;
    setEmpty(false);
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e) {
    if (!drawing.current || locked) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { x, y } = getPos(e, canvas);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#26364B";
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasDrawn.current) {
      onSave(canvasRef.current.toDataURL("image/png"));
    }
  }

  function clear() {
    hasDrawn.current = false;
    setEmpty(true);
    onSave(null);
  }

  return (
    <div className="flex-1 min-w-[220px]">
      <div className="flex items-center justify-between mb-1.5">
        <p className="label flex items-center gap-1.5"><PenLine size={12} /> {label}</p>
        {!locked && !empty && (
          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); clear(); }} className="btn-ghost rounded-full px-2.5 py-1 text-xs no-print flex" type="button">
            <RotateCcw size={11} /> Refazer
          </button>
        )}
      </div>

      {value ? (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, background: "#fff", padding: 4 }}>
          <img src={getUrlFoto(value)} alt={`Assinatura ${label}`} style={{ width: "100%", height: 110, objectFit: "contain" }} />
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={500}
            height={220}
            style={{
              width: "100%", height: 110, borderRadius: 10, background: "#fff",
              border: `1.5px dashed ${locked ? "var(--line)" : "var(--accent)"}`,
              touchAction: "none", cursor: locked ? "default" : "crosshair",
            }}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            onPointerCancel={end}
          />
          {empty && (
            <p className="absolute inset-x-0 text-center text-xs pointer-events-none no-print" style={{ top: "42%", color: "var(--ink-faint)" }}>
              {locked ? "Sem assinatura" : "Assine aqui com o dedo ou o mouse"}
            </p>
          )}
        </div>
      )}

      <div className="mt-3">
        <div style={{ height: 34 }} />
        <p className="text-[10px] text-center" style={{ color: "var(--ink-soft)", borderTop: "1px solid var(--line)", paddingTop: 3 }}>
          Assinatura manual (se necessário)
        </p>
      </div>
    </div>
  );
}
