import { useState } from "react";
import { MediaPicker, PhotoThumb } from "./MediaComponents";
import { filesToPhotos, makeItem } from "../utils/helpers";

export function AmbientesTab({ inspection, locked, templateOpen, setTemplateOpen, addAmbiente, removeAmbiente, updateAmbiente, applyModel, customModels = [] }) {
  return (
    <>
      {!locked && (
        <div className="mb-6 relative">
          <button onClick={() => setTemplateOpen((v) => !v)} className="btn-secondary rounded-full px-4 py-2.5 text-sm flex items-center gap-2">
            <Layers size={16} /> Adicionar ambiente <ChevronDown size={14} className={templateOpen ? "rotate-180" : ""} />
          </button>
          {templateOpen && (
            <div className="card absolute z-10 mt-2 p-2 w-80 shadow-lg" style={{ maxHeight: 420, overflowY: "auto" }}>
              <p className="label px-3 pt-1 pb-1.5">Ambiente único</p>
              {Object.entries(TEMPLATES).map(([nome, itens]) => (
                <button key={nome} onClick={() => { addAmbiente(nome, itens); setTemplateOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center justify-between" style={{ color: "var(--ink-strong)" }}>
                  <span>{nome}</span>
                  <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{itens.length} itens</span>
                </button>
              ))}
              <div className="divider my-1" />
              <button onClick={() => { const nome = prompt("Nome do ambiente personalizado:"); if (nome && nome.trim()) { addAmbiente(nome.trim(), []); } setTemplateOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center gap-2" style={{ color: "var(--accent)" }}>
                <Plus size={14} /> Ambiente personalizado
              </button>

              <div className="divider my-1" />
              <p className="label px-3 pt-1 pb-1.5">Aplicar modelo pronto (vários ambientes)</p>
              {Object.entries(PROPERTY_MODELS).map(([key, model]) => (
                <button key={key} onClick={() => { applyModel(key); setTemplateOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center justify-between" style={{ color: "var(--ink-strong)" }}>
                  <span>{model.label}</span>
                  <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{Object.keys(model.ambientes).length} ambientes</span>
                </button>
              ))}
              {customModels.map((model) => (
                <button key={model.id} onClick={() => { applyModel(model); setTemplateOpen(false); }} className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center justify-between" style={{ color: "var(--ink-strong)" }}>
                  <span>{model.label} <span style={{ color: "var(--ink-faint)" }}>(meu modelo)</span></span>
                  <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{Object.keys(model.ambientes).length} ambientes</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {inspection.ambientes.length === 0 ? (
        <div className="card p-10 text-center">
          <MapPin size={30} className="mx-auto mb-2" style={{ color: "var(--ink-soft)" }} />
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Nenhum ambiente adicionado. Use um modelo pronto ou crie um ambiente personalizado.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {inspection.ambientes.map((amb, idx) => (
            <AmbienteCard key={amb.id} ambiente={amb} numero={idx + 1} locked={locked} onRemove={() => removeAmbiente(amb.id)} onChange={(fn) => updateAmbiente(amb.id, fn)} />
          ))}
        </div>
      )}
    </>
  );
}

export function AmbienteCard({ ambiente, numero, locked, onRemove, onChange }) {
  const [open, setOpen] = useState(false);
  const fotosAmbiente = ambiente.fotos || [];

  function addItem() {
    const nome = prompt("Nome do item:");
    if (!nome || !nome.trim()) return;
    onChange((a) => ({ ...a, itens: [...a.itens, makeItem(nome.trim())] }));
  }

  function updateItem(itemId, fn) {
    onChange((a) => ({ ...a, itens: a.itens.map((it) => (it.id === itemId ? fn(it) : it)) }));
  }

  function removeItem(itemId) {
    onChange((a) => ({ ...a, itens: a.itens.filter((it) => it.id !== itemId) }));
  }

  async function handleAddFotosAmbiente(files) {
    const photos = await filesToPhotos(files);
    onChange((a) => ({ ...a, fotos: [...(a.fotos || []), ...photos] }));
  }

  function removeFotoAmbiente(idx) {
    onChange((a) => ({ ...a, fotos: (a.fotos || []).filter((_, i) => i !== idx) }));
  }

  const avariasAmb = ambiente.itens.filter((i) => i.temDano).length;
  
  // Calcula o total de mídias (fotos do ambiente + fotos dos itens)
  const totalMidias = (ambiente.fotos?.length || 0) + ambiente.itens.reduce((acc, item) => acc + (item.fotos?.length || 0), 0);
  
  // Função para escolher cor e ícone com base no nome do ambiente
  const getCor = (nome) => {
    const n = (nome || "").toLowerCase();
    if (n.includes("cozinha")) return { bg: "#5e1f1f", border: "#e66c6c", icon: <Flame size={18} color="#ff5c5c" /> };
    if (n.includes("banheiro")) return { bg: "#1d3a5f", border: "#5c9ce6", icon: <Droplet size={18} color="#4da6ff" /> };
    if (n.includes("quarto")) return { bg: "#2d4a32", border: "#6fbf73", icon: <Sun size={18} color="#7ed957" /> };
    if (n.includes("sala")) return { bg: "#5e1f1f", border: "#e66c6c", icon: <MapPin size={18} color="#ff5c5c" /> };
    return { bg: "#2d4a32", border: "#6fbf73", icon: <Camera size={18} color="#7ed957" /> };
  };
  
  const cor = getCor(ambiente.nome);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer" style={{ background: "var(--card-alt)" }} onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: cor.bg, border: `1px solid ${cor.border}` }}>
          {cor.icon}
        </div>
        {numero && (
          <span className="mono font-bold flex items-center justify-center rounded-full" style={{ width: 22, height: 22, fontSize: 11, background: "var(--accent)", color: "#F3E4E7" }}>
            {String(numero).padStart(2, "0")}
          </span>
        )}
        <h3 className="display font-semibold text-sm flex-1">{ambiente.nome}</h3>
        <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{ambiente.itens.length} itens</span>
        <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{totalMidias} mídia(s)</span>
        {avariasAmb > 0 && <span className="badge badge-bad">{avariasAmb} avarias</span>}
        {!locked && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="btn-ghost rounded-full p-1.5"><Trash2 size={13} /></button>}
      </div>

      {open && (
        <div className="p-4">
          <div className="mb-4 p-3 rounded-2xl" style={{ border: "1px dashed var(--line)" }}>
            <p className="label mb-2">Fotos e vídeos gerais do ambiente</p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {fotosAmbiente.map((foto, idx) => (
                <PhotoThumb key={idx} foto={foto} onRemove={!locked ? () => removeFotoAmbiente(idx) : null} onUpdate={!locked ? (marcas) => onChange((a) => ({ ...a, fotos: (a.fotos || []).map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null} />
              ))}
            </div>
            {!locked && <PhotoPicker onAdd={handleAddFotosAmbiente} small />}
          </div>

          <div className="grid gap-3">
            {ambiente.itens.map((item) => (
              <ItemRow key={item.id} item={item} locked={locked} onChange={(fn) => updateItem(item.id, fn)} onRemove={() => removeItem(item.id)} />
            ))}
          </div>
          {!locked && (
            <button onClick={addItem} className="btn-ghost rounded-full px-3 py-2 text-xs mt-3 flex items-center gap-1.5">
              <Plus size={13} /> Adicionar item
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ItemRow({ item, locked, onChange, onRemove }) {
  const [open, setOpen] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const campos = item.campos || Object.fromEntries(ITEM_FIELD_DEFS.map((f) => [f.key, ""]));
  const camposPreenchidos = ITEM_FIELD_DEFS.filter((f) => campos[f.key]).length;
  const estadoLabel = item.semTeste ? "Sem teste" : item.estado;
  const relevantKeys = relevantFieldKeys(item.nome);
  const visibleFields = showAllFields ? ITEM_FIELD_DEFS : ITEM_FIELD_DEFS.filter((f) => relevantKeys.includes(f.key));
  const hiddenCount = ITEM_FIELD_DEFS.length - visibleFields.length;

  async function handleAddPhotos(files) {
    const photos = await filesToPhotos(files);
    onChange((it) => ({ ...it, fotos: [...it.fotos, ...photos] }));
  }

  function removePhoto(idx) {
    onChange((it) => ({ ...it, fotos: it.fotos.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--card-alt)" }}>
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        <span className="font-semibold text-sm flex-1" style={{ color: "var(--item-name)" }}>{item.nome}</span>
        <span className={`badge ${item.semTeste ? "badge-neutral" : estadoLabel === "Bom" || estadoLabel === "Novo" ? "badge-good" : estadoLabel === "Regular" ? "badge-warn" : estadoLabel === "Péssimo" ? "badge-worse" : "badge-bad"}`}>{estadoLabel}</span>
        {item.temDano && <AlertTriangle size={14} style={{ color: "var(--bad)" }} />}
        {item.fotos.length > 0 && <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{item.fotos.length} mídia(s)</span>}
        {!locked && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="btn-ghost rounded-full p-1.5"><Trash2 size={13} /></button>}
      </div>

      {!open && camposPreenchidos > 0 && (
        <p className="text-xs px-4 pb-3 pt-2" style={{ color: "var(--ink-soft)", borderTop: "1px solid var(--line)" }}>
          {ITEM_FIELD_DEFS.filter((f) => campos[f.key]).map((f) => `${f.label}: ${campos[f.key]}`).join(" · ")}
        </p>
      )}

      {open && (
        <div className="px-4 pb-4">
<div className="flex items-center gap-1.5 mb-2 w-full overflow-x-auto" style={{ paddingBottom: "4px" }}>
  {ESTADOS.map((e) => (
    <button
      key={e}
      disabled={locked}
      onClick={() => onChange((it) => ({ ...it, estado: e, semTeste: false }))}
      className={`estado-btn px-3 py-2 text-xs flex-shrink-0 ${!item.semTeste && item.estado === e ? `active-${e}` : ""}`}
      style={{ borderRadius: "999px", whiteSpace: "nowrap" }}
    >
      {e}
    </button>
  ))}
</div>
          <div className="flex gap-2 flex-wrap mb-3">
            <button disabled={locked} onClick={() => onChange((it) => ({ ...it, semTeste: !it.semTeste }))} className={`estado-btn px-4 py-2 ${item.semTeste ? "active-semteste" : ""}`}>
              Sem teste
            </button>
          </div>

          <div className="grid gap-2 mb-2">
            {visibleFields.map((f) =>
              f.type === "number" ? (
                <QuantityStepper key={f.key} label={f.label} value={campos[f.key]} disabled={locked} onChange={(val) => onChange((it) => ({ ...it, campos: { ...(it.campos || {}), [f.key]: val } }))} />
              ) : (
                <TechFieldPicker key={f.key} fieldKey={f.key} label={f.label} value={campos[f.key]} options={FIELD_OPTIONS[f.key]} disabled={locked} onChange={(val) => onChange((it) => ({ ...it, campos: { ...(it.campos || {}), [f.key]: val } }))} />
              )
            )}
          </div>
          {!locked && hiddenCount > 0 && (
            <button type="button" onClick={() => setShowAllFields((v) => !v)} className="btn-ghost rounded-full px-3 py-1.5 text-xs mb-3 flex items-center gap-1.5">
              {showAllFields ? <><ChevronDown size={12} className="rotate-180" /> Mostrar só os campos relevantes</> : <><Plus size={12} /> Mostrar mais {hiddenCount} campo(s)</>}
            </button>
          )}

          <TextAreaWithDictation disabled={locked} className="px-4 py-2.5" rows={2} placeholder="Observação..." value={item.observacoes} onChange={(val) => onChange((it) => ({ ...it, observacoes: val }))} />

          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
            <input type="checkbox" disabled={locked} checked={item.temDano} onChange={(e) => onChange((it) => ({ ...it, temDano: e.target.checked }))} />
            <span className="flex items-center gap-1" style={{ color: item.temDano ? "var(--bad)" : "var(--ink-soft)" }}>
              <AlertTriangle size={13} /> Registrar avaria
            </span>
          </label>

          {item.temDano && (
            <div className="mt-2">
              <TextAreaWithDictation disabled={locked} className="px-4 py-2.5" rows={2} placeholder="Descreva a avaria encontrada..." style={{ borderColor: "var(--bad)" }} value={item.descricaoDano} onChange={(val) => onChange((it) => ({ ...it, descricaoDano: val }))} />
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {item.fotos.map((foto, idx) => (
              <PhotoThumb key={idx} foto={foto} onRemove={!locked ? () => removePhoto(idx) : null} onUpdate={!locked ? (marcas) => onChange((it) => ({ ...it, fotos: it.fotos.map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null} />
            ))}
          </div>
          {!locked && <div className="mt-2"><PhotoPicker onAdd={handleAddPhotos} small /></div>}
        </div>
      )}
    </div>
  );
}

