// @ts-nocheck
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  Plus, ChevronDown, ChevronRight, Camera, Trash2, AlertTriangle,
  FileText, ArrowLeft, Search, Building2, Calendar, Printer,
  X, CheckCircle2, ClipboardList, Layers, MapPin, Lock, Unlock,
  PenLine, RotateCcw, Cloud, CloudOff, Loader2, Gauge, KeyRound, Flame, Droplet,
   Zap, Info, EyeOff, Eye,
  Upload, ImagePlus, Wand2, Trash, Sun, Moon, Video, Play, HelpCircle, Mic,
  Pencil, Eraser, Share2, QrCode, GitCompare, Hash, Check, Target, Download
} from "lucide-react";
import { storage } from "./lib/storage";
import { AmbientesTab, AmbienteCard, ItemRow } from './components/AmbientesItems';
import { SignaturePad, AssinaturaTab } from './components/Signatures';
import CloudSyncWidget from "./components/CloudSyncWidget";
import { enviarTodasFotosParaSupabase } from './uploadFotos.js';
import { supabase } from './components/supabaseClient.js';
import { MediaPicker, PhotoPicker, PhotoThumb, TextAreaWithDictation, PhotoAnnotator } from './components/MediaComponents';
import { PromptModal, Lightbox, QrCodeModal } from './components/Modals';
import { QuantityStepper, TechFieldPicker } from "./utils/ItemComponents";
import { getUrlFoto, filesToPhotos, makeItem, makeAmbiente, fmtDate, uid, fmtDateTime,
   emptyInspection, withDefaults, mediaTypeOf, normalizePhoto, fmtFileSize,
   storageLoadAll, storageSaveInspection, storageSaveIndex, storageDeleteInspection,
    enderecoCompleto, fichaText, ambientesFromModel, todayISO,
     compressImageFile, fileToDataURL, getImageDimensions } from './utils/helpers';


export const LightboxContext = createContext(() => {})

// ============================================================
// CONSTANTES E FUNÇÕES AUXILIARES
// ============================================================

const TEMPLATES = {
  "Sala de Estar": ["Teto", "Parede", "Piso", "Rodapé", "Porta", "Janela", "Tomadas", "Interruptores", "Iluminação", "Quadro de luz"],
  "Cozinha": ["Teto", "Parede", "Piso", "Rodapé", "Porta", "Janela", "Tomadas", "Iluminação", "Pia", "Gabinete", "Azulejo", "Exaustor/Coifa", "Ponto de gás", "Ponto de água", "Eletrodomésticos"],
  "Quarto": ["Piso", "Paredes", "Teto", "Janelas", "Portas", "Armário embutido"],
  "Banheiro": ["Teto", "Parede", "Piso", "Rodapé", "Porta", "Janela", "Tomadas", "Iluminação", "Vaso sanitário", "Pia/bancada", "Box", "Registros", "Ralos", "Azulejo", "Espelho", "Ventilação"],
  "Lavabo": ["Teto", "Parede", "Piso", "Porta", "Tomadas", "Iluminação", "Vaso sanitário", "Pia", "Registros", "Azulejo"],
  "Área de Serviço": ["Teto", "Parede", "Piso", "Tomadas", "Iluminação", "Tanque", "Ponto de água", "Ponto de esgoto", "Eletrodomésticos"],
  "Corredor/Hall": ["Teto", "Parede", "Piso", "Rodapé", "Iluminação", "Tomadas"],
  "Garagem": ["Piso", "Portão", "Teto/Cobertura", "Iluminação", "Tomadas", "Estrutura"],
  "Área Externa": ["Piso", "Muros", "Portão", "Jardim", "Garagem"],
};

const ESTADOS = ["Novo", "Bom", "Regular", "Ruim", "Péssimo"];

const ITEM_FIELD_DEFS = [
  { key: "alvenaria", label: "Alvenaria" },
  { key: "revestimento", label: "Revestimento" },
  { key: "material", label: "Material" },
  { key: "acabamento", label: "Acabamento" },
  { key: "pintura", label: "Pintura" },
  { key: "sanca", label: "Sanca" },
  { key: "funcionamento", label: "Funcionamento" },
  { key: "marca", label: "Marca" },
  { key: "cor", label: "Cor" },
  { key: "quantidade", label: "Quantidade", type: "number" },
];

const FIELD_OPTIONS = {
  alvenaria: ["Tijolo aparente", "Reboco liso", "Reboco áspero", "Drywall (gesso acartonado)", "Bloco de concreto", "Alvenaria estrutural", "Não se aplica"],
  revestimento: ["Cerâmica", "Porcelanato", "Azulejo", "Pastilha", "Textura", "Papel de parede", "Laminado", "Granito", "Mármore", "Não se aplica"],
  material: ["Alvenaria", "Drywall (gesso acartonado)", "Madeira", "Metal", "Vidro", "PVC", "Concreto", "Cerâmica", "Porcelanato", "Granito", "Mármore", "Alumínio", "Ferro"],
  acabamento: ["Liso", "Texturizado", "Com Revestimento", "Com Azulejos", "Com Painéis", "Acabamento em Gesso", "Fosco", "Brilhante", "Semi-Brilho", "Com Grafiato", "Polido", "Encerado", "Anodizado", "Cromado", "Vitrificado", "Rústico", "Não se aplica"],
  pintura: ["Pintura Acrílica", "Pintura Lavável", "Pintura Esmalte Sintético", "Pintura Efeito Texturizado", "Pintura Antimofo", "Pintura Fosca", "Pintura Semi-Brilho", "Pintura Brilhante", "Pintura a Spray", "Pintura em Camadas", "Látex", "Epóxi", "Ecológica", "Verniz", "Não se aplica"],
  sanca: ["Sanca Reta", "Sanca Aberta", "Sanca Fechada", "Sanca de Gesso", "Sanca com Iluminação Embutida", "Sem sanca"],
  funcionamento: ["Funcionando normalmente", "Funcionando com ressalva", "Funcionamento parcial", "Não funciona", "Não testado"],
  cor: ["Branco", "Bege", "Cinza", "Preto", "Amarelo", "Azul", "Verde", "Vermelho", "Marrom", "Rosa", "Roxo", "Multicolor"],
};

const FIELD_RULES = [
  { keywords: ["piso", "parede", "teto", "rodapé", "rodape", "alvenaria", "estrutura", "muro", "cobertura"], fields: ["alvenaria", "revestimento", "acabamento", "pintura", "cor"] },
  { keywords: ["sanca"], fields: ["sanca", "acabamento", "pintura", "cor"] },
  { keywords: ["porta", "janela", "portão", "portao", "vidro", "box"], fields: ["material", "acabamento", "pintura", "cor", "funcionamento"] },
  { keywords: ["tomada", "interruptor", "iluminação", "iluminacao", "quadro de luz"], fields: ["funcionamento", "quantidade", "marca"] },
  { keywords: ["pia", "torneira", "chuveiro", "vaso sanitário", "vaso sanitario", "registro", "ralo", "tanque", "bancada", "sifão", "sifao"], fields: ["material", "funcionamento", "marca", "cor"] },
  { keywords: ["azulejo", "pastilha"], fields: ["revestimento", "cor", "acabamento"] },
  { keywords: ["gabinete", "armário", "armario", "prateleira"], fields: ["material", "acabamento", "cor", "funcionamento", "quantidade"] },
  { keywords: ["exaustor", "coifa", "eletrodoméstico", "eletrodomestico", "ar-condicionado", "ar condicionado"], fields: ["funcionamento", "marca", "quantidade"] },
  { keywords: ["extintor", "detector", "grade"], fields: ["quantidade", "funcionamento"] },
  { keywords: ["espelho", "ventilação", "ventilacao"], fields: ["material", "acabamento", "funcionamento"] },
  { keywords: ["ponto de"], fields: ["funcionamento", "quantidade"] },
];

const DEFAULT_ITEM_FIELDS = ["material", "acabamento", "cor", "funcionamento", "marca", "quantidade"];

function relevantFieldKeys(itemName) {
  const n = (itemName || "").toLowerCase();
  for (const rule of FIELD_RULES) {
    if (rule.keywords.some((k) => n.includes(k))) return rule.fields;
  }
  return DEFAULT_ITEM_FIELDS;
}

const CHAVE_TIPOS = [
  { key: "entrada", label: "Chave de entrada" },
  { key: "garagem", label: "Garagem" },
  { key: "controle", label: "Controle" },
  { key: "tags", label: "Tags" },
];

const PROPERTY_MODELS = {
  Kitnet: { label: "Kitnet", descricao: "Ambiente integrado, ideal para vistorias rápidas de imóveis compactos.", ambientes: { "Ambiente Integrado (Sala/Quarto)": ["Teto", "Parede", "Piso", "Rodapé", "Porta", "Janela", "Tomadas", "Iluminação", "Armário embutido"], "Cozinha": TEMPLATES["Cozinha"], "Banheiro": TEMPLATES["Banheiro"] } },
  Casa: { label: "Casa", descricao: "Modelo completo com área externa, ideal para casas térreas ou sobrados.", ambientes: { "Sala de Estar": TEMPLATES["Sala de Estar"], "Cozinha": TEMPLATES["Cozinha"], "Quarto 1": TEMPLATES["Quarto"], "Quarto 2": TEMPLATES["Quarto"], "Banheiro": TEMPLATES["Banheiro"], "Lavabo": TEMPLATES["Lavabo"], "Área de Serviço": TEMPLATES["Área de Serviço"], "Corredor/Hall": TEMPLATES["Corredor/Hall"], "Área Externa": TEMPLATES["Área Externa"] } },
  Apartamento: { label: "Apartamento", descricao: "Modelo padrão para apartamentos residenciais.", ambientes: { "Sala de Estar": TEMPLATES["Sala de Estar"], "Cozinha": TEMPLATES["Cozinha"], "Quarto 1": TEMPLATES["Quarto"], "Banheiro": TEMPLATES["Banheiro"], "Área de Serviço": TEMPLATES["Área de Serviço"], "Corredor/Hall": TEMPLATES["Corredor/Hall"] } },
  Comercial: { label: "Comercial", descricao: "Modelo para salas comerciais, escritórios e lojas.", ambientes: { "Recepção": ["Teto", "Parede", "Piso", "Porta", "Iluminação", "Tomadas"], "Sala Principal": ["Teto", "Parede", "Piso", "Janela", "Iluminação", "Tomadas", "Ar-condicionado"], "Banheiro": TEMPLATES["Banheiro"], "Copa/Kitchenette": ["Piso", "Pia", "Bancada", "Tomadas", "Iluminação"], "Depósito": ["Piso", "Parede", "Teto", "Iluminação", "Prateleiras"] } },
  "Checklist Completo": { label: "Checklist Completo", descricao: "Roteiro amplo com os itens mais cobrados em vistorias.", ambientes: { "Estrutura Geral": ["Paredes (rachaduras/trincas)", "Pintura", "Piso", "Rodapé", "Teto (infiltração/mofo)", "Portas", "Fechaduras e trincos", "Dobradiças", "Janelas", "Vidros", "Iluminação", "Tomadas", "Interruptores", "Quadro de luz"], "Cozinha": ["Pia (vazamentos)", "Torneiras", "Escoamento/ralo", "Gabinete e armários", "Azulejo", "Exaustor/Coifa", "Ponto de gás", "Tomadas", "Piso (impermeabilização)"], "Banheiro": ["Vaso sanitário (descarga)", "Vedação da base do vaso", "Box (vidro/trilho)", "Chuveiro e registro", "Pia/bancada", "Ralos", "Espelho", "Ventilação", "Azulejos"], "Quartos": ["Armário embutido", "Portas", "Janelas (vedação)", "Piso (nivelamento/ruído)"], "Área de Serviço": ["Tanque", "Torneira do tanque", "Ponto para máquina de lavar", "Ralo/esgoto"], "Área Externa / Garagem": ["Portão", "Controle do portão", "Piso da garagem", "Muros", "Jardim/quintal"], "Medidores e Instalações": ["Medidor de água (leitura)", "Medidor de energia (leitura)", "Medidor de gás", "Registro geral de água"], "Chaves e Acessos": ["Chaves de entrada", "Chaves da garagem", "Controles", "Tags/cartões de acesso"], "Segurança": ["Extintores (validade)", "Detectores de fumaça", "Grades e proteções de janelas"] } },
};

// ============================================================
// EXPORT DEFAULT APP
// ============================================================

export default function App() {
  const [inspections, setInspections] = useState([]);
  const [view, setView] = useState("list");
  const [currentId, setCurrentId] = useState(null);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState(null);
  const [calendarVisible, setCalendarVisible] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [pendingModel, setPendingModel] = useState(null);
  const [customModels, setCustomModels] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [lightboxMarcas, setLightboxMarcas] = useState (null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const saveTimer = useRef(null);

  const current = inspections.find((i) => i.id === currentId) || null;

  useEffect(() => {
    (async () => {
      const all = await storageLoadAll();
      setInspections(all.map(withDefaults));
      try { const pref = await storage.get("ui-show-calendar"); if (pref) setCalendarVisible(JSON.parse(pref.value)); } catch {}
      try { const th = await storage.get("ui-theme"); if (th) setTheme(JSON.parse(th.value)); } catch {}
      try { const cm = await storage.get("custom-models"); if (cm) setCustomModels(JSON.parse(cm.value)); } catch {}
      try { const ag = await storage.get("agendamentos"); if (ag) setAgendamentos(JSON.parse(ag.value)); } catch {}
      setLoaded(true);
    })();
  }, []);

  function toggleTheme() {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      storage.set("ui-theme", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  async function saveCustomModel(model) {
    setCustomModels((prev) => { const next = [...prev, model]; storage.set("custom-models", JSON.stringify(next)).catch(() => {}); return next; });
  }

  async function deleteCustomModel(id) {
    setCustomModels((prev) => { const next = prev.filter((m) => m.id !== id); storage.set("custom-models", JSON.stringify(next)).catch(() => {}); return next; });
  }

  function addAgendamento(date, titulo, observacao) {
    setAgendamentos((prev) => { const next = [...prev, { id: uid(), date, titulo, observacao }]; storage.set("agendamentos", JSON.stringify(next)).catch(() => {}); return next; });
  }

  function removeAgendamento(id) {
    setAgendamentos((prev) => { const next = prev.filter((a) => a.id !== id); storage.set("agendamentos", JSON.stringify(next)).catch(() => {}); return next; });
  }

  function toggleCalendar() {
    setCalendarVisible((v) => { const next = !v; storage.set("ui-show-calendar", JSON.stringify(next)).catch(() => {}); return next; });
  }

  const persist = useCallback((insp) => {
    setSaveState("saving");
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try { await storageSaveInspection(insp); setSaveState("saved"); } catch { setSaveState("error"); }
    }, 500);
  }, []);

  function updateInspection(id, updater) {
    setInspections((prev) => {
      const next = prev.map((i) => (i.id === id ? updater(i) : i));
      const changed = next.find((i) => i.id === id);
      if (changed) persist(changed);
      return next;
    });
  }

  async function createInspection(data) {
    const insp = { ...emptyInspection(), ...data };
    const next = [insp, ...inspections];
    setInspections(next);
    setCurrentId(insp.id);
    setView("detail");
    setSaveState("saving");
    try { await storageSaveInspection(insp); await storageSaveIndex(next.map((i) => i.id)); setSaveState("saved"); } catch { setSaveState("error"); }
  }

  async function deleteInspection(id) {
    const next = inspections.filter((i) => i.id !== id);
    setInspections(next);
    if (currentId === id) { setCurrentId(null); setView("list"); }
    setSaveState("saving");
    try { await storageDeleteInspection(id, next.map((i) => i.id)); setSaveState("saved"); } catch { setSaveState("error"); }
  }

  function startNew(modelKey = null) { setPendingModel(modelKey); setView("new"); }

  async function generateExample() { await createInspection(buildExampleInspection()); }

  function exportInspections(ids) {
    const toExport = ids ? inspections.filter((i) => ids.includes(i.id)) : inspections;
    const payload = { app: "VistorIA", exportedAt: new Date().toISOString(), version: 1, inspections: toExport };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = todayISO();
    a.href = url;
    a.download = toExport.length === 1 ? `vistoria-${(toExport[0].imovel.endereco || "sem-endereco").replace(/[^a-z0-9]+/gi, "-")}-${stamp}.json` : `vistorias-vistoria-ia-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importInspections(file) {
    const text = await file.text();
    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Arquivo inválido: não é um JSON de exportação do VistorIA."); }
    const list = Array.isArray(data) ? data : data.inspections;
    if (!Array.isArray(list)) throw new Error("Arquivo inválido: nenhuma vistoria encontrada dentro dele.");
    const imported = list.map((insp) => withDefaults({ ...insp, id: uid(), createdAt: Date.now() }));
    const next = [...imported, ...inspections];
    setInspections(next);
    setSaveState("saving");
    try { await Promise.all(imported.map((insp) => storageSaveInspection(insp))); await storageSaveIndex(next.map((i) => i.id)); setSaveState("saved"); } catch { setSaveState("error"); }
    return imported.length;
  }

  const filtered = inspections.filter((i) => {
    const q = query.toLowerCase();
    const matchesText = (i.imovel.endereco.toLowerCase().includes(q) || i.imovel.bairro.toLowerCase().includes(q) || i.imovel.cidade.toLowerCase().includes(q) || i.imovel.proprietario.toLowerCase().includes(q) || i.vistoriador.toLowerCase().includes(q));
    const matchesDate = !dateFilter || i.dataVistoria === dateFilter;
    return matchesText && matchesDate;
  });

  return (
    <div className={`app-root ${theme === "light" ? "theme-light" : ""}`}>
      <LightboxContext.Provider value={(src) => { setLightboxSrc(src); setLightboxMarcas(null); }}>
      <Lightbox src={lightboxSrc} marcas={lightboxMarcas} onClose={() => setLightboxSrc(null)} />

      {!loaded && (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--ink-soft)" }} />
        </div>
      )}

      {loaded && view === "list" && (
        <div key="list" className="view-enter">
        <ListView
          inspections={filtered}
          allInspections={inspections}
          query={query}
          setQuery={setQuery}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          calendarVisible={calendarVisible}
          toggleCalendar={toggleCalendar}
          onOpen={(id) => { setCurrentId(id); setView("detail"); }}
          onNew={() => startNew(null)}
          onUseModel={(key) => startNew(key)}
          onGenerateExample={generateExample}
          onDelete={deleteInspection}
          saveState={saveState}
          customModels={customModels}
          onCreateCustomModel={() => setView("buildModel")}
          onDeleteCustomModel={deleteCustomModel}
          theme={theme}
          toggleTheme={toggleTheme}
          agendamentos={agendamentos}
          onAddAgendamento={addAgendamento}
          onRemoveAgendamento={removeAgendamento}
          onExport={exportInspections}
          onImport={importInspections}
        />
        </div>
      )}

      {view === "new" && (
        <div key="new" className="view-enter">
        <NewInspectionView
          onCancel={() => setView("list")}
          onCreate={createInspection}
          initialModel={pendingModel}
        />
        </div>
      )}

      {view === "buildModel" && (
        <div key="buildModel" className="view-enter">
        <ModelBuilderView
          onCancel={() => setView("list")}
          onSave={async (model) => { await saveCustomModel(model); setView("list"); }}
        />
        </div>
      )}

      {view === "detail" && current && (
        <div key="detail" className="view-enter">
        <DetailView
          inspection={current}
          onBack={() => { setView("list"); setCurrentId(null); }}
          onUpdate={(updater) => updateInspection(current.id, updater)}
          customModels={customModels}
          allInspections={inspections}
          onExport={() => exportInspections([current.id])}
        />
        </div>
      )}
      </LightboxContext.Provider>
    </div>
  );
}

// ============================================================
// FUNÇÕES E COMPONENTES (BLOCO 2)
// ============================================================

function SaveIndicator({ state }) {
  if (state === "idle") return null;
  const map = {
    saving: { icon: <Loader2 size={13} className="animate-spin" />, text: "Salvando..." },
    saved: { icon: <Cloud size={13} />, text: "Salvo" },
    error: { icon: <CloudOff size={13} />, text: "Erro ao salvar" },
  };
  const { icon, text } = map[state] || map.saved;
  return (
    <span className="text-xs opacity-70 flex items-center gap-1.5">
      {icon} {text}
    </span>
  );
}

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

function CalendarWidget({ inspections, dateFilter, setDateFilter, onHide, agendamentos, onAddAgendamento, onRemoveAgendamento }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [schedulingDate, setSchedulingDate] = useState(null);

  const countsByDate = {};
  inspections.forEach((i) => {
    if (!i.dataVistoria) return;
    countsByDate[i.dataVistoria] = (countsByDate[i.dataVistoria] || 0) + 1;
  });

  const agendaByDate = {};
  (agendamentos || []).forEach((a) => {
    (agendaByDate[a.date] = agendaByDate[a.date] || []).push(a);
  });

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const todayIso = todayISO();

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isoFor(day) {
    return `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function changeMonth(delta) {
    setCursor((c) => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      return { year: y, month: m };
    });
  }

  const proximos = (agendamentos || [])
    .filter((a) => a.date >= todayIso)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="card p-4 mb-6 no-print">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => changeMonth(-1)} className="btn-ghost rounded-full p-1.5">
            <ChevronRight size={14} className="rotate-180" />
          </button>
          <h3 className="display text-sm font-bold" style={{ minWidth: 130, textAlign: "center" }}>
            {MESES[cursor.month]} {cursor.year}
          </h3>
          <button onClick={() => changeMonth(1)} className="btn-ghost rounded-full p-1.5">
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {dateFilter && (
            <button onClick={() => setDateFilter(null)} className="btn-ghost rounded-full px-2.5 py-1 text-xs">
              Limpar filtro
            </button>
          )}
          <button onClick={onHide} className="btn-ghost rounded-full px-2.5 py-1 text-xs flex items-center gap-1">
            <EyeOff size={12} /> Ocultar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {DIAS_SEMANA.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-semibold" style={{ color: "var(--ink-soft)" }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, idx) => {
          if (day === null) return <div key={idx} />;
          const iso = isoFor(day);
          const count = countsByDate[iso] || 0;
          const agenda = agendaByDate[iso] || [];
          const isToday = iso === todayIso;
          const isSelected = dateFilter === iso;
          return (
            <div key={idx} className="relative">
              <button
                onClick={() => setDateFilter(isSelected ? null : iso)}
                className="w-full rounded-lg flex flex-col items-center justify-center gap-0.5 py-1.5 text-xs"
                style={{
                  background: isSelected ? "var(--accent)" : agenda.length > 0 ? "var(--warn-bg)" : "transparent",
                  color: isSelected ? "#F3E4E7" : "var(--ink-strong)",
                  border: agenda.length > 0 && !isSelected ? "1.5px solid var(--warn)" : isToday && !isSelected ? "1.5px solid var(--accent)" : "1px solid transparent",
                }}
              >
                <span>{day}</span>
                <span className="flex items-center gap-0.5">
                  {count > 0 && <span className="rounded-full" style={{ width: 4, height: 4, background: isSelected ? "#F3E4E7" : "var(--good)" }} />}
                  {agenda.length > 0 && <Calendar size={9} style={{ color: isSelected ? "#F3E4E7" : "var(--warn)" }} />}
                </span>
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setSchedulingDate(iso); }}
                className="absolute rounded-full flex items-center justify-center no-print"
                title="Agendar vistoria"
                style={{ top: -3, right: -3, width: 14, height: 14, background: "var(--card-alt)", border: "1px solid var(--line)", color: "var(--ink-soft)", fontSize: 10, lineHeight: 1 }}
              >
                +
              </button>
            </div>
          );
        })}
      </div>

      {proximos.length > 0 && (
        <div className="mt-4 pt-3" style={{ borderTop: "1px dashed var(--line)" }}>
          <p className="label mb-2">Próximos agendamentos</p>
          <div className="grid gap-1.5">
            {proximos.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-lg" style={{ background: "var(--warn-bg)" }}>
                <Calendar size={12} style={{ color: "var(--warn)" }} className="shrink-0" />
                <span className="font-semibold mono shrink-0">{fmtDate(a.date)}</span>
                <span className="flex-1 truncate" style={{ color: "var(--ink-strong)" }}>{a.titulo}</span>
                <button onClick={() => onRemoveAgendamento(a.id)} className="btn-ghost rounded-full p-1 shrink-0"><X size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {schedulingDate && (
        <AgendarModal
          date={schedulingDate}
          onClose={() => setSchedulingDate(null)}
          onSave={(titulo, observacao) => { onAddAgendamento(schedulingDate, titulo, observacao); setSchedulingDate(null); }}
        />
      )}
    </div>
  );
}

function AgendarModal({ date, onClose, onSave }) {
  const [titulo, setTitulo] = useState("");
  const [observacao, setObservacao] = useState("");

  return (
    <div className="no-print modal-fade" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.85)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={onClose}>
      <div className="card modal-pop p-5" style={{ maxWidth: 360, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="display text-sm font-bold flex items-center gap-1.5"><Calendar size={15} /> Agendar vistoria</h3>
          <button onClick={onClose} className="btn-ghost rounded-full p-1.5"><X size={14} /></button>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>Data: <strong style={{ color: "var(--ink-strong)" }}>{fmtDate(date)}</strong></p>
        <label className="label block mb-1.5">Título / endereço</label>
        <input autoFocus className="input w-full px-4 py-2.5 text-sm mb-3" placeholder="Ex: Vistoria de saída - Rua X, 123" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        <label className="label block mb-1.5">Observação (opcional)</label>
        <textarea className="textarea w-full px-4 py-2.5 text-sm mb-4" rows={2} placeholder="Detalhes do agendamento..." value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost rounded-full px-4 py-2 text-sm">Cancelar</button>
          <button disabled={!titulo.trim()} onClick={() => onSave(titulo.trim(), observacao.trim())} className="btn-primary rounded-full px-4 py-2 text-sm">Agendar</button>
        </div>
      </div>
    </div>
  );
}

function ListView({ inspections, allInspections, query, setQuery, dateFilter, setDateFilter, calendarVisible, toggleCalendar, onOpen, onNew, onUseModel, onGenerateExample, onDelete, saveState, customModels, onCreateCustomModel, onDeleteCustomModel, theme, toggleTheme, agendamentos, onAddAgendamento, onRemoveAgendamento, onExport, onImport }) {
  const [tab, setTab] = useState("vistorias");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const importFileRef = useRef(null);

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportMsg("");
    try { const count = await onImport(file); setImportMsg(`${count} vistoria(s) importada(s) com sucesso.`); }
    catch (err) { setImportMsg(err.message || "Não foi possível importar este arquivo."); }
    finally { setImporting(false); }
  }

  return (
    <div className="min-h-full">
      <div className="topbar px-6 py-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <ClipboardList size={26} strokeWidth={2} style={{ color: "var(--accent)" }} />
          <div>
            <h1 className="display text-xl font-bold leading-none">Vistor<span style={{ color: "var(--accent)" }}>IA</span></h1>
            <p className="text-xs mt-1 font-semibold" style={{ color: "var(--ink-soft)" }}>PEREIRA Gestão Imobiliária</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <SaveIndicator state={saveState} />
          <CloudSyncWidget inspections={inspections} onImportInspections={onImport} />
          <button onClick={toggleTheme} className="btn-ghost rounded-full p-2.5" title="Alternar tema claro/escuro">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button onClick={() => onExport()} disabled={inspections.length === 0} className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5" title="Exportar todas as vistorias">
            <Download size={14} /> Exportar tudo
          </button>
          <button onClick={() => importFileRef.current?.click()} disabled={importing} className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5" title="Importar vistorias">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar
          </button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
          <button onClick={onNew} className="btn-primary rounded-full px-4 py-2.5 flex items-center gap-2 text-sm">
            <Plus size={17} /> Nova vistoria
          </button>
        </div>
      </div>

      {importMsg && (<div className="max-w-5xl mx-auto px-6 pt-4"><p className="text-xs rounded-xl px-4 py-2.5" style={{ background: "var(--card-alt)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>{importMsg}</p></div>)}

      <div className="max-w-5xl mx-auto px-6 pt-6">
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button onClick={() => setTab("vistorias")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "vistorias" ? "active" : ""}`}>
            <ClipboardList size={14} /> Minhas vistorias
          </button>
          <button onClick={() => setTab("modelos")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "modelos" ? "active" : ""}`}>
            <Layers size={14} /> Vistorias pré-prontas
          </button>
          <button onClick={() => setTab("ajuda")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "ajuda" ? "active" : ""}`}>
            <HelpCircle size={14} /> Como usar
          </button>
        </div>
      </div>

      {tab === "ajuda" && <AjudaTab />}

      {tab === "modelos" && (
        <ModelosTab
          onUseModel={onUseModel}
          onGenerateExample={onGenerateExample}
          customModels={customModels}
          onCreateCustomModel={onCreateCustomModel}
          onDeleteCustomModel={onDeleteCustomModel}
        />
      )}
      {tab === "vistorias" && (
      <div className="max-w-5xl mx-auto px-6 pb-8">
        {calendarVisible ? (
          <CalendarWidget
            inspections={allInspections}
            dateFilter={dateFilter}
            setDateFilter={setDateFilter}
            onHide={toggleCalendar}
            agendamentos={agendamentos}
            onAddAgendamento={onAddAgendamento}
            onRemoveAgendamento={onRemoveAgendamento}
          />
        ) : (
          <button onClick={toggleCalendar} className="btn-ghost rounded-full px-4 py-2 text-xs flex items-center gap-2 mb-6">
            <Eye size={13} /> Mostrar calendário
          </button>
        )}

        {dateFilter && (
          <div className="flex items-center gap-2 mb-4 text-xs" style={{ color: "var(--ink-soft)" }}>
            <span>Filtrando por {fmtDate(dateFilter)}</span>
            <button onClick={() => setDateFilter(null)} className="underline" style={{ color: "var(--accent)" }}>limpar</button>
          </div>
        )}

        <div className="relative mb-6">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--ink-soft)" }} />
          <input className="input w-full pl-10 pr-3 py-2.5 text-sm" placeholder="Buscar por endereço, proprietário ou vistoriador..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        {inspections.length === 0 ? (
          <div className="card p-12 text-center">
            <Building2 size={36} className="mx-auto mb-3" style={{ color: "var(--ink-soft)" }} />
            <h3 className="display text-lg font-semibold mb-1">Nenhuma vistoria ainda</h3>
            <p className="text-sm mb-5" style={{ color: "var(--ink-soft)" }}>Crie sua primeira vistoria para começar a registrar ambientes, itens e avarias.</p>
            <button onClick={onNew} className="btn-primary rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2">
              <Plus size={16} /> Nova vistoria
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {inspections.map((insp) => {
              const totalItens = insp.ambientes.reduce((a, amb) => a + amb.itens.length, 0);
              const avarias = insp.ambientes.reduce((a, amb) => a + amb.itens.filter((it) => it.temDano).length, 0);
              return (
                <div key={insp.id} className="card p-4 flex items-center gap-4 overflow-hidden">
                  <div className="flex items-center justify-center rounded-xl shrink-0 overflow-hidden" style={{ width: 46, height: 46, background: "var(--card-alt)" }}>
                    {insp.capaFoto ? (<img src={getUrlFoto(insp.capaFoto.src)} alt="" loading="lazy" className="w-full object-contain" style={{ height: "auto", maxHeight: 200 }} />) : (<Building2 size={20} style={{ color: "var(--accent)" }} />)}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(insp.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate" style={{ color: "var(--ink-strong)" }}>{enderecoCompleto(insp.imovel) || "Endereço não informado"}</h3>
                      <span className={`badge ${insp.status === "Finalizada" ? "badge-good" : "badge-neutral"}`}>{insp.status}</span>
                      <span className="badge badge-neutral">{insp.tipo}</span>
                    </div>
                    <p className="text-xs mt-1 mono" style={{ color: "var(--ink-soft)" }}>
                      {fmtDate(insp.dataVistoria)} · {insp.vistoriador || "sem vistoriador"} · {insp.ambientes.length} ambientes · {totalItens} itens
                      {avarias > 0 && <span style={{ color: "var(--bad)" }}> · {avarias} avarias</span>}
                    </p>
                  </div>
                  <button onClick={() => onDelete(insp.id)} className="btn-ghost rounded-full p-2" title="Excluir">
                    <Trash2 size={15} />
                  </button>
                  <button onClick={() => onOpen(insp.id)} className="btn-secondary rounded-full px-3 py-2 text-xs">
                    Abrir
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}
    </div>
  );
}

function AjudaTab() {
  const passos = [
    { titulo: "Crie uma nova vistoria", texto: "Toque em \"Nova vistoria\" e preencha os dados gerais (tipo, data, vistoriador) e os dados do imóvel. Use o CEP para preencher o endereço automaticamente." },
    { titulo: "Escolha um modelo (opcional)", texto: "Na aba \"Vistorias pré-prontas\", use um modelo pronto (Kitnet, Casa, Apartamento, Comercial, Checklist Completo) ou o seu próprio modelo salvo para já criar os ambientes automaticamente. Você também pode gerar uma vistoria de exemplo para ver como fica o resultado." },
    { titulo: "Adicione e edite ambientes", texto: "Dentro da vistoria, use \"Adicionar ambiente\" para incluir cômodos prontos ou personalizados. Cada ambiente vem com os itens típicos (piso, parede, teto, etc.), que podem ser editados livremente." },
    { titulo: "Preencha cada item", texto: "Para cada item, marque o estado (Novo, Bom, Regular, Ruim, Péssimo ou Sem teste), preencha os campos técnicos e registre avarias quando houver. Adicione fotos (tiradas na hora ou enviadas) e vídeos (gravados ou enviados). Nas fotos, você pode marcar o ponto exato da avaria e escrever um comentário sobre ela." },
    { titulo: "Preencha medidores e chaves", texto: "Nas abas \"Medidores\" e \"Chaves\", registre a leitura de água, energia e gás (com concessionária e unidade já sugeridas) e a quantidade de cada tipo de chave entregue, com fotos se necessário." },
    { titulo: "Escreva o parecer técnico", texto: "Na aba \"Parecer Técnico\", registre uma avaliação geral do imóvel e anexe qualquer arquivo relevante (plantas, orçamentos, laudos anteriores, PDFs)." },
    { titulo: "Colete as assinaturas", texto: "Na aba \"Assinatura Digital\", vistoriador, locador e locatário podem assinar direto na tela (ou deixar em branco para assinar à caneta depois de imprimir)." },
    { titulo: "Finalize e gere o PDF", texto: "Toque em \"Finalizar\" para travar a edição. Depois vá até a aba \"PDF\" e toque em \"Imprimir / salvar PDF\" — uma nova aba abrirá com o laudo pronto para conferência, impressão ou compartilhamento." },
  ];

  return (
    <div className="max-w-3xl mx-auto px-6 pb-8">
      <div className="card p-6 mb-4">
        <h2 className="display text-lg font-bold mb-1">Como usar o VistorIA</h2>
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Um passo a passo rápido para fazer sua primeira vistoria do início ao fim.</p>
      </div>
      <div className="grid gap-3">
        {passos.map((p, i) => (
          <div key={i} className="card p-4 flex gap-3">
            <div className="shrink-0 rounded-full flex items-center justify-center font-bold text-sm" style={{ width: 30, height: 30, background: "var(--accent)", color: "#F3E4E7" }}>{i + 1}</div>
            <div><h3 className="font-semibold text-sm mb-0.5" style={{ color: "var(--ink-strong)" }}>{p.titulo}</h3><p className="text-sm" style={{ color: "var(--ink-soft)" }}>{p.texto}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModelosTab({ onUseModel, onGenerateExample, customModels, onCreateCustomModel, onDeleteCustomModel }) {
  return (
    <div className="max-w-5xl mx-auto px-6 pb-8">
      <div className="card p-5 mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="display text-sm font-bold mb-1">Vistoria de exemplo</h3>
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>Gera uma vistoria completa já preenchida (endereço, ambientes, medidores e chaves) para você ver como fica o resultado final.</p>
        </div>
        <button onClick={onGenerateExample} className="btn-primary rounded-full px-4 py-2.5 text-sm flex items-center gap-2 shrink-0">
          <Plus size={16} /> Gerar exemplo
        </button>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h3 className="display text-sm font-bold">Modelos por tipo de imóvel</h3>
        <button onClick={onCreateCustomModel} className="btn-secondary rounded-full px-3 py-2 text-xs flex items-center gap-1.5">
          <Wand2 size={13} /> Criar meu modelo
        </button>
      </div>
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
        {Object.entries(PROPERTY_MODELS).map(([key, model]) => (
          <div key={key} className="card p-4 flex flex-col">
            <h4 className="display text-sm font-bold mb-1">{model.label}</h4>
            <p className="text-xs mb-3 flex-1" style={{ color: "var(--ink-soft)" }}>{model.descricao}</p>
            <p className="text-xs mb-3 mono" style={{ color: "var(--ink-faint)" }}>{Object.keys(model.ambientes).join(" · ")}</p>
            <button onClick={() => onUseModel(key)} className="btn-secondary rounded-full px-3 py-2 text-xs w-fit">
              Usar este modelo
            </button>
          </div>
        ))}
      </div>

      {customModels.length > 0 && (
        <>
          <h3 className="display text-sm font-bold mb-3">Meus modelos</h3>
          <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {customModels.map((model) => (
              <div key={model.id} className="card p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-1"><h4 className="display text-sm font-bold">{model.label}</h4><button onClick={() => onDeleteCustomModel(model.id)} className="btn-ghost rounded-full p-1.5 shrink-0" title="Excluir modelo"><Trash2 size={12} /></button></div>
                <p className="text-xs mb-3 flex-1" style={{ color: "var(--ink-soft)" }}>{model.descricao}</p>
                <p className="text-xs mb-3 mono" style={{ color: "var(--ink-faint)" }}>{Object.keys(model.ambientes).join(" · ") || "sem ambientes"}</p>
                <button onClick={() => onUseModel(model)} className="btn-secondary rounded-full px-3 py-2 text-xs w-fit">
                  Usar este modelo
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ModelBuilderView({ onCancel, onSave }) {
  const [nome, setNome] = useState("");
  const [ambientes, setAmbientes] = useState([{ id: uid(), nome: "", itensTexto: "" }]);
  const [saving, setSaving] = useState(false);

  function updateAmbiente(id, field, value) {
    setAmbientes((prev) => prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)));
  }

  function addAmbienteRow() {
    setAmbientes((prev) => [...prev, { id: uid(), nome: "", itensTexto: "" }]);
  }

  function removeAmbienteRow(id) {
    setAmbientes((prev) => prev.filter((a) => a.id !== id));
  }

  const validAmbientes = ambientes.filter((a) => a.nome.trim());
  const canSave = nome.trim() && validAmbientes.length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    const ambientesObj = {};
    validAmbientes.forEach((a) => {
      const itens = a.itensTexto.split(",").map((s) => s.trim()).filter(Boolean);
      ambientesObj[a.nome.trim()] = itens.length > 0 ? itens : ["Estado geral"];
    });
    await onSave({ id: uid(), label: nome.trim(), descricao: "Modelo personalizado", ambientes: ambientesObj });
    setSaving(false);
  }

  return (
    <div className="min-h-full">
      <div className="topbar px-6 py-5 flex items-center gap-3">
        <button onClick={onCancel} className="btn-ghost rounded-full p-2"><ArrowLeft size={18} /></button>
        <h1 className="display text-lg font-bold">Criar meu modelo de vistoria</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="card p-6 mb-4">
          <label className="label block mb-1.5">Nome do modelo</label>
          <input className="input w-full px-4 py-2.5 text-sm" placeholder="Ex: Sobrado duplex, Loja de rua..." value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="card p-6 mb-4">
          <h2 className="display text-sm font-bold mb-4 flex items-center gap-2"><Layers size={15} /> Ambientes do modelo</h2>
          <div className="grid gap-3">
            {ambientes.map((a) => (
              <div key={a.id} className="p-3 rounded-2xl" style={{ border: "1px solid var(--line)", background: "var(--card-alt)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <input className="input flex-1 px-4 py-2 text-sm" placeholder="Nome do ambiente (ex: Sala de Jantar)" value={a.nome} onChange={(e) => updateAmbiente(a.id, "nome", e.target.value)} />
                  {ambientes.length > 1 && (<button onClick={() => removeAmbienteRow(a.id)} className="btn-ghost rounded-full p-2 shrink-0"><Trash2 size={13} /></button>)}
                </div>
                <input className="input w-full px-4 py-2 text-sm" placeholder="Itens separados por vírgula (ex: Teto, Parede, Piso, Janela)" value={a.itensTexto} onChange={(e) => updateAmbiente(a.id, "itensTexto", e.target.value)} />
              </div>
            ))}
          </div>
          <button onClick={addAmbienteRow} className="btn-ghost rounded-full px-3 py-2 text-xs mt-3 flex items-center gap-1.5"><Plus size={13} /> Adicionar ambiente</button>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost rounded-full px-5 py-2.5 text-sm">Cancelar</button>
          <button disabled={!canSave || saving} onClick={handleSave} className="btn-primary rounded-full px-5 py-2.5 text-sm">{saving ? "Salvando..." : "Salvar modelo"}</button>
        </div>
      </div>
    </div>
  );
}

function NewInspectionView({ onCancel, onCreate, initialModel }) {
  const [form, setForm] = useState({
    tipo: "Entrada",
    dataVistoria: todayISO(),
    vistoriador: "",
    mobiliario: "Vazio",
    cep: "",
    endereco: "",
    numero: "",
    bairro: "",
    cidade: "",
    estado: "",
    complemento: "",
    metragem: "",
    proprietario: "",
    inquilino: "",
    tipoImovel: (typeof initialModel === "string" && initialModel) || "Apartamento",
  });
  const [cepStatus, setCepStatus] = useState("idle");
  const [modelKey, setModelKey] = useState(initialModel || null);
  const [capaFoto, setCapaFoto] = useState(null);
  const capaFileRef = useRef(null);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleCepBlur() {
    const digits = form.cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepStatus("loading");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data.erro) { setCepStatus("error"); return; }
      setForm((f) => ({ ...f, endereco: data.logradouro || f.endereco, bairro: data.bairro || f.bairro, cidade: data.localidade || f.cidade, estado: data.uf || f.estado, complemento: data.complemento || f.complemento }));
      setCepStatus("ok");
    } catch {
      setCepStatus("error");
    }
  }

  async function handleCapaUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await fileToDataURL(await maybeCompressImage(file));
    setCapaFoto({ src, date: new Date().toISOString() });
    e.target.value = "";
  }

  function submit() {
    onCreate({
      tipo: form.tipo,
      dataVistoria: form.dataVistoria,
      vistoriador: form.vistoriador,
      mobiliario: form.mobiliario,
      capaFoto,
      ambientes: modelKey ? ambientesFromModel(modelKey) : [],
      imovel: {
        cep: form.cep, endereco: form.endereco, numero: form.numero, bairro: form.bairro,
        cidade: form.cidade, estado: form.estado, complemento: form.complemento,
        metragem: form.metragem, proprietario: form.proprietario, inquilino: form.inquilino,
        tipoImovel: form.tipoImovel,
      },
    });
  }

  const canSubmit = form.endereco.trim() && form.vistoriador.trim();

  return (
    <div className="min-h-full">
      <div className="topbar px-6 py-5 flex items-center gap-3">
        <button onClick={onCancel} className="btn-ghost rounded-full p-2"><ArrowLeft size={18} /></button>
        <h1 className="display text-lg font-bold">Nova vistoria</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {modelKey && (() => {
          const modelObj = typeof modelKey === "string" ? PROPERTY_MODELS[modelKey] : modelKey;
          if (!modelObj) return null;
          return (
            <div className="rounded-xl px-4 py-3 text-xs flex items-center justify-between gap-2 mb-4" style={{ background: "var(--card-alt)", border: "1px solid var(--accent)" }}>
              <span style={{ color: "var(--ink-strong)" }}>Modelo <strong>{modelObj.label}</strong> selecionado — {Object.keys(modelObj.ambientes || {}).length} ambientes serão criados automaticamente.</span>
              <button onClick={() => setModelKey(null)} className="btn-ghost rounded-full px-2.5 py-1 shrink-0">Começar em branco</button>
            </div>
          );
        })()}

        <div className="card p-6 mb-4">
          <h2 className="display text-sm font-bold mb-4 flex items-center gap-2"><Camera size={15} /> Foto do imóvel</h2>
          {capaFoto ? (
            <div className="relative w-fit">
              <img src={getUrlFoto(capaFoto.src)} alt="Capa" style={{ width: 160, height: 110, objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)" }} />
              <button onClick={() => setCapaFoto(null)} className="absolute -top-2 -right-2 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 18, height: 18 }}><X size={11} /></button>
            </div>
          ) : (
            <button onClick={() => capaFileRef.current?.click()} className="btn-ghost rounded-2xl flex flex-col items-center justify-center gap-1 text-xs" style={{ width: 160, height: 110 }}>
              <Camera size={18} /> Adicionar foto
            </button>
          )}
          <input ref={capaFileRef} type="file" accept="image/*" className="hidden" onChange={handleCapaUpload} />
        </div>

        <div className="card p-6 mb-4">
          <h2 className="display text-sm font-bold mb-4 flex items-center gap-2"><Calendar size={15} /> Dados gerais</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label block mb-1.5">Tipo de vistoria</label><select className="select w-full px-4 py-2.5 text-sm" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}><option>Entrada</option><option>Saída</option><option>Manutenção</option><option>Rotina</option><option>Captação</option><option>Periódica</option></select></div>
            <div><label className="label block mb-1.5">Data da vistoria</label><input type="date" className="input w-full px-4 py-2.5 text-sm" value={form.dataVistoria} onChange={(e) => set("dataVistoria", e.target.value)} /></div>
            <div className="col-span-2"><label className="label block mb-1.5">Vistoriador responsável</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Nome do vistoriador" value={form.vistoriador} onChange={(e) => set("vistoriador", e.target.value)} /></div>
            <div className="col-span-2"><label className="label block mb-1.5">Situação do imóvel</label><div className="flex gap-2 flex-wrap">{["Vazio", "Mobiliado", "Semi-mobiliado"].map((op) => (<button key={op} type="button" onClick={() => set("mobiliario", op)} className={`tab-btn px-4 py-2 text-sm ${form.mobiliario === op ? "active" : ""}`}>{op}</button>))}</div></div>
          </div>
        </div>

        <div className="card p-6 mb-6">
          <h2 className="display text-sm font-bold flex items-center gap-2 mb-4"><Building2 size={15} /> Dados do imóvel</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label block mb-1.5">CEP</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="00000-000" value={form.cep} onChange={(e) => set("cep", e.target.value)} onBlur={handleCepBlur} maxLength={9} />{cepStatus === "loading" && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--ink-soft)" }}><Loader2 size={11} className="animate-spin" /> Buscando endereço...</p>}{cepStatus === "ok" && <p className="text-xs mt-1" style={{ color: "var(--good)" }}>Endereço preenchido automaticamente</p>}{cepStatus === "error" && <p className="text-xs mt-1" style={{ color: "var(--bad)" }}>CEP não encontrado, preencha manualmente</p>}</div>
            <div><label className="label block mb-1.5">Metragem do imóvel</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Ex: 65 m²" value={form.metragem} onChange={(e) => set("metragem", e.target.value)} /></div>
            <div className="col-span-2"><label className="label block mb-1.5">Endereço (rua/avenida)</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Rua, avenida..." value={form.endereco} onChange={(e) => set("endereco", e.target.value)} /></div>
            <div><label className="label block mb-1.5">Número</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Nº" value={form.numero} onChange={(e) => set("numero", e.target.value)} /></div>
            <div><label className="label block mb-1.5">Complemento (opcional)</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Apto, bloco..." value={form.complemento} onChange={(e) => set("complemento", e.target.value)} /></div>
            <div><label className="label block mb-1.5">Bairro</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} /></div>
            <div><label className="label block mb-1.5">Cidade</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} /></div>
            <div><label className="label block mb-1.5">Estado</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="UF" maxLength={2} value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} /></div>
            <div><label className="label block mb-1.5">Tipo de imóvel</label><select className="select w-full px-4 py-2.5 text-sm" value={form.tipoImovel} onChange={(e) => set("tipoImovel", e.target.value)}><option>Apartamento</option><option>Casa</option><option>Kitnet</option><option>Comercial</option><option>Sala comercial</option><option>Galpão</option></select></div>
            <div><label className="label block mb-1.5">Proprietário</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Nome do proprietário" value={form.proprietario} onChange={(e) => set("proprietario", e.target.value)} /></div>
            <div className="col-span-2"><label className="label block mb-1.5">Inquilino / responsável</label><input className="input w-full px-4 py-2.5 text-sm" placeholder="Nome do inquilino (opcional)" value={form.inquilino} onChange={(e) => set("inquilino", e.target.value)} /></div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost rounded-full px-5 py-2.5 text-sm">Cancelar</button>
          <button disabled={!canSubmit} onClick={submit} className="btn-primary rounded-full px-5 py-2.5 text-sm">Criar vistoria e continuar</button>
        </div>
      </div>
    </div>
  );
}

function CapaFotoEditor({ capaFoto, locked, onChange }) {
  const fileRef = useRef(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = await fileToDataURL(await maybeCompressImage(file));
    onChange({ src, date: new Date().toISOString() });
    e.target.value = "";
  }

  return (
    <div className="mb-4 no-print">
      {capaFoto ? (
        <div className="relative w-fit">
          <img src={getUrlFoto(capaFoto.src)} alt="Foto do imóvel" style={{ width: 140, height: 95, objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)" }} />
          {capaFoto.date && <span className="photo-date" style={{ borderRadius: "0 0 12px 12px" }}>{fmtDateTime(capaFoto.date)}</span>}
          {!locked && (
            <button onClick={() => onChange(null)} className="absolute -top-2 -right-2 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 18, height: 18 }}><X size={11} /></button>
          )}
        </div>
      ) : (
        !locked && (
          <button onClick={() => fileRef.current?.click()} className="btn-ghost rounded-2xl flex items-center justify-center gap-1.5 text-xs px-4 py-3">
            <Camera size={15} /> Adicionar foto do imóvel
          </button>
        )
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
    </div>
  );
}

function DetailView({ inspection, onBack, onUpdate, customModels = [], allInspections = [], onExport }) {
  const [templateOpen, setTemplateOpen] = useState(false);
  const [tab, setTab] = useState("ambientes");
  const [showQr, setShowQr] = useState(false);
  const locked = inspection.status === "Finalizada";

  function addAmbiente(nome, itensBase = []) {
    onUpdate((insp) => ({ ...insp, ambientes: [...insp.ambientes, makeAmbiente(nome, itensBase)] }));
  }

  function applyModel(modelKeyOrObj) {
    const novos = ambientesFromModel(modelKeyOrObj);
    onUpdate((insp) => ({ ...insp, ambientes: [...insp.ambientes, ...novos] }));
  }

  function removeAmbiente(ambId) {
    onUpdate((insp) => ({ ...insp, ambientes: insp.ambientes.filter((a) => a.id !== ambId) }));
  }

  function updateAmbiente(ambId, fn) {
    onUpdate((insp) => ({ ...insp, ambientes: insp.ambientes.map((a) => (a.id === ambId ? fn(a) : a)) }));
  }

  function toggleStatus() {
    onUpdate((insp) => ({ ...insp, status: insp.status === "Finalizada" ? "Em andamento" : "Finalizada" }));
  }

  const totalItens = inspection.ambientes.reduce((a, amb) => a + amb.itens.length, 0);
  const avarias = inspection.ambientes.reduce((a, amb) => a + amb.itens.filter((it) => it.temDano).length, 0);

  return (
    <div className="min-h-full">
      <div className="topbar px-6 py-4 flex items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="btn-ghost rounded-full p-2 shrink-0"><ArrowLeft size={18} /></button>
          <div className="min-w-0">
            <h1 className="display text-base font-bold truncate">{enderecoCompleto(inspection.imovel) || "Vistoria sem endereço"}</h1>
            <p className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{inspection.tipo} · {fmtDate(inspection.dataVistoria)} · {inspection.vistoriador}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onExport} className="btn-ghost rounded-full p-2" title="Exportar esta vistoria"><Download size={16} /></button>
          <button onClick={() => setShowQr(true)} className="btn-ghost rounded-full p-2" title="QR do imóvel"><QrCode size={16} /></button>
          <button onClick={toggleStatus} className="btn-primary rounded-full px-3 py-2 text-xs flex items-center gap-1.5">
            {locked ? <Unlock size={14} /> : <Lock size={14} />}
            {locked ? "Reabrir" : "Finalizar"}
          </button>
        </div>
      </div>

      {showQr && <QrCodeModal inspection={inspection} onClose={() => setShowQr(false)} />}

      <div className={tab === "pdf" ? "max-w-6xl mx-auto px-4 py-6" : "max-w-4xl mx-auto px-6 py-6"}>
        <CapaFotoEditor capaFoto={inspection.capaFoto} locked={locked} onChange={(foto) => onUpdate((insp) => ({ ...insp, capaFoto: foto }))} />

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="badge badge-neutral">{inspection.imovel.tipoImovel}</span>
          <span className="badge badge-neutral">{inspection.mobiliario}</span>
          <span className="badge badge-neutral">{inspection.ambientes.length} ambientes</span>
          <span className="badge badge-neutral">{totalItens} itens</span>
          {avarias > 0 && <span className="badge badge-bad">{avarias} avarias registradas</span>}
          {locked && <span className="badge badge-good flex items-center gap-1"><CheckCircle2 size={11} /> Finalizada</span>}
        </div>

        <div className="flex items-center gap-2 mb-6 no-print flex-wrap">
          <button onClick={() => setTab("ambientes")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "ambientes" ? "active" : ""}`}><Layers size={14} /> Ambientes</button>
          <button onClick={() => setTab("medidores")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "medidores" ? "active" : ""}`}><Gauge size={14} /> Medidores</button>
          <button onClick={() => setTab("chaves")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "chaves" ? "active" : ""}`}><KeyRound size={14} /> Chaves</button>
          <button onClick={() => setTab("comparar")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "comparar" ? "active" : ""}`}><GitCompare size={14} /> Comparar</button>
          <button onClick={() => setTab("parecer")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "parecer" ? "active" : ""}`}><FileText size={14} /> Parecer Técnico</button>
          <button onClick={() => setTab("assinatura")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "assinatura" ? "active" : ""}`}><PenLine size={14} /> Assinatura Digital</button>
          <button onClick={() => setTab("pdf")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "pdf" ? "active" : ""}`}><Printer size={14} /> PDF</button>
        </div>

        {tab === "ambientes" && (
          <AmbientesTab
            inspection={inspection}
            locked={locked}
            templateOpen={templateOpen}
            setTemplateOpen={setTemplateOpen}
            addAmbiente={addAmbiente}
            removeAmbiente={removeAmbiente}
            updateAmbiente={updateAmbiente}
            applyModel={applyModel}
            customModels={customModels}
          />
        )}
        {tab === "medidores" && (
          <MedidoresTab
            medidores={inspection.medidores}
            locked={locked}
            onChange={(fn) => onUpdate((insp) => ({ ...insp, medidores: fn(insp.medidores) }))}
          />
        )}
        {tab === "chaves" && (
          <ChavesTab
            chaves={inspection.chaves}
            locked={locked}
            onChange={(fn) => onUpdate((insp) => ({ ...insp, chaves: fn(insp.chaves) }))}
          />
        )}
        {tab === "comparar" && (
          <ComparacaoTab inspection={inspection} allInspections={allInspections} />
        )}
        {tab === "parecer" && (
          <ParecerTecnicoTab
            parecerTecnico={inspection.parecerTecnico}
            locked={locked}
            onChange={(fn) => onUpdate((insp) => ({ ...insp, parecerTecnico: fn(insp.parecerTecnico || { texto: "", anexos: [] }) }))}
          />
        )}
        {tab === "assinatura" && (
          <AssinaturaTab inspection={inspection} locked={locked} onUpdate={onUpdate} />
        )}
        {tab === "pdf" && (
          <ReportView inspection={inspection} onUpdate={onUpdate} embedded />
        )}
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES AUXILIARES
// ============================================================



// ============================================================
// ITENS, MEDIDORES, CHAVES E PARECER
// ============================================================


// ============================================================
// MEDIDORES, CHAVES E PARECER
// ============================================================

function MedidorCard({ icon, title, data, locked, opcional, unidades, onChange }) {
  const ativo = data.ativo;

  async function handleAddPhotos(files) {
    const photos = await filesToPhotos(files);
    onChange((d) => ({ ...d, fotos: [...d.fotos, ...photos] }));
  }

  function removePhoto(idx) {
    onChange((d) => ({ ...d, fotos: d.fotos.filter((_, i) => i !== idx) }));
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="display font-semibold text-sm flex items-center gap-2">
          {icon} {title} {opcional && <span className="badge badge-neutral">Opcional</span>}
        </h3>
        {opcional && (
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none" style={{ color: "var(--ink-soft)" }}>
            <input type="checkbox" disabled={locked} checked={ativo} onChange={(e) => onChange((d) => ({ ...d, ativo: e.target.checked }))} />
            Este imóvel possui
          </label>
        )}
      </div>

      {!ativo ? (
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Não aplicável a este imóvel.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label block mb-1">Número / código</label>
              <input disabled={locked} className="input w-full px-4 py-2 text-sm" placeholder="—" value={data.numero} onChange={(e) => onChange((d) => ({ ...d, numero: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Leitura atual</label>
              <input disabled={locked} className="input w-full px-4 py-2 text-sm" placeholder="—" value={data.leitura} onChange={(e) => onChange((d) => ({ ...d, leitura: e.target.value }))} />
            </div>
            <div>
              <label className="label block mb-1">Unidade</label>
              <select disabled={locked} className="select w-full px-4 py-2 text-sm" value={data.unidade} onChange={(e) => onChange((d) => ({ ...d, unidade: e.target.value }))}>
                {(unidades || ["m³", "kWh"]).map((u) => <option key={u} value={u}>{u}</option>)}
                <option value="">Outra / não informar</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1">Concessionária</label>
              <input disabled={locked} className="input w-full px-4 py-2 text-sm" placeholder="Ex: Sabesp, Enel, Comgás..." value={data.concessionaria || ""} onChange={(e) => onChange((d) => ({ ...d, concessionaria: e.target.value }))} />
            </div>
          </div>
          <TextAreaWithDictation disabled={locked} className="px-4 py-2.5 mb-3" rows={2} placeholder="Observação..." value={data.observacoes} onChange={(val) => onChange((d) => ({ ...d, observacoes: val }))} />
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {data.fotos.map((foto, idx) => (
              <PhotoThumb key={idx} foto={foto} size={56} onRemove={!locked ? () => removePhoto(idx) : null} onUpdate={!locked ? (marcas) => onChange((d) => ({ ...d, fotos: d.fotos.map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null} />
            ))}
          </div>
          {!locked && <PhotoPicker onAdd={handleAddPhotos} small />}
        </>
      )}
    </div>
  );
}

function MedidoresTab({ medidores, locked, onChange }) {
  return (
    <div className="grid gap-4">
      <MedidorCard icon={<Droplet size={15} style={{ color: "var(--accent)" }} />} title="Água" data={medidores.agua} locked={locked} opcional={false} unidades={["m³"]} onChange={(fn) => onChange((m) => ({ ...m, agua: fn(m.agua) }))} />
      <MedidorCard icon={<Zap size={15} style={{ color: "var(--accent)" }} />} title="Energia" data={medidores.energia} locked={locked} opcional={false} unidades={["kWh"]} onChange={(fn) => onChange((m) => ({ ...m, energia: fn(m.energia) }))} />
      <MedidorCard icon={<Flame size={15} style={{ color: "var(--accent)" }} />} title="Gás" data={medidores.gas} locked={locked} opcional={true} unidades={["m³", "kg"]} onChange={(fn) => onChange((m) => ({ ...m, gas: fn(m.gas) }))} />
    </div>
  );
}

function ChaveRow({ label, data, locked, onChange, onRemove }) {
  const fotos = data.fotos || [];

  async function handleAddPhotos(files) {
    const photos = await filesToPhotos(files);
    onChange((d) => ({ ...d, fotos: [...(d.fotos || []), ...photos] }));
  }

  function removePhoto(idx) {
    onChange((d) => ({ ...d, fotos: (d.fotos || []).filter((_, i) => i !== idx) }));
  }

  return (
    <div className="card p-4 flex flex-wrap gap-3">
      <div className="flex items-center gap-2 flex-1 min-w-[140px]">
        <KeyRound size={15} style={{ color: "var(--accent)" }} />
        <span className="font-medium text-sm" style={{ color: "var(--ink-strong)" }}>{label}</span>
      </div>
      <div style={{ width: 150 }}>
        <QuantityStepper label="Qtd." value={data.quantidade} disabled={locked} onChange={(val) => onChange((d) => ({ ...d, quantidade: val }))} />
      </div>
      <div className="flex-1 min-w-[180px]">
        <label className="label block mb-1">Observação</label>
        <input disabled={locked} className="input w-full px-4 py-2 text-sm" placeholder="—" value={data.observacoes} onChange={(e) => onChange((d) => ({ ...d, observacoes: e.target.value }))} />
      </div>
      {onRemove && !locked && (
        <button onClick={onRemove} className="btn-ghost rounded-full p-2 self-end">
          <Trash2 size={14} />
        </button>
      )}
      <div className="w-full flex items-center gap-2 flex-wrap">
        {fotos.map((foto, idx) => (
          <PhotoThumb key={idx} foto={foto} size={50} onRemove={!locked ? () => removePhoto(idx) : null} onUpdate={!locked ? (marcas) => onChange((d) => ({ ...d, fotos: (d.fotos || []).map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null} />
        ))}
        {!locked && <PhotoPicker onAdd={handleAddPhotos} small />}
      </div>
    </div>
  );
}

function ChavesTab({ chaves, locked, onChange }) {
  function addOutra() {
    const nome = prompt("Nome da chave/item:");
    if (!nome || !nome.trim()) return;
    onChange((c) => ({ ...c, outras: [...c.outras, { id: uid(), nome: nome.trim(), ...emptyChave() }] }));
  }

  function updateOutra(id, fn) {
    onChange((c) => ({ ...c, outras: c.outras.map((o) => (o.id === id ? fn(o) : o)) }));
  }

  function removeOutra(id) {
    onChange((c) => ({ ...c, outras: c.outras.filter((o) => o.id !== id) }));
  }

  return (
    <div className="grid gap-3">
      {CHAVE_TIPOS.map((t) => (
        <ChaveRow key={t.key} label={t.label} data={chaves[t.key]} locked={locked} onChange={(fn) => onChange((c) => ({ ...c, [t.key]: fn(c[t.key]) }))} />
      ))}
      {chaves.outras.map((o) => (
        <ChaveRow key={o.id} label={o.nome} data={o} locked={locked} onChange={(fn) => updateOutra(o.id, fn)} onRemove={() => removeOutra(o.id)} />
      ))}
      {!locked && (
        <button onClick={addOutra} className="btn-ghost rounded-full px-4 py-2.5 text-sm flex items-center gap-2 w-fit">
          <Plus size={14} /> Outras chaves
        </button>
      )}
    </div>
  );
}

function ParecerTecnicoTab({ parecerTecnico, locked, onChange }) {
  const fileRef = useRef(null);
  const anexos = parecerTecnico?.anexos || [];

  async function handleAttach(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const novos = await Promise.all(
      files.map(async (f) => ({
        id: uid(),
        nome: f.name,
        tipo: f.type || "arquivo",
        tamanho: f.size,
        data: new Date().toISOString(),
        src: await fileToDataURL(f),
      }))
    );
    onChange((p) => ({ ...p, anexos: [...(p.anexos || []), ...novos] }));
    e.target.value = "";
  }

  function removeAnexo(id) {
    onChange((p) => ({ ...p, anexos: (p.anexos || []).filter((a) => a.id !== id) }));
  }

  return (
    <div className="grid gap-4">
      <div className="card p-5">
        <h3 className="display text-sm font-bold mb-1 flex items-center gap-2"><FileText size={15} /> Parecer técnico</h3>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>Escreva uma avaliação técnica geral do imóvel — conclusões, recomendações ou observações que não se encaixam em um item específico.</p>
        <TextAreaWithDictation disabled={locked} className="px-4 py-2.5" rows={6} placeholder="Escreva aqui o parecer técnico da vistoria..." value={parecerTecnico?.texto || ""} onChange={(val) => onChange((p) => ({ ...p, texto: val }))} />
      </div>
      <div className="card p-5">
        <h3 className="display text-sm font-bold mb-1 flex items-center gap-2"><Upload size={15} /> Anexos</h3>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>Anexe qualquer tipo de arquivo — laudos anteriores, plantas, orçamentos, PDFs, planilhas, etc.</p>
        {anexos.length > 0 && (
          <div className="grid gap-2 mb-3">
            {anexos.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ border: "1px solid var(--line)", background: "var(--card-alt)" }}>
                <div className="rounded-lg flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: "var(--card)" }}>
                  <FileText size={15} style={{ color: "var(--accent)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <a href={a.src} download={a.nome} className="text-sm font-medium truncate block" style={{ color: "var(--ink-strong)" }}>{a.nome}</a>
                  <p className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{fmtFileSize(a.tamanho)} · {fmtDateTime(a.data)}</p>
                </div>
                {!locked && (
                  <button onClick={() => removeAnexo(a.id)} className="btn-ghost rounded-full p-2 shrink-0"><Trash2 size={13} /></button>
                )}
              </div>
            ))}
          </div>
        )}
        {!locked && (
          <>
            <button onClick={() => fileRef.current?.click()} className="btn-ghost rounded-full px-4 py-2.5 text-sm flex items-center gap-2 w-fit">
              <Upload size={14} /> Anexar arquivo
            </button>
            <input ref={fileRef} type="file" multiple className="hidden" onChange={handleAttach} />
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ASSINATURAS
// ============================================================


// ============================================================
// RELATÓRIO E PDF
// ============================================================

function mediaHtml(foto) {
  const cap = foto.date ? `<p style="font-size:10px;color:#a8828a;margin:5px 0 0;font-family:'JetBrains Mono',monospace">${escapeHtml(fmtDateTime(foto.date))}</p>` : "";
  if (foto.type === "video") {
    return `<div class="media-card"><video src="${foto.src}" controls style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;background:#000;display:block"></video><div style="padding:6px 8px">${cap || '<span style="font-size:10px;color:#a8828a">Vídeo</span>'}</div></div>`;
  }
  if (foto.type === "audio") {
    return `<div class="media-card" style="width:180px"><div style="padding:10px 10px 4px"><audio src="${foto.src}" controls style="width:100%"></audio></div><div style="padding:0 10px 8px">${cap || '<span style="font-size:10px;color:#a8828a">Áudio</span>'}</div></div>`;
  }
  const marcas = foto.marcas || null;
  const pontos = Array.isArray(marcas) ? marcas : (marcas?.points || []);
  const comentarioMarcacao = Array.isArray(marcas) ? "" : (marcas?.comentario || "");
  const marcasHtml = pontos.map((p, i) => `<div style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 2px #E23B3B;background:#E23B3B;color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center">${i + 1}</div>`).join("");
  const comentarioHtml = comentarioMarcacao ? `<p style="font-size:10.5px;color:#b23e2a;margin:4px 0 0;font-weight:600">⚠ ${escapeHtml(comentarioMarcacao)}</p>` : "";
  return `<div class="media-card"><div style="position:relative;width:100%;height:120px"><img src="${getUrlFoto(foto.src)}" class="zoomable-photo" loading="lazy" style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;cursor:zoom-in;display:block" />${marcasHtml}</div><div style="padding:6px 8px">${cap}${comentarioHtml}</div></div>`;
}

function buildReportHTML(inspection, logo) {
  const totalItens = inspection.ambientes.reduce((a, amb) => a + amb.itens.length, 0);
  const avarias = inspection.ambientes.reduce((a, amb) => a + amb.itens.filter((it) => it.temDano).length, 0);

  const medidoresList = [
    { label: "Água", d: inspection.medidores.agua },
    { label: "Energia", d: inspection.medidores.energia },
    { label: "Gás", d: inspection.medidores.gas },
  ].filter((m) => m.d.ativo);

  const chavesList = [
    ...CHAVE_TIPOS.map((t) => ({ label: t.label, ...inspection.chaves[t.key] })),
    ...inspection.chaves.outras.map((o) => ({ label: o.nome, ...o })),
  ].filter((c) => c.quantidade || c.observacoes || (c.fotos || []).length);

  const estadoColors = {
    "Novo": ["#e5f6ec", "#2e8f57"], "Bom": ["#e5f6ec", "#2e8f57"],
    "Regular": ["#fdf1dc", "#a97a1f"], "Ruim": ["#fbe4e1", "#b23e2a"],
    "Péssimo": ["#f5d9dd", "#8e2e3d"], "Sem teste": ["#eef0f2", "#6b7280"],
  };

  const ambientesHtml = inspection.ambientes.map((amb, ambIdx) => {
    const fotosAmbienteHtml = (amb.fotos || []).length
      ? `<div style="margin-bottom:14px"><p class="eyebrow">Fotos/vídeos gerais do ambiente</p><div class="media-grid">${amb.fotos.map(mediaHtml).join("")}</div></div>` : "";
    const itensHtml = amb.itens.map((item) => {
      const camposPreenchidos = ITEM_FIELD_DEFS.filter((f) => (item.campos || {})[f.key]);
      const estadoLabel = item.semTeste ? "Sem teste" : item.estado;
      const [bg, fg] = estadoColors[estadoLabel] || estadoColors["Sem teste"];
      const camposLine = camposPreenchidos.length
        ? `<p class="meta-line">${camposPreenchidos.map((f) => `<strong>${f.label}:</strong> ${escapeHtml(item.campos[f.key])}`).join(" &nbsp;·&nbsp; ")}</p>` : "";
      const obsLine = item.observacoes ? `<p class="obs-line">${escapeHtml(item.observacoes)}</p>` : "";
      const danoLine = item.temDano && item.descricaoDano ? `<p class="dano-line">⚠ Avaria: ${escapeHtml(item.descricaoDano)}</p>` : "";
      const fotosHtml = (item.fotos || []).length ? `<div class="media-grid" style="margin-top:8px">${item.fotos.map(mediaHtml).join("")}</div>` : "";
      return `
        <div class="item-card">
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            <strong style="font-size:14px">${escapeHtml(item.nome)}</strong>
            <span class="pill" style="background:${bg};color:${fg}">${escapeHtml(estadoLabel)}</span>
            ${item.temDano ? `<span class="pill" style="background:#fbe4e1;color:#b23e2a">Avaria</span>` : ""}
          </div>
          ${camposLine}${obsLine}${danoLine}${fotosHtml}
        </div>`;
    }).join("");
    return `
      <div class="section-card">
        <h2 class="section-title"><span class="section-num">${String(ambIdx + 1).padStart(2, "0")}</span>${escapeHtml(amb.nome)}</h2>
        ${fotosAmbienteHtml}
        ${itensHtml}
      </div>`;
  }).join("");

  const medidoresHtml = medidoresList.length ? `
    <div class="section-card">
      <h2 class="section-title"><span class="section-num" style="background:#3d7a57">💧</span>Medidores</h2>
      ${medidoresList.map((m) => `
        <div class="item-card">
          <strong style="font-size:14px">${m.label}</strong>
          <p class="meta-line">${[
            m.d.numero && `<strong>Nº:</strong> ${m.d.numero}`,
            m.d.leitura && `<strong>Leitura:</strong> ${m.d.leitura}${m.d.unidade ? " " + m.d.unidade : ""}`,
            m.d.concessionaria && `<strong>Concessionária:</strong> ${m.d.concessionaria}`,
          ].filter(Boolean).join(" &nbsp;·&nbsp; ")}</p>
          ${m.d.observacoes ? `<p class="obs-line">${escapeHtml(m.d.observacoes)}</p>` : ""}
          ${(m.d.fotos || []).length ? `<div class="media-grid" style="margin-top:8px">${m.d.fotos.map(mediaHtml).join("")}</div>` : ""}
        </div>
      `).join("")}
    </div>` : "";

  const chavesHtml = chavesList.length ? `
    <div class="section-card">
      <h2 class="section-title"><span class="section-num" style="background:#a97a1f">🔑</span>Chaves e acessos</h2>
      ${chavesList.map((c) => `
        <div class="item-card">
          <strong style="font-size:14px">${escapeHtml(c.label)}</strong>
          <p class="meta-line">${[c.quantidade && `<strong>Qtd.:</strong> ${c.quantidade}`, c.observacoes && escapeHtml(c.observacoes)].filter(Boolean).join(" &nbsp;·&nbsp; ")}</p>
          ${(c.fotos || []).length ? `<div class="media-grid" style="margin-top:8px">${c.fotos.map(mediaHtml).join("")}</div>` : ""}
        </div>
      `).join("")}
    </div>` : "";

  const capaHtml = inspection.capaFoto ? `
    <div style="margin-bottom:22px">
      <img src="${getUrlFoto(inspection.capaFoto.src)}" class="zoomable-photo" style="width:100%;max-height:300px;object-fit:cover;border-radius:14px;cursor:zoom-in;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.12)" />
    </div>` : "";

  const sigHtml = (label, src) => `
    <div style="flex:1;min-width:200px">
      <p class="eyebrow">${label}</p>
      ${src ? `<img src="${getUrlFoto(src)}" style="width:100%;height:90px;object-fit:contain;border:1px solid #e7dcd6;border-radius:10px;background:#fff" />` : `<div style="width:100%;height:90px;border:1.5px dashed #d9cec7;border-radius:10px"></div>`}
      <div style="border-top:1px solid #e7dcd6;margin-top:36px;padding-top:4px;font-size:10px;text-align:center;color:#a8828a">Assinatura manual (se necessário)</div>
    </div>`;

  const logoHtml = logo ? `<img src="${getUrlFoto(logo)}" style="height:56px;max-width:150px;object-fit:contain;border-radius:8px" />` : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Laudo de Vistoria — ${escapeHtml(enderecoCompleto(inspection.imovel) || "VistorIA")}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #2a1c20; margin: 0; padding: 24px; background: #f4efea; }
  .toolbar { position: sticky; top: 0; background: #f4efea; padding: 10px 0 16px; display: flex; justify-content: flex-end; gap: 8px; z-index: 10; }
  .toolbar button { background: #A23A4C; color: #fff; border: none; border-radius: 999px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(162,58,76,0.25); }
  .wrap { max-width: 780px; margin: 0 auto; background: #fff; border-radius: 20px; padding: 32px; box-shadow: 0 8px 30px rgba(40,20,25,0.08); }
  .eyebrow { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: #93636d; margin: 0 0 4px; }
  .section-card { background: #fbf8f6; border: 1px solid #eee0da; border-radius: 16px; padding: 18px 20px; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
  .section-title { display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700; margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid #eee0da; color: #4e1b26; }
  .section-num { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 999px; background: #A23A4C; color: #fff; font-size: 11px; font-weight: 700; font-family: 'JetBrains Mono', monospace; flex-shrink: 0; }
  .item-card { background: #fff; border: 1px solid #f0e6e1; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
  .item-card:last-child { margin-bottom: 0; }
  .pill { display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.03em; padding: 3px 10px; border-radius: 999px; }
  .meta-line { font-size: 12px; color: #7a5a60; margin: 4px 0; line-height: 1.5; }
  .obs-line { font-size: 12.5px; color: #3a2a2e; margin: 6px 0; line-height: 1.5; }
  .dano-line { font-size: 12.5px; color: #b23e2a; font-weight: 600; margin: 6px 0; line-height: 1.5; }
  .media-grid { display: flex; gap: 10px; flex-wrap: wrap; }
  .media-card { width: 130px; border: 1px solid #eee0da; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 2px 6px rgba(40,20,25,0.06); break-inside: avoid; }
  #photo-lightbox { display: none; position: fixed; inset: 0; background: rgba(10,11,16,0.92); z-index: 1000; align-items: center; justify-content: center; padding: 24px; cursor: zoom-out; }
  #photo-lightbox.open { display: flex; }
  #photo-lightbox img { max-width: 94vw; max-height: 90vh; object-fit: contain; border-radius: 8px; }
  #photo-lightbox button { position: absolute; top: 18px; right: 18px; width: 36px; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 18px; cursor: pointer; }
  @media print {
    body { background: #fff; padding: 0; }
    .toolbar { display: none; }
    #photo-lightbox { display: none !important; }
    .wrap { box-shadow: none; border-radius: 0; padding: 12px; max-width: 100%; }
    .section-card { background: #fff; border: 1px solid #eee; }
  }
</style>
</head>
<body>
  <div class="toolbar"><button onclick="window.print()">Imprimir / salvar como PDF</button></div>
  <div id="photo-lightbox" onclick="this.classList.remove('open')">
    <button onclick="event.stopPropagation();document.getElementById('photo-lightbox').classList.remove('open')">✕</button>
    <img id="photo-lightbox-img" src="${getUrlFoto(inspection.capaFoto?.src||inspection.capaFoto)}" alt=""/>
  </div>
  <div class="wrap">
    <div style="height:6px;background:linear-gradient(90deg,#A23A4C,#c96a7a);border-radius:999px;margin-bottom:20px"></div>
    <div style="display:flex;align-items:flex-start;gap:16px;justify-content:space-between;margin-bottom:20px">
      <div style="display:flex;align-items:flex-start;gap:14px">
        ${logoHtml}
        <div>
          <h1 style="font-size:24px;margin:0;color:#4e1b26">VistorIA <span style="color:#A23A4C">—</span> Laudo de Vistoria</h1>
          <p style="font-size:12px;color:#93636d;margin:4px 0 0;font-weight:700">PEREIRA Gestão Imobiliária</p>
          <p style="font-size:12px;color:#93636d;margin:2px 0 0">Vistoria de ${escapeHtml(inspection.tipo.toLowerCase())}</p>
        </div>
      </div>
      ${inspection.status === "Finalizada" ? `<div style="border:2.5px solid #3fa76b;color:#3fa76b;border-radius:999px;padding:8px 16px;font-weight:700;font-size:12px;transform:rotate(-6deg);white-space:nowrap">✓ FINALIZADA<br/>${escapeHtml(fmtDate(inspection.dataVistoria))}</div>` : ""}
    </div>
    ${capaHtml}
    <div class="section-card" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:13.5px">
      <div><p class="eyebrow">Data</p>${escapeHtml(fmtDate(inspection.dataVistoria))}</div>
      <div><p class="eyebrow">Vistoriador</p>${escapeHtml(inspection.vistoriador || "—")}</div>
      <div style="grid-column:1 / -1"><p class="eyebrow">Endereço</p>${escapeHtml(enderecoCompleto(inspection.imovel) || "—")}</div>
      ${inspection.imovel.cep ? `<div><p class="eyebrow">CEP</p>${escapeHtml(inspection.imovel.cep)}</div>` : ""}
      <div><p class="eyebrow">Tipo de imóvel</p>${escapeHtml(inspection.imovel.tipoImovel)}</div>
      <div><p class="eyebrow">Situação (mobiliário)</p>${escapeHtml(inspection.mobiliario)}</div>
      ${inspection.imovel.metragem ? `<div><p class="eyebrow">Metragem</p>${escapeHtml(inspection.imovel.metragem)}</div>` : ""}
      <div><p class="eyebrow">Proprietário</p>${escapeHtml(inspection.imovel.proprietario || "—")}</div>
      <div><p class="eyebrow">Inquilino</p>${escapeHtml(inspection.imovel.inquilino || "—")}</div>
      <div style="grid-column:1 / -1;padding-top:6px;border-top:1px dashed #eee0da"><p class="eyebrow">Resumo</p><strong>${inspection.ambientes.length}</strong> ambientes &nbsp;·&nbsp; <strong>${totalItens}</strong> itens ${avarias > 0 ? `&nbsp;·&nbsp; <span style="color:#b23e2a;font-weight:700">${avarias} avarias</span>` : ""}</div>
    </div>
    ${ambientesHtml}
    ${medidoresHtml}
    ${chavesHtml}
    <div style="display:flex;gap:20px;flex-wrap:wrap;border-top:1px dashed #ddd;padding-top:20px;margin-top:20px">
      ${sigHtml("Assinatura do vistoriador", inspection.signatures?.vistoriador)}
      ${sigHtml("Assinatura do locador", inspection.signatures?.locador)}
      ${sigHtml("Assinatura do locatário", inspection.signatures?.locatario)}
    </div>
  </div>
  <script>
    document.addEventListener('click', function (e) {
      var img = e.target.closest('.zoomable-photo');
      if (!img) return;
      var lightbox = document.getElementById('photo-lightbox');
      document.getElementById('photo-lightbox-img').src = img.src;
      lightbox.classList.add('open');
    });
  </script>
</body>
</html>`;
}

function ReportView({ inspection, onUpdate, onClose, embedded = false }) {
  const openLightbox = useContext(LightboxContext);
  const [printHint, setPrintHint] = useState(false);
  const [logo, setLogo] = useState(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const logoFileRef = useRef(null);
  const totalItens = inspection.ambientes.reduce((a, amb) => a + amb.itens.length, 0);
  const avarias = inspection.ambientes.reduce((a, amb) => a + amb.itens.filter((it) => it.temDano).length, 0);

  useEffect(() => {
    (async () => {
      try {
        const r = await storage.get("app-logo");
        if (r) setLogo(r.value);
      } catch {
        // no logo saved yet
      } finally {
        setLogoLoaded(true);
      }
    })();
  }, []);

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataURL(await maybeCompressImage(file));
    setLogo(dataUrl);
    try {
      await storage.set("app-logo", dataUrl);
    } catch {
      // ignore save failure, logo still shown for this session
    }
    e.target.value = "";
  }

  async function handleRemoveLogo() {
    setLogo(null);
    try {
      await storage.delete("app-logo");
    } catch {
      // ignore
    }
  }

  function handlePrint() {
    const html = buildReportHTML(inspection, logo);
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, "_blank");
      if (!win) {
        setPrintHint(true);
      }
    } catch {
      setPrintHint(true);
    }
  }

  function buildShareText() {
    const totalItensLocal = inspection.ambientes.reduce((a, amb) => a + amb.itens.length, 0);
    const avariasLocal = inspection.ambientes.reduce((a, amb) => a + amb.itens.filter((it) => it.temDano).length, 0);
    return [
      `📋 Laudo de Vistoria — VistorIA`,
      `PEREIRA Gestão Imobiliária`,
      ``,
      `Tipo: ${inspection.tipo}`,
      `Data: ${fmtDate(inspection.dataVistoria)}`,
      `Vistoriador: ${inspection.vistoriador || "—"}`,
      `Endereço: ${enderecoCompleto(inspection.imovel) || "—"}`,
      `Status: ${inspection.status}`,
      ``,
      `Resumo: ${inspection.ambientes.length} ambientes, ${totalItensLocal} itens, ${avariasLocal} avarias`,
      ``,
      `Gere o PDF completo pelo botão "Imprimir / salvar PDF" no VistorIA e anexe aqui.`,
    ].join("\n");
  }

  async function handleShare() {
    const text = buildShareText();
    if (navigator.share) {
      try {
        await navigator.share({ title: "Laudo de Vistoria — VistorIA", text });
        return;
      } catch {
        // fell through to WhatsApp link below if share was cancelled/unsupported
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  const medidoresList = [
    { label: "Água", d: inspection.medidores.agua },
    { label: "Energia", d: inspection.medidores.energia },
    { label: "Gás", d: inspection.medidores.gas },
  ].filter((m) => m.d.ativo);

  const chavesList = [
    ...CHAVE_TIPOS.map((t) => ({ label: t.label, ...inspection.chaves[t.key] })),
    ...inspection.chaves.outras.map((o) => ({ label: o.nome, ...o })),
  ].filter((c) => c.quantidade || c.observacoes);

  return (
    <div className={embedded ? "" : "min-h-full"}>
      <div className={`topbar px-6 py-4 flex items-center justify-between no-print flex-wrap gap-2 ${embedded ? "rounded-2xl mb-4" : ""}`}>
        <div className="flex items-center gap-3">
          {!embedded && (
            <button onClick={onClose} className="btn-ghost rounded-full p-2">
              <ArrowLeft size={18} />
            </button>
          )}
          <h1 className="display text-base font-bold">Laudo de vistoria</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleShare} className="btn-secondary rounded-full px-4 py-2 text-sm flex items-center gap-2">
            <Share2 size={15} /> Compartilhar
          </button>
          <button onClick={handlePrint} className="btn-primary rounded-full px-4 py-2 text-sm flex items-center gap-2">
            <Printer size={15} /> Imprimir / salvar PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-3 no-print">
        <div className="rounded-xl px-4 py-3 text-xs flex items-start gap-2" style={{ background: "var(--card-alt)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>
          <Info size={14} className="shrink-0 mt-0.5" />
          <span>
            O botão abre o laudo pronto em uma nova aba, já formatado para leitura e impressão — use o botão "Imprimir / salvar como PDF" dentro dessa aba. {printHint && (
              <>Se a aba não abriu, seu navegador pode ter bloqueado o pop-up: permita pop-ups para este site e toque no botão novamente.</>
            )}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 print-area">
        <div className="card p-10">
          <div className="flex items-start justify-between mb-6 pb-4 divider">
            <div className="flex items-start gap-4">
              {logoLoaded && (
                logo ? (
                  <div className="relative group">
                    <img src={getUrlFoto(logo)} alt="Logo" style={{ height: 52, maxWidth: 140, objectFit: "contain" }} />
                    <button onClick={handleRemoveLogo} className="no-print absolute -top-2 -right-2 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }} title="Remover logo"><X size={10} /></button>
                  </div>
                ) : (
                  <button onClick={() => logoFileRef.current?.click()} className="btn-ghost rounded-xl px-3 py-2 text-xs flex flex-col items-center justify-center gap-1 no-print" style={{ width: 90, height: 52 }}>
                    <Camera size={14} /> Add. logo
                  </button>
                )
              )}
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden no-print" onChange={handleLogoUpload} />
              <div>
                <h1 className="display text-2xl font-bold">Vistor<span style={{ color: "var(--accent)" }}>IA</span> — Laudo de Vistoria</h1>
                <p className="text-sm mono mt-1" style={{ color: "var(--ink-soft)" }}>Vistoria de {inspection.tipo.toLowerCase()}</p>
              </div>
            </div>
            {inspection.status === "Finalizada" && (
              <div className="stamp px-4 py-2 text-xs">FINALIZADA<br />{fmtDate(inspection.dataVistoria)}</div>
            )}
          </div>

          {inspection.capaFoto && (
            <div className="mb-6 print-block">
              <img src={getUrlFoto(inspection.capaFoto.src)} alt="Foto do imóvel" loading="lazy" className="cursor-zoom-in" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} onClick={() => openLightbox(inspection.capaFoto.src)} />
              {inspection.capaFoto.date && (
                <p className="text-[10px] mono mt-1" style={{ color: "var(--ink-soft)" }}>Foto registrada em {fmtDateTime(inspection.capaFoto.date)}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div><span className="label block mb-0.5">Data</span>{fmtDate(inspection.dataVistoria)}</div>
            <div><span className="label block mb-0.5">Vistoriador</span>{inspection.vistoriador || "—"}</div>
            <div className="col-span-2"><span className="label block mb-0.5">Endereço</span>{enderecoCompleto(inspection.imovel) || "—"}</div>
            {inspection.imovel.cep && <div><span className="label block mb-0.5">CEP</span>{inspection.imovel.cep}</div>}
            <div><span className="label block mb-0.5">Tipo de imóvel</span>{inspection.imovel.tipoImovel}</div>
            <div><span className="label block mb-0.5">Situação (mobiliário)</span>{inspection.mobiliario}</div>
            {inspection.imovel.metragem && <div><span className="label block mb-0.5">Metragem</span>{inspection.imovel.metragem}</div>}
            <div><span className="label block mb-0.5">Proprietário</span>{inspection.imovel.proprietario || "—"}</div>
            <div><span className="label block mb-0.5">Inquilino</span>{inspection.imovel.inquilino || "—"}</div>
            <div className="col-span-2"><span className="label block mb-0.5">Resumo</span>{inspection.ambientes.length} ambientes, {totalItens} itens, {avarias} avarias</div>
          </div>

          {inspection.ambientes.map((amb, ambIdx) => (
            <div key={amb.id} className="mb-6 print-ambiente">
              <h2 className="display text-base font-bold mb-2 pb-1 divider flex items-center gap-2">
                <span className="mono font-bold flex items-center justify-center rounded-full" style={{ width: 20, height: 20, fontSize: 10, background: "var(--accent)", color: "#F3E4E7" }}>{String(ambIdx + 1).padStart(2, "0")}</span>
                {amb.nome}
              </h2>
              {(amb.fotos || []).length > 0 && (
                <div className="mb-3">
                  <p className="label mb-1.5">Fotos/vídeos gerais do ambiente</p>
                  <div className="flex gap-2 flex-wrap">
                    {amb.fotos.map((foto, fi) => (
                      <div key={fi} className="text-center">
                        <img src={getUrlFoto(foto.src)} alt="" loading="lazy" className="rounded-md object-cover cursor-zoom-in" style={{ width: 70, height: 70, border: "1px solid var(--line)" }} onClick={() => openLightbox(foto.src)} />
                        {foto.date && <p className="text-[9px] mono mt-0.5" style={{ color: "var(--ink-soft)" }}>{fmtDateTime(foto.date)}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid gap-3">
                {amb.itens.map((item) => {
                  const camposPreenchidos = ITEM_FIELD_DEFS.filter((f) => (item.campos || {})[f.key]);
                  return (
                    <div key={item.id} className="text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">{item.nome}</span>
                        {item.semTeste ? (
                          <span className="badge badge-neutral">Sem teste</span>
                        ) : (
                          <span className={`badge ${item.estado === "Bom" || item.estado === "Novo" ? "badge-good" : item.estado === "Regular" ? "badge-warn" : item.estado === "Péssimo" ? "badge-worse" : "badge-bad"}`}>{item.estado}</span>
                        )}
                        {item.temDano && <span className="badge badge-bad flex items-center gap-1"><AlertTriangle size={10} /> Avaria</span>}
                      </div>
                      {camposPreenchidos.length > 0 && (
                        <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>{camposPreenchidos.map((f) => `${f.label}: ${item.campos[f.key]}`).join(" · ")}</p>
                      )}
                      {item.observacoes && <p className="mt-1" style={{ color: "var(--ink-soft)" }}>{item.observacoes}</p>}
                      {item.temDano && item.descricaoDano && (
                        <p className="mt-1" style={{ color: "var(--bad)" }}>Avaria: {item.descricaoDano}</p>
                      )}
                      {item.fotos.length > 0 && (
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {item.fotos.map((foto, i) => {
                            const marcasObj = foto.marcas || null;
                            const pontos = Array.isArray(marcasObj) ? marcasObj : (marcasObj?.points || []);
                            const comentarioMarcacao = Array.isArray(marcasObj) ? "" : (marcasObj?.comentario || "");
                            return (
                              <div key={i} className="text-center" style={{ maxWidth: 90 }}>
                                <div className="relative inline-block" style={{ width: 70, height: 70 }}>
                                  <img src={getUrlFoto(foto.src)} alt="" loading="lazy" className="rounded-md object-cover cursor-zoom-in" style={{ width: 70, height: 70, border: "1px solid var(--line)" }} onClick={() => openLightbox(foto.src)} />
                                  {pontos.map((p, mi) => (
                                    <div key={mi} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 13, height: 13, borderRadius: "50%", border: "2px solid #E23B3B", background: "rgba(226,59,59,0.3)", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{mi + 1}</div>
                                  ))}
                                </div>
                                {foto.date && <p className="text-[9px] mono mt-0.5" style={{ color: "var(--ink-soft)" }}>{fmtDateTime(foto.date)}</p>}
                                {comentarioMarcacao && <p className="text-[9px] mt-0.5" style={{ color: "var(--bad)" }}>{comentarioMarcacao}</p>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {medidoresList.length > 0 && (
            <div className="mb-6 print-block">
              <h2 className="display text-base font-bold mb-2 pb-1 divider">Medidores</h2>
              <div className="grid gap-2 text-sm">
                {medidoresList.map((m) => (
                  <div key={m.label}>
                    <span className="font-medium">{m.label}</span>
                    <span style={{ color: "var(--ink-soft)" }}>{" — "}{m.d.numero ? `nº ${m.d.numero}` : ""}{m.d.leitura ? ` · leitura ${m.d.leitura}${m.d.unidade ? " " + m.d.unidade : ""}` : ""}{m.d.concessionaria ? ` · ${m.d.concessionaria}` : ""}{m.d.observacoes ? ` · ${m.d.observacoes}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chavesList.length > 0 && (
            <div className="mb-6 print-block">
              <h2 className="display text-base font-bold mb-2 pb-1 divider">Chaves</h2>
              <div className="grid gap-1 text-sm">
                {chavesList.map((c, i) => (
                  <div key={i}>
                    <span className="font-medium">{c.label}</span>
                    <span style={{ color: "var(--ink-soft)" }}>{c.quantidade ? ` — qtd. ${c.quantidade}` : ""}{c.observacoes ? ` · ${c.observacoes}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="divider pt-6 mt-8 flex gap-6 flex-wrap">
            <SignaturePad label="Assinatura do vistoriador" value={inspection.signatures?.vistoriador} locked={inspection.status === "Finalizada"} onSave={(dataUrl) => onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriador: dataUrl } }))} />
            <SignaturePad label="Assinatura do locador" value={inspection.signatures?.locador} locked={inspection.status === "Finalizada"} onSave={(dataUrl) => onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locador: dataUrl } }))} />
            <SignaturePad label="Assinatura do locatário" value={inspection.signatures?.locatario} locked={inspection.status === "Finalizada"} onSave={(dataUrl) => onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatario: dataUrl } }))} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// OUTRAS FUNÇÕES UTILITÁRIAS
// ============================================================

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

async function maybeCompressImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const { width, height } = await getImageDimensions(file);
    const alreadySmallDim = Math.max(width, height) <= 1200;
    const alreadySmallFile = file.size <= 250 * 1024;
    const compressed = await compressImageFile(file);
    return compressed.size < file.size ? compressed : file;
  } catch {
    return file;
  }
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
    img.src = url;
  });
}

function compressImageFile(file, maxDim = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
          if (!blob) { reject(new Error("Falha ao comprimir imagem.")); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
        }, "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
    img.src = url;
  });
}

function Lightbox({ src, marcas = null, onClose }) {
  if (!src) return null;
  
  const pontos = Array.isArray(marcas) ? marcas : (marcas?.points || []);
  const comentarioMarcacao = Array.isArray(marcas) ? "" : (marcas?.comentario || "");

  return (
    <div
      className="no-print"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out",
      }}
    >
      <button
        onClick={onClose}
        style={{ position: "absolute", top: 18, right: 18, width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <X size={18} />
      </button>
      <div className="relative" style={{ maxWidth: "94vw", maxHeight: "90vh" }}>
        <img
          src={getUrlFoto(src)}
          alt=""
          style={{ maxWidth: "94vw", maxHeight: "90vh", width: "auto", height: "auto", objectFit: "contain", borderRadius: 8 }}
          onClick={(e) => e.stopPropagation()}
        />
        {pontos.map((p, i) => (
          <div
            key={i}
            style={{
              position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)",
              width: 26, height: 26, borderRadius: "50%", border: "3px solid #E23B3B",
              background: "rgba(226,59,59,0.25)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer"
            }}
            title={comentarioMarcacao || undefined}
          >
            {i + 1}
          </div>
        ))}
      </div>
    </div>
  );
}

function buildExampleInspection() {
  return {
    id: uid(),
    tipo: "Entrada",
    dataVistoria: todayISO(),
    vistoriador: "Vistoriador Exemplo",
    mobiliario: "Mobiliado",
    imovel: {
      cep: "01310-100", endereco: "Avenida Paulista", numero: "1000", bairro: "Bela Vista",
      cidade: "São Paulo", estado: "SP", complemento: "Apto 52", metragem: "68 m²",
      proprietario: "Maria Souza", inquilino: "João Pereira", tipoImovel: "Apartamento",
    },
    capaFoto: null,
    ambientes: [],
    medidores: { agua: {}, energia: {}, gas: {} },
    chaves: { entrada: {}, garagem: {}, controle: {}, tags: {}, outras: [] },
    signatures: { vistoriador: null, locador: null, locatario: null },
    parecerTecnico: { texto: "", anexos: [] },
    createdAt: Date.now(),
  };
}

