// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, X, ChevronDown } from "lucide-react";
import { storage } from "../lib/storage";

// Função usada para preencher o campo "Quantidade"
export function QuantityStepper({ label, value, disabled, onChange }) {
  const n = value === "" || value === undefined || value === null ? 0 : Number(value) || 0;

  function set(next) {
    onChange(String(Math.max(0, next)));
  }

  return (
    <div className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap" style={{ border: "1px solid var(--line)", background: "var(--card)" }}>
      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--ink-strong)" }}>{label}</span>
      <div className="flex items-center gap-2">
        {!disabled && n !== 0 && (
          <button type="button" onClick={() => set(0)} className="btn-ghost rounded-full px-2 py-0.5 text-[10px]" title="Zerar (nenhum)">0 / Nenhum</button>
        )}
        <button type="button" disabled={disabled || n <= 0} onClick={() => set(n - 1)} className="btn-ghost rounded-full flex items-center justify-center" style={{ width: 26, height: 26 }}>−</button>
        <span className="text-sm font-semibold mono" style={{ minWidth: 22, textAlign: "center", color: "var(--ink-strong)" }}>{n}</span>
        <button type="button" disabled={disabled} onClick={() => set(n + 1)} className="btn-ghost rounded-full flex items-center justify-center" style={{ width: 26, height: 26 }}>+</button>
      </div>
    </div>
  );
}

// Função usada para os campos técnicos (Alvenaria, Revestimento, etc.)
export function TechFieldPicker({ fieldKey, label, value, options, disabled, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [added, setAdded] = useState([]);
  const [removed, setRemoved] = useState([]);

  useEffect(() => {
    if (!fieldKey) return;
    (async () => {
      try {
        const r = await storage.get(`field-opts:${fieldKey}`);
        if (r) {
          const data = JSON.parse(r.value);
          setAdded(data.added || []);
          setRemoved(data.removed || []);
        }
      } catch {}
    })();
  }, [fieldKey]);

  function persist(nextAdded, nextRemoved) {
    storage.set(`field-opts:${fieldKey}`, JSON.stringify({ added: nextAdded, removed: nextRemoved })).catch(() => {});
  }

  function addOption(text) {
    setAdded((prev) => {
      if (prev.includes(text)) return prev;
      const next = [...prev, text];
      persist(next, removed);
      return next;
    });
  }

  function removeOption(text) {
    setRemoved((prev) => {
      if (prev.includes(text)) return prev;
      const next = [...prev, text];
      persist(added, next);
      return next;
    });
    setAdded((prev) => prev.filter((o) => o !== text));
  }

  function renameOption(oldText, newText) {
    const clean = newText.trim();
    if (!clean || clean === oldText) return;
    const nextRemoved = removed.includes(oldText) ? removed : [...removed, oldText];
    const nextAdded = [...added.filter((o) => o !== oldText), clean];
    setRemoved(nextRemoved);
    setAdded(nextAdded);
    persist(nextAdded, nextRemoved);
  }

  const allOptions = [...(options || []).filter((o) => !removed.includes(o)), ...added];

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--card)" }}>
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5" style={{ minHeight: 30 }}>
        <button type="button" disabled={disabled} onClick={() => setExpanded((v) => !v)} className="flex items-center gap-2 text-left min-w-0">
          {!disabled && <ChevronDown size={13} className={expanded ? "rotate-180" : ""} style={{ color: "var(--accent)", flexShrink: 0 }} />}
          <span className="text-xs font-bold uppercase tracking-wide truncate" style={{ color: "var(--field-label)" }}>Detalhes {label}</span>
        </button>
        <div className="flex items-center gap-1.5 shrink-0">
          {!disabled && allOptions.length > 0 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setEditMode((v) => !v); }} className="btn-ghost rounded-full p-1" title="Editar opções">
              <Pencil size={11} />
            </button>
          )}
          {!disabled && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setAddModalOpen(true); }} className="btn-secondary rounded-full px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1">
              <Plus size={11} /> Adicionar
            </button>
          )}
        </div>
      </div>
      <div className="px-3 pb-2.5 pt-1">
        {value ? (
          <p className="text-xs">
            <span style={{ color: "var(--ink-soft)" }}>Valor: </span>
            <span className="font-semibold" style={{ color: "var(--ink-strong)" }}>{value}</span>
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--ink-faint)" }}>Nenhum valor selecionado</p>
        )}
      </div>
      {expanded && !disabled && (
        <div className="px-3 pb-3">
          {allOptions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {allOptions.map((o) => (
                <div key={o} className="relative">
                  <button type="button" onClick={() => { if (editMode) { setRenameTarget(o); } else { onChange(o); setExpanded(false); } }} className={`estado-btn px-2.5 py-1.5 text-xs ${value === o ? "active-Bom" : ""}`} style={editMode ? { paddingRight: 20 } : undefined}>
                    {o}
                    {editMode && <Pencil size={9} className="inline-block ml-1" style={{ verticalAlign: "middle" }} />}
                  </button>
                  {editMode && (
                    <button type="button" onClick={() => { removeOption(o); if (value === o) onChange(""); }} className="absolute rounded-full flex items-center justify-center" style={{ top: -5, right: -5, width: 16, height: 16, background: "var(--bad)", color: "#fff" }}>
                      <X size={9} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <input className="input w-full px-3 py-1.5 text-xs" placeholder="Ou digite outro valor..." value={value || ""} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}
      {addModalOpen && (
        <div className="no-print modal-fade" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.85)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card modal-pop p-5" style={{ maxWidth: 360, width: "100%" }}>
            <h3 className="display text-sm font-bold mb-3">Nova opção para {label}</h3>
            <input autoFocus className="input w-full px-4 py-2.5 text-sm mb-4" placeholder="Digite a nova opção..." onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { addOption(e.target.value.trim()); setAddModalOpen(false); } if (e.key === "Escape") setAddModalOpen(false); }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setAddModalOpen(false)} className="btn-ghost rounded-full px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => { }} className="btn-primary rounded-full px-4 py-2 text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
      {renameTarget && (
        <div className="no-print modal-fade" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.85)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div className="card modal-pop p-5" style={{ maxWidth: 360, width: "100%" }}>
            <h3 className="display text-sm font-bold mb-3">Editar opção</h3>
            <input autoFocus defaultValue={renameTarget} className="input w-full px-4 py-2.5 text-sm mb-4" onKeyDown={(e) => { if (e.key === "Enter" && e.target.value.trim()) { renameOption(renameTarget, e.target.value.trim()); setRenameTarget(null); } if (e.key === "Escape") setRenameTarget(null); }} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setRenameTarget(null)} className="btn-ghost rounded-full px-4 py-2 text-sm">Cancelar</button>
              <button onClick={() => { }} className="btn-primary rounded-full px-4 py-2 text-sm">Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

