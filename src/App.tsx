// @ts-nocheck
import { HeaderCameraButton } from './components/UploadButton';
import { getUrlFoto, filesToPhotos, mediaTypeOf, compressImageFile } from './utils/helpers';
import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import {
  Plus, ChevronDown, ChevronRight, Camera, Trash2, AlertTriangle,
  FileText, ArrowLeft, Search, Building2, Calendar, Printer,
  X, CheckCircle2, ClipboardList, Layers, MapPin, Lock, Unlock,
  PenLine, RotateCcw, Cloud, CloudOff, Loader2, Gauge, KeyRound, 
  Flame, Droplet, Zap, Info, EyeOff, Eye,
  Upload, ImagePlus, Wand2, Trash, Sun, Moon, Video, Play, HelpCircle, Mic,
  Pencil, Eraser, Share2, QrCode, GitCompare, Hash, Check, Target, Download
} from "lucide-react";
import { storage } from "./lib/storage";
import CloudSyncWidget from "./components/CloudSyncWidget";
import { enviarTodasFotosParaSupabase } from './uploadFotos.js';
import { supabase } from './components/supabaseClient.js';
import { uid, makeItem, makeAmbiente, fmtDate, fmtDateTime, emptyInspection } from './utils/helpers';
import { withDefaults } from './utils/helpers';
import { MediaPicker, PhotoThumb, TextAreaWithDictation } from './components/MediaComponents';
import { filesToPhotos } from './utils/helpers';
import { PromptModal, Lightbox, QrCodeModal } from './components/Modals';
// =====================================================================
// 🛠️ FUNÇÕES AUXILIARES E CONSTANTES GLOBAIS
// =====================================================================

export const LightboxContext = createContext(() => {});

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

// Pre-filled suggestion lists per technical field
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

// Which technical fields actually make sense for a given item
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

// =====================================================================
// 🏠 MODELOS DE IMÓVEIS
// =====================================================================

const PROPERTY_MODELS = {
  Kitnet: { label: "Kitnet", descricao: "Ambiente integrado, ideal para vistorias rápidas de imóveis compactos.", ambientes: { "Ambiente Integrado (Sala/Quarto)": ["Teto", "Parede", "Piso", "Rodapé", "Porta", "Janela", "Tomadas", "Iluminação", "Armário embutido"], "Cozinha": TEMPLATES["Cozinha"], "Banheiro": TEMPLATES["Banheiro"] } },
  Casa: { label: "Casa", descricao: "Modelo completo com área externa, ideal para casas térreas ou sobrados.", ambientes: { "Sala de Estar": TEMPLATES["Sala de Estar"], "Cozinha": TEMPLATES["Cozinha"], "Quarto 1": TEMPLATES["Quarto"], "Quarto 2": TEMPLATES["Quarto"], "Banheiro": TEMPLATES["Banheiro"], "Lavabo": TEMPLATES["Lavabo"], "Área de Serviço": TEMPLATES["Área de Serviço"], "Corredor/Hall": TEMPLATES["Corredor/Hall"], "Área Externa": TEMPLATES["Área Externa"] } },
  Apartamento: { label: "Apartamento", descricao: "Modelo padrão para apartamentos residenciais.", ambientes: { "Sala de Estar": TEMPLATES["Sala de Estar"], "Cozinha": TEMPLATES["Cozinha"], "Quarto 1": TEMPLATES["Quarto"], "Banheiro": TEMPLATES["Banheiro"], "Área de Serviço": TEMPLATES["Área de Serviço"], "Corredor/Hall": TEMPLATES["Corredor/Hall"] } },
  Comercial: { label: "Comercial", descricao: "Modelo para salas comerciais, escritórios e lojas.", ambientes: { "Recepção": ["Teto", "Parede", "Piso", "Porta", "Iluminação", "Tomadas"], "Sala Principal": ["Teto", "Parede", "Piso", "Janela", "Iluminação", "Tomadas", "Ar-condicionado"], "Banheiro": TEMPLATES["Banheiro"], "Copa/Kitchenette": ["Piso", "Pia", "Bancada", "Tomadas", "Iluminação"], "Depósito": ["Piso", "Parede", "Teto", "Iluminação", "Prateleiras"] } },
  "Checklist Completo": { label: "Checklist Completo", descricao: "Roteiro amplo com os itens mais cobrados em vistorias.", ambientes: { "Estrutura Geral": ["Paredes (rachaduras/trincas)", "Pintura", "Piso", "Rodapé", "Teto (infiltração/mofo)", "Portas", "Fechaduras e trincos", "Dobradiças", "Janelas", "Vidros", "Iluminação", "Tomadas", "Interruptores", "Quadro de luz"], "Cozinha": ["Pia (vazamentos)", "Torneiras", "Escoamento/ralo", "Gabinete e armários", "Azulejo", "Exaustor/Coifa", "Ponto de gás", "Tomadas", "Piso (impermeabilização)"], "Banheiro": ["Vaso sanitário (descarga)", "Vedação da base do vaso", "Box (vidro/trilho)", "Chuveiro e registro", "Pia/bancada", "Ralos", "Espelho", "Ventilação", "Azulejos"], "Quartos": ["Armário embutido", "Portas", "Janelas (vedação)", "Piso (nivelamento/ruído)"], "Área de Serviço": ["Tanque", "Torneira do tanque", "Ponto para máquina de lavar", "Ralo/esgoto"], "Área Externa / Garagem": ["Portão", "Controle do portão", "Piso da garagem", "Muros", "Jardim/quintal"], "Medidores e Instalações": ["Medidor de água (leitura)", "Medidor de energia (leitura)", "Medidor de gás", "Registro geral de água"], "Chaves e Acessos": ["Chaves de entrada", "Chaves da garagem", "Controles", "Tags/cartões de acesso"], "Segurança": ["Extintores (validade)", "Detectores de fumaça", "Grades e proteções de janelas"] } },
};

// =====================================================================
// 🧰 CRIAÇÃO DE OBJETOS E FUNÇÕES UTILITÁRIAS
// =====================================================================







function ambientesFromModel(modelKeyOrObj) {
  const model = typeof modelKeyOrObj === "string" ? PROPERTY_MODELS[modelKeyOrObj] : modelKeyOrObj;
  if (!model || !model.ambientes) return [];
  return Object.entries(model.ambientes).map(([nome, itens]) => makeAmbiente(nome, itens));
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function mediaTypeOf(file) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
}

function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
    img.src = url;
  });
}

// Resizes to at most 1200px on the longest side and re-encodes as JPEG at 80% quality
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

// Decides whether an image is worth compressing.
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

async function filesToPhotos(files) {
  const processed = await Promise.all(files.map((f) => (f.type.startsWith("image/") ? maybeCompressImage(f) : f)));
  const urls = await Promise.all(processed.map(fileToDataURL));
  const now = new Date().toISOString();
  return urls.map((src, i) => ({ src, date: now, type: mediaTypeOf(files[i]), marcas: [] }));
}

function normalizePhoto(p) {
  if (typeof p === "string") return { src: p, date: null, type: "image", marcas: [] };
  return { type: "image", marcas: [], ...p };
}



function todayISO() { return new Date().toISOString().slice(0, 10); }

function enderecoCompleto(imovel) {
  if (!imovel) return "";
  const linha1 = [imovel.endereco, imovel.numero && `nº ${imovel.numero}`].filter(Boolean).join(", ");
  const linha2 = [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(" - ");
  const comp = imovel.complemento ? ` (${imovel.complemento})` : "";
  return [linha1, linha2].filter(Boolean).join(" - ") + comp;
}



function emptyMedidor(opcional = false, unidadePadrao = "") {
  return { ativo: !opcional, numero: "", leitura: "", unidade: unidadePadrao, concessionaria: "", marca: "", observacoes: "", fotos: [] };
}

function emptyChave() { return { quantidade: "", observacoes: "", fotos: [] }; }



// =====================================================================
// 💾 PERSISTÊNCIA DE DADOS
// =====================================================================

const STORAGE_INDEX_KEY = "insp-index";
const inspKey = (id) => `insp:${id}`;

async function storageLoadAll() {
  try {
    const idxRes = await storage.get(STORAGE_INDEX_KEY);
    const ids = idxRes ? JSON.parse(idxRes.value) : [];
    const results = await Promise.all(ids.map(async (id) => { try { const r = await storage.get(inspKey(id)); return r ? JSON.parse(r.value) : null; } catch { return null; } }));
    return results.filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch { return []; }
}

async function storageSaveInspection(insp) { await storage.set(inspKey(insp.id), JSON.stringify(insp)); }
async function storageSaveIndex(ids) { await storage.set(STORAGE_INDEX_KEY, JSON.stringify(ids)); }
async function storageDeleteInspection(id, remainingIds) { await storage.delete(inspKey(id)).catch(() => {}); await storageSaveIndex(remainingIds); }

function buildExampleInspection() {
  const ambientes = ambientesFromModel("Apartamento");
  const cozinha = ambientes.find((a) => a.nome === "Cozinha");
  if (cozinha) {
    const pia = cozinha.itens.find((i) => i.nome === "Pia");
    if (pia) { pia.estado = "Regular"; pia.temDano = true; pia.descricaoDano = "Pequeno vazamento identificado no sifão."; pia.observacoes = "Recomenda-se reparo antes da próxima vistoria."; }
  }
  const sala = ambientes.find((a) => a.nome === "Sala de Estar");
  if (sala) { const piso = sala.itens.find((i) => i.nome === "Piso"); if (piso) piso.observacoes = "Piso laminado em bom estado, sem riscos aparentes."; }
  return {
    tipo: "Entrada", dataVistoria: todayISO(), vistoriador: "Vistoriador Exemplo", mobiliario: "Mobiliado", capaFoto: null, ambientes,
    imovel: { cep: "01310-100", endereco: "Avenida Paulista", numero: "1000", bairro: "Bela Vista", cidade: "São Paulo", estado: "SP", complemento: "Apto 52", metragem: "68 m²", proprietario: "Maria Souza", inquilino: "João Pereira", tipoImovel: "Apartamento" },
    medidores: {
      agua: { ativo: true, numero: "883421", leitura: "1245", unidade: "m³", concessionaria: "Sabesp", observacoes: "Leitura registrada no início da vistoria.", fotos: [] },
      energia: { ativo: true, numero: "55219087", leitura: "08234", unidade: "kWh", concessionaria: "Enel", observacoes: "", fotos: [] },
      gas: { ativo: false, numero: "", leitura: "", unidade: "", marca: "", observacoes: "", fotos: [] },
    },
    chaves: { entrada: { quantidade: "2", observacoes: "Chaves tetra" }, garagem: { quantidade: "1", observacoes: "" }, controle: { quantidade: "1", observacoes: "Controle do portão da garagem" }, tags: { quantidade: "2", observacoes: "Tags de acesso à portaria" }, outras: [] },
  };
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function fmtFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// =====================================================================
// 📷 COMPONENTES DE MÍDIA E ANOTAÇÃO
// =====================================================================

function MediaPicker({ onAdd, multiple = true, small = false }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const videoRef = useRef(null);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recError, setRecError] = useState("");

  async function handlePick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) await onAdd(files);
    e.target.value = "";
  }
  async function handleVideoRecorded(file) { setRecordingVideo(false); await onAdd([file]); }

  const btnClass = small ? "btn-ghost rounded-xl flex flex-col items-center justify-center gap-0.5" : "btn-ghost rounded-2xl flex items-center justify-center gap-1.5 text-xs px-3 py-2.5";
  const size = small ? { width: 60, height: 60 } : undefined;
  const label = (txt) => (small ? <span className="text-[9px] text-center leading-tight">{txt}</span> : <span>{txt}</span>);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => cameraRef.current?.click()} className={btnClass} style={size}><Camera size={small ? 16 : 14} />{label("Tirar foto")}</button>
        <button type="button" onClick={() => galleryRef.current?.click()} className={btnClass} style={size}><Upload size={small ? 16 : 14} />{label("Enviar imagem")}</button>
        <button type="button" onClick={() => { setRecError(""); setRecordingVideo(true); }} className={btnClass} style={size}><Video size={small ? 16 : 14} />{label("Gravar vídeo")}</button>
        <button type="button" onClick={() => videoRef.current?.click()} className={btnClass} style={size}><Upload size={small ? 16 : 14} />{label("Enviar vídeo")}</button>
      </div>
      {recError && <p className="text-xs" style={{ color: "var(--bad)" }}>{recError}</p>}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple={multiple} className="hidden" onChange={handlePick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handlePick} />
      <input ref={videoRef} type="file" accept="video/*" multiple={multiple} className="hidden" onChange={handlePick} />
      {recordingVideo && <VideoRecorderModal onSave={handleVideoRecorded} onClose={() => setRecordingVideo(false)} onError={(msg) => { setRecordingVideo(false); setRecError(msg); }} />}
    </div>
  );
}

// Kept as an alias so existing call sites keep working.
function PhotoPicker(props) { return <MediaPicker {...props} />; }

// Live camera preview + record/stop
function VideoRecorderModal({ onSave, onClose, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        setReady(true);
      } catch { onError("Não foi possível acessar a câmera. Verifique as permissões do navegador."); }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function startRecording() {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: "video/webm" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onSave(file);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() { recorderRef.current?.stop(); }

  return (
    <div className="no-print modal-fade" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card modal-pop p-4" style={{ maxWidth: 460, width: "100%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="display text-sm font-bold">Gravar vídeo</h3>
          <button onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onClose(); }} className="btn-ghost rounded-full p-1.5"><X size={14} /></button>
        </div>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", background: "#000", position: "relative" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} />
          {recording && <span className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E23B3B" }} className="pulseRing" /> Gravando</span>}
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {!recording ? <button onClick={startRecording} disabled={!ready} className="btn-primary rounded-full px-5 py-2.5 text-sm flex items-center gap-2"><Video size={15} /> Iniciar gravação</button> : <button onClick={stopRecording} className="btn-primary rounded-full px-5 py-2.5 text-sm flex items-center gap-2" style={{ background: "var(--bad)" }}>Parar e salvar</button>}
        </div>
      </div>
    </div>
  );
}

// Lets the person tap on a photo to drop red markers
function PhotoAnnotator({ src, marcas, onSave, onClose }) {
  const marcasArray = Array.isArray(marcas) ? marcas : (marcas?.points || []);
  const marcasComentario = Array.isArray(marcas) ? "" : (marcas?.comentario || "");
  const [pontos, setPontos] = useState(marcasArray);
  const [comentario, setComentario] = useState(marcasComentario);
  const imgRef = useRef(null);

  function handleClick(e) {
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPontos((prev) => [...prev, { x, y }]);
  }
  function undo() { setPontos((prev) => prev.slice(0, -1)); }
  function save() { onSave({ points: pontos, comentario }); onClose(); }

  return (
    <div className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card p-4" style={{ maxWidth: 520, width: "100%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="display text-sm font-bold">Marcar avaria na foto</h3>
          <button onClick={onClose} className="btn-ghost rounded-full p-1.5"><X size={14} /></button>
        </div>
        <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>Toque na foto para marcar o ponto exato da avaria.</p>
        <div className="relative" style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", cursor: "crosshair" }}>
          <img ref={imgRef} src={getUrlFoto(src)} alt="" onClick={handleClick} style={{ width: "100%", height: "auto", maxHeight: 500, objectFit: "contain", display: "block", userSelect: "none" }} />
          {pontos.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 22, height: 22, borderRadius: "50%", border: "2.5px solid #E23B3B", background: "rgba(226,59,59,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{i + 1}</div>
          ))}
        </div>
        <div className="mt-3">
          <label className="label block mb-1.5">Comentário / observação da marcação</label>
          <textarea className="textarea w-full px-4 py-2.5 text-sm" rows={2} placeholder="Descreva a avaria marcada..." value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-2 mt-3">
          <button onClick={undo} disabled={pontos.length === 0} className="btn-ghost rounded-full px-3 py-2 text-xs">Desfazer último</button>
          <div className="flex gap-2"><button onClick={onClose} className="btn-ghost rounded-full px-3 py-2 text-xs">Cancelar</button><button onClick={save} className="btn-primary rounded-full px-4 py-2 text-xs">Salvar marcações</button></div>
        </div>
      </div>
    </div>
  );
}

function PhotoThumb({ foto, size = 60, onRemove, onUpdate }) {
  const openLightbox = useContext(LightboxContext);
  const [annotating, setAnnotating] = useState(false);
  const type = foto.type || "image";
  const marcas = foto.marcas || null;
  const pontos = Array.isArray(marcas) ? marcas : (marcas?.points || []);
  const comentarioMarcacao = Array.isArray(marcas) ? "" : (marcas?.comentario || "");

  if (type === "video") {
    return (
      <div className="photo-thumb" style={{ width: size, height: size, background: "#000" }}>
        <video src={foto.src} className="w-full h-full object-cover cursor-zoom-in" onClick={() => openLightbox(foto.src)} muted />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Play size={size > 70 ? 22 : 16} color="#fff" fill="#fff" style={{ opacity: 0.85 }} /></div>
        {foto.date && <span className="photo-date">{fmtDateTime(foto.date).split(" ")[0]}</span>}
        {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }}><X size={10} /></button>}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="photo-thumb flex flex-col items-center justify-center gap-1 p-1" style={{ width: Math.max(size, 130), height: size, background: "var(--card-alt)" }}>
        <audio src={foto.src} controls style={{ width: "100%", height: 28 }} />
        {foto.date && <span className="text-[8px] mono" style={{ color: "var(--ink-soft)" }}>{fmtDateTime(foto.date)}</span>}
        {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }}><X size={10} /></button>}
      </div>
    );
  }

  return (
    <div className="photo-thumb" style={{ width: size, height: size }}>
      <img src={getUrlFoto(foto.src)} alt="" loading="lazy" className="w-full h-full object-contain cursor-zoom-in" onClick={() => openLightbox(getUrlFoto(foto.src))} />
      {pontos.map((p, i) => (
        <div key={i} title={comentarioMarcacao || undefined} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", border: "1.5px solid #E23B3B", background: "rgba(226,59,59,0.35)" }} />
      ))}
      {foto.date && <span className="photo-date">{fmtDateTime(foto.date).split(" ")[0]}</span>}
      {onUpdate && <button onClick={(e) => { e.stopPropagation(); setAnnotating(true); }} className="absolute bottom-0.5 left-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }} title="Marcar avaria na foto"><Target size={10} /></button>}
      {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }}><X size={10} /></button>}
      {annotating && <PhotoAnnotator src={foto.src} marcas={marcas} onSave={(novasMarcas) => onUpdate(novasMarcas)} onClose={() => setAnnotating(false)} />}
    </div>
  );
}

function TextAreaWithDictation({ value, onChange, placeholder, rows = 2, disabled, className = "", style }) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef(null);
  const baseValueRef = useRef(value);

  function toggleDictation() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setUnsupported(true); return; }
    baseValueRef.current = value;
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const prefix = baseValueRef.current ? baseValueRef.current.trim() + " " : "";
      onChange(prefix + transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }

  return (
    <div className="relative">
      <textarea disabled={disabled} className={`textarea w-full text-sm ${className}`} style={{ paddingRight: 40, ...style }} rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {!disabled && (
        <button type="button" onClick={toggleDictation} title={listening ? "Parar ditado" : "Falar por áudio"} className="absolute rounded-full flex items-center justify-center no-print" style={{ top: 8, right: 8, width: 24, height: 24, background: listening ? "var(--bad)" : "var(--card-alt)", color: listening ? "#fff" : "var(--ink-soft)", border: "1px solid var(--line)" }}>
          <Mic size={12} />
        </button>
      )}
      {unsupported && <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>Ditado por voz não é suportado neste navegador.</p>}
    </div>
  );
}

// =====================================================================
// 🔲 MODAIS E CÓDIGO QR
// =====================================================================



// =====================================================================
// ⚙️ COMPONENTE PRINCIPAL (APP)
// =====================================================================

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
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle");
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
    setCustomModels((prev) => {
      const next = [...prev, model];
      storage.set("custom-models", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  async function deleteCustomModel(id) {
    setCustomModels((prev) => {
      const next = prev.filter((m) => m.id !== id);
      storage.set("custom-models", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function addAgendamento(date, titulo, observacao) {
    setAgendamentos((prev) => {
      const next = [...prev, { id: uid(), date, titulo, observacao }];
      storage.set("agendamentos", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function removeAgendamento(id) {
    setAgendamentos((prev) => {
      const next = prev.filter((a) => a.id !== id);
      storage.set("agendamentos", JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function toggleCalendar() {
    setCalendarVisible((v) => {
      const next = !v;
      storage.set("ui-show-calendar", JSON.stringify(next)).catch(() => {});
      return next;
    });
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
      <LightboxContext.Provider value={setLightboxSrc}>
      <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

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

// =====================================================================
// 📅 CALENDÁRIO E AGENDAMENTOS
// =====================================================================

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

// =====================================================================
// 📋 LISTA PRINCIPAL DE VISTORIAS
// =====================================================================

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
    try {
      const count = await onImport(file);
      setImportMsg(`${count} vistoria(s) importada(s) com sucesso.`);
    } catch (err) {
      setImportMsg(err.message || "Não foi possível importar este arquivo.");
    } finally {
      setImporting(false);
    }
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
          <button onClick={() => onExport()} disabled={inspections.length === 0} className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5" title="Exportar todas as vistorias (com fotos, vídeos e anexos) para um arquivo">
            <Download size={14} /> Exportar tudo
          </button>
          <button onClick={() => importFileRef.current?.click()} disabled={importing} className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5" title="Importar vistorias de um arquivo exportado antes">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importar
          </button>
          <input ref={importFileRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
          <button onClick={onNew} className="btn-primary rounded-full px-4 py-2.5 flex items-center gap-2 text-sm">
            <Plus size={17} /> Nova vistoria
          </button>
        </div>
      </div>

      {importMsg && (
        <div className="max-w-5xl mx-auto px-6 pt-4">
          <p className="text-xs rounded-xl px-4 py-2.5" style={{ background: "var(--card-alt)", border: "1px solid var(--line)", color: "var(--ink-soft)" }}>{importMsg}</p>
        </div>
      )}

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
          <input
            className="input w-full pl-10 pr-3 py-2.5 text-sm"
            placeholder="Buscar por endereço, proprietário ou vistoriador..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {inspections.length === 0 ? (
          <div className="card p-12 text-center">
            <Building2 size={36} className="mx-auto mb-3" style={{ color: "var(--ink-soft)" }} />
            <h3 className="display text-lg font-semibold mb-1">Nenhuma vistoria ainda</h3>
            <p className="text-sm mb-5" style={{ color: "var(--ink-soft)" }}>
              Crie sua primeira vistoria para começar a registrar ambientes, itens e avarias.
            </p>
            <button onClick={onNew} className="btn-primary rounded-full px-5 py-2.5 text-sm inline-flex items-center gap-2">
              <Plus size={16} /> Nova vistoria
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {inspections.map((insp) => {
              const totalItens = insp.ambientes.reduce((a, amb) => a + amb.itens.length, 0);
              const avarias = insp.ambientes.reduce(
                (a, amb) => a + amb.itens.filter((it) => it.temDano).length, 0
              );
              return (
                <div key={insp.id} className="card p-4 flex items-center gap-4 overflow-hidden">
                  <div
                    className="flex items-center justify-center rounded-xl shrink-0 overflow-hidden"
                    style={{ width: 46, height: 46, background: "var(--card-alt)" }}
                  >
                    {insp.capaFoto ? (
                      <img src={getUrlFoto(insp.capaFoto.src)} alt="" loading="lazy" className="w-full  object-contain"style={{height:"auto",maxHeight:200}} />
                    ) : (
                      <Building2 size={20} style={{ color: "var(--accent)" }} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onOpen(insp.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-sm truncate" style={{ color: "var(--ink-strong)" }}>
                        {enderecoCompleto(insp.imovel) || "Endereço não informado"}
                      </h3>
                      <span className={`badge ${insp.status === "Finalizada" ? "badge-good" : "badge-neutral"}`}>
                        {insp.status}
                      </span>
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

// =====================================================================
// 📖 AJUDA E MODELOS PRONTOS
// =====================================================================

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
            <div
              className="shrink-0 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ width: 30, height: 30, background: "var(--accent)", color: "#F3E4E7" }}
            >
              {i + 1}
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-0.5" style={{ color: "var(--ink-strong)" }}>{p.titulo}</h3>
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>{p.texto}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="card p-4 mt-4 flex items-start gap-2 text-xs" style={{ color: "var(--ink-soft)" }}>
        <Info size={14} className="shrink-0 mt-0.5" />
        <span>Dica: use o botão de sol/lua no topo para alternar entre tema claro e escuro, e o microfone ao lado dos campos de observação para falar em vez de digitar enquanto anda pelo imóvel.</span>
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
          <p className="text-xs" style={{ color: "var(--ink-soft)" }}>
            Gera uma vistoria completa já preenchida (endereço, ambientes, medidores e chaves) para você ver como fica o resultado final.
          </p>
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
            <p className="text-xs mb-3 mono" style={{ color: "var(--ink-faint)" }}>
              {Object.keys(model.ambientes).join(" · ")}
            </p>
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
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="display text-sm font-bold">{model.label}</h4>
                  <button onClick={() => onDeleteCustomModel(model.id)} className="btn-ghost rounded-full p-1.5 shrink-0" title="Excluir modelo">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="text-xs mb-3 flex-1" style={{ color: "var(--ink-soft)" }}>{model.descricao}</p>
                <p className="text-xs mb-3 mono" style={{ color: "var(--ink-faint)" }}>
                  {Object.keys(model.ambientes).join(" · ") || "sem ambientes"}
                </p>
                <button onClick={() => onUseModel(model)} className="btn-secondary rounded-full px-3 py-2 text-xs w-fit">
                  Usar este modelo
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>
        Ao escolher um modelo, os ambientes e itens são criados automaticamente — você ainda pode editar, adicionar ou remover qualquer um deles depois.
      </p>
    </div>
  );
}
// =====================================================================
// 🏗️ CONSTRUTOR DE MODELOS PERSONALIZADOS
// =====================================================================

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
    await onSave({
      id: uid(),
      label: nome.trim(),
      descricao: "Modelo personalizado",
      ambientes: ambientesObj,
    });
    setSaving(false);
  }

  return (
    <div className="min-h-full">
      <div className="topbar px-6 py-5 flex items-center gap-3">
        <button onClick={onCancel} className="btn-ghost rounded-full p-2">
          <ArrowLeft size={18} />
        </button>
        <h1 className="display text-lg font-bold">Criar meu modelo de vistoria</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="card p-6 mb-4">
          <label className="label block mb-1.5">Nome do modelo</label>
          <input className="input w-full px-4 py-2.5 text-sm" placeholder="Ex: Sobrado duplex, Loja de rua..." value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div className="card p-6 mb-4">
          <h2 className="display text-sm font-bold mb-4 flex items-center gap-2">
            <Layers size={15} /> Ambientes do modelo
          </h2>
          <div className="grid gap-3">
            {ambientes.map((a) => (
              <div key={a.id} className="p-3 rounded-2xl" style={{ border: "1px solid var(--line)", background: "var(--card-alt)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    className="input flex-1 px-4 py-2 text-sm"
                    placeholder="Nome do ambiente (ex: Sala de Jantar)"
                    value={a.nome}
                    onChange={(e) => updateAmbiente(a.id, "nome", e.target.value)}
                  />
                  {ambientes.length > 1 && (
                    <button onClick={() => removeAmbienteRow(a.id)} className="btn-ghost rounded-full p-2 shrink-0">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
                <input
                  className="input w-full px-4 py-2 text-sm"
                  placeholder="Itens separados por vírgula (ex: Teto, Parede, Piso, Janela)"
                  value={a.itensTexto}
                  onChange={(e) => updateAmbiente(a.id, "itensTexto", e.target.value)}
                />
              </div>
            ))}
          </div>
          <button onClick={addAmbienteRow} className="btn-ghost rounded-full px-3 py-2 text-xs mt-3 flex items-center gap-1.5">
            <Plus size={13} /> Adicionar ambiente
          </button>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost rounded-full px-5 py-2.5 text-sm">Cancelar</button>
          <button disabled={!canSave || saving} onClick={handleSave} className="btn-primary rounded-full px-5 py-2.5 text-sm">
            {saving ? "Salvando..." : "Salvar modelo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 🆕 NOVA VISTORIA (Formulário Inicial)
// =====================================================================

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
  const [cepStatus, setCepStatus] = useState("idle"); // idle | loading | ok | error
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
      if (data.erro) {
        setCepStatus("error");
        return;
      }
      setForm((f) => ({
        ...f,
        endereco: data.logradouro || f.endereco,
        bairro: data.bairro || f.bairro,
        cidade: data.localidade || f.cidade,
        estado: data.uf || f.estado,
        complemento: data.complemento || f.complemento,
      }));
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
        cep: form.cep,
        endereco: form.endereco,
        numero: form.numero,
        bairro: form.bairro,
        cidade: form.cidade,
        estado: form.estado,
        complemento: form.complemento,
        metragem: form.metragem,
        proprietario: form.proprietario,
        inquilino: form.inquilino,
        tipoImovel: form.tipoImovel,
      },
    });
  }

  const canSubmit = form.endereco.trim() && form.vistoriador.trim();

  return (
    <div className="min-h-full">
      <div className="topbar px-6 py-5 flex items-center gap-3">
        <button onClick={onCancel} className="btn-ghost rounded-full p-2">
          <ArrowLeft size={18} />
        </button>
        <h1 className="display text-lg font-bold">Nova vistoria</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {modelKey && (() => {
          const modelObj = typeof modelKey === "string" ? PROPERTY_MODELS[modelKey] : modelKey;
          if (!modelObj) return null;
          return (
            <div className="rounded-xl px-4 py-3 text-xs flex items-center justify-between gap-2 mb-4" style={{ background: "var(--card-alt)", border: "1px solid var(--accent)" }}>
              <span style={{ color: "var(--ink-strong)" }}>
                Modelo <strong>{modelObj.label}</strong> selecionado — {Object.keys(modelObj.ambientes || {}).length} ambientes serão criados automaticamente.
              </span>
              <button onClick={() => setModelKey(null)} className="btn-ghost rounded-full px-2.5 py-1 shrink-0">Começar em branco</button>
            </div>
          );
        })()}

        <div className="card p-6 mb-4">
          <h2 className="display text-sm font-bold mb-4 flex items-center gap-2">
            <Camera size={15} /> Foto do imóvel
          </h2>
          {capaFoto ? (
            <div className="relative w-fit">
              <img src={getUrlFoto(capaFoto.src)} alt="Capa" style={{ width: 160, height: 110, objectFit: "cover", borderRadius: 12, border: "1px solid var(--line)" }} />
              <button onClick={() => setCapaFoto(null)} className="absolute -top-2 -right-2 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 18, height: 18 }}>
                <X size={11} />
              </button>
            </div>
          ) : (
            <button onClick={() => capaFileRef.current?.click()} className="btn-ghost rounded-2xl flex flex-col items-center justify-center gap-1 text-xs" style={{ width: 160, height: 110 }}>
              <Camera size={18} /> Adicionar foto
            </button>
          )}
          <input ref={capaFileRef} type="file" accept="image/*" className="hidden" onChange={handleCapaUpload} />
        </div>

        <div className="card p-6 mb-4">
          <h2 className="display text-sm font-bold mb-4 flex items-center gap-2">
            <Calendar size={15} /> Dados gerais
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">Tipo de vistoria</label>
              <select className="select w-full px-4 py-2.5 text-sm" value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                <option>Entrada</option>
                <option>Saída</option>
                <option>Manutenção</option>
                <option>Rotina</option>
                <option>Captação</option>
                <option>Periódica</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Data da vistoria</label>
              <input type="date" className="input w-full px-4 py-2.5 text-sm" value={form.dataVistoria} onChange={(e) => set("dataVistoria", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label block mb-1.5">Vistoriador responsável</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Nome do vistoriador" value={form.vistoriador} onChange={(e) => set("vistoriador", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label block mb-1.5">Situação do imóvel</label>
              <div className="flex gap-2 flex-wrap">
                {["Vazio", "Mobiliado", "Semi-mobiliado"].map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => set("mobiliario", op)}
                    className={`tab-btn px-4 py-2 text-sm ${form.mobiliario === op ? "active" : ""}`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6 mb-6">
          <h2 className="display text-sm font-bold flex items-center gap-2 mb-4">
            <Building2 size={15} /> Dados do imóvel
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label block mb-1.5">CEP</label>
              <input
                className="input w-full px-4 py-2.5 text-sm"
                placeholder="00000-000"
                value={form.cep}
                onChange={(e) => set("cep", e.target.value)}
                onBlur={handleCepBlur}
                maxLength={9}
              />
              {cepStatus === "loading" && <p className="text-xs mt-1 flex items-center gap-1" style={{ color: "var(--ink-soft)" }}><Loader2 size={11} className="animate-spin" /> Buscando endereço...</p>}
              {cepStatus === "ok" && <p className="text-xs mt-1" style={{ color: "var(--good)" }}>Endereço preenchido automaticamente</p>}
              {cepStatus === "error" && <p className="text-xs mt-1" style={{ color: "var(--bad)" }}>CEP não encontrado, preencha manualmente</p>}
            </div>
            <div>
              <label className="label block mb-1.5">Metragem do imóvel</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Ex: 65 m²" value={form.metragem} onChange={(e) => set("metragem", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label block mb-1.5">Endereço (rua/avenida)</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Rua, avenida..." value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1.5">Número</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Nº" value={form.numero} onChange={(e) => set("numero", e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1.5">Complemento (opcional)</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Apto, bloco..." value={form.complemento} onChange={(e) => set("complemento", e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1.5">Bairro</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Bairro" value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1.5">Cidade</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Cidade" value={form.cidade} onChange={(e) => set("cidade", e.target.value)} />
            </div>
            <div>
              <label className="label block mb-1.5">Estado</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="UF" maxLength={2} value={form.estado} onChange={(e) => set("estado", e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="label block mb-1.5">Tipo de imóvel</label>
              <select className="select w-full px-4 py-2.5 text-sm" value={form.tipoImovel} onChange={(e) => set("tipoImovel", e.target.value)}>
                <option>Apartamento</option>
                <option>Casa</option>
                <option>Kitnet</option>
                <option>Comercial</option>
                <option>Sala comercial</option>
                <option>Galpão</option>
              </select>
            </div>
            <div>
              <label className="label block mb-1.5">Proprietário</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Nome do proprietário" value={form.proprietario} onChange={(e) => set("proprietario", e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="label block mb-1.5">Inquilino / responsável</label>
              <input className="input w-full px-4 py-2.5 text-sm" placeholder="Nome do inquilino (opcional)" value={form.inquilino} onChange={(e) => set("inquilino", e.target.value)} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="btn-ghost rounded-full px-5 py-2.5 text-sm">Cancelar</button>
          <button disabled={!canSubmit} onClick={submit} className="btn-primary rounded-full px-5 py-2.5 text-sm">
            Criar vistoria e continuar
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 📋 DETALHES DA VISTORIA (DetailView, Ambientes, Itens)
// =====================================================================

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
            <button onClick={() => onChange(null)} className="absolute -top-2 -right-2 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 18, height: 18 }}>
              <X size={11} />
            </button>
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
    onUpdate((insp) => ({
      ...insp,
      ambientes: [...insp.ambientes, makeAmbiente(nome, itensBase)],
    }));
  }

  function applyModel(modelKeyOrObj) {
    const novos = ambientesFromModel(modelKeyOrObj);
    onUpdate((insp) => ({ ...insp, ambientes: [...insp.ambientes, ...novos] }));
  }

  function removeAmbiente(ambId) {
    onUpdate((insp) => ({ ...insp, ambientes: insp.ambientes.filter((a) => a.id !== ambId) }));
  }

  function updateAmbiente(ambId, fn) {
    onUpdate((insp) => ({
      ...insp,
      ambientes: insp.ambientes.map((a) => (a.id === ambId ? fn(a) : a)),
    }));
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
          <button onClick={onBack} className="btn-ghost rounded-full p-2 shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="display text-base font-bold truncate">{enderecoCompleto(inspection.imovel) || "Vistoria sem endereço"}</h1>
            <p className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{inspection.tipo} · {fmtDate(inspection.dataVistoria)} · {inspection.vistoriador}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
                    <button onClick={onExport} className="btn-ghost rounded-full p-2" title="Exportar esta vistoria (com fotos, vídeos e anexos)">
                                <Download size={16} />
                                             {/* NOVO BOTÃO DE FOTO NO TOPO */}
                                               <HeaderCameraButton
                                                   onUpload={async (files) => {
                                                         const photos = await filesToPhotos(files);
                                                               // Adiciona as fotos ao primeiro ambiente da lista (ou você pode escolher adicionar ao ambiente atual)
                                                                     onUpdate((insp) => ({
                                                                             ...insp,
                                                                                     ambientes: insp.ambientes.map((amb, index) => 
                                                                                               index === 0 ? { ...amb, fotos: [...amb.fotos,    locked={locked}
          <button onClick={() => setShowQr(true)} className="btn-ghost rounded-full p-2" title="QR do imóvel">
            <QrCode size={16} />
          </button>
          <button onClick={toggleStatus} className="btn-primary rounded-full px-3 py-2 text-xs flex items-center gap-1.5">
            {locked ? <Unlock size={14} /> : <Lock size={14} />}
            {locked ? "Reabrir" : "Finalizar"}
          </button>
        </div>
      </div>

      {showQr && <QrCodeModal inspection={inspection} onClose={() => setShowQr(false)} />}

      <div className={tab === "pdf" ? "max-w-6xl mx-auto px-4 py-6" : "max-w-4xl mx-auto px-6 py-6"}>
        <CapaFotoEditor
          capaFoto={inspection.capaFoto}
          locked={locked}
          onChange={(foto) => onUpdate((insp) => ({ ...insp, capaFoto: foto }))}
        />

        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="badge badge-neutral">{inspection.imovel.tipoImovel}</span>
          <span className="badge badge-neutral">{inspection.mobiliario}</span>
          <span className="badge badge-neutral">{inspection.ambientes.length} ambientes</span>
          <span className="badge badge-neutral">{totalItens} itens</span>
          {avarias > 0 && <span className="badge badge-bad">{avarias} avarias registradas</span>}
          {locked && <span className="badge badge-good flex items-center gap-1"><CheckCircle2 size={11} /> Finalizada</span>}
        </div>

        <div className="flex items-center gap-2 mb-6 no-print flex-wrap">
          <button onClick={() => setTab("ambientes")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "ambientes" ? "active" : ""}`}>
            <Layers size={14} /> Ambientes
          </button>
          <button onClick={() => setTab("medidores")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "medidores" ? "active" : ""}`}>
            <Gauge size={14} /> Medidores
          </button>
          <button onClick={() => setTab("chaves")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "chaves" ? "active" : ""}`}>
            <KeyRound size={14} /> Chaves
          </button>
          <button onClick={() => setTab("comparar")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "comparar" ? "active" : ""}`}>
            <GitCompare size={14} /> Comparar
          </button>
          <button onClick={() => setTab("parecer")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "parecer" ? "active" : ""}`}>
            <FileText size={14} /> Parecer Técnico
          </button>
          <button onClick={() => setTab("assinatura")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "assinatura" ? "active" : ""}`}>
            <PenLine size={14} /> Assinatura Digital
          </button>
          <button onClick={() => setTab("pdf")} className={`tab-btn px-4 py-2 text-sm flex items-center gap-1.5 ${tab === "pdf" ? "active" : ""}`}>
            <Printer size={14} /> PDF
          </button>
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
<div className="flex items-center gap-2 shrink-0">
  <button onClick={onExport} className="btn-ghost rounded-full p-2" title="Exportar esta vistoria">
    <Download size={16} />
  </button>
  <button onClick={() => setShowQr(true)} className="btn-ghost rounded-full p-2" title="QR do imóvel">
    <QrCode size={16} />
  </button>


  <button onClick={toggleStatus} className="btn-primary rounded-full px-3 py-2 text-xs flex items-center gap-1.5">
    {locked ? <Unlock size={14} /> : <Lock size={14} />}
    {locked ? "Reabrir" : "Finalizar"}
  </button>
</div>    </div>
  );
}

// =====================================================================
// ⚖️ COMPARAÇÃO ENTRE VISTORIAS
// =====================================================================

function ComparacaoTab({ inspection, allInspections }) {
  const candidatas = allInspections.filter((i) => i.id !== inspection.id);
  const mesmoEndereco = candidatas.filter(
    (i) => i.imovel.endereco && i.imovel.endereco === inspection.imovel.endereco && i.imovel.numero === inspection.imovel.numero
  );
  const lista = mesmoEndereco.length > 0 ? mesmoEndereco : candidatas;

  const [compareId, setCompareId] = useState("");
  const outra = lista.find((i) => i.id === compareId) || null;

  if (candidatas.length === 0) {
    return (
      <div className="card p-8 text-center">
        <GitCompare size={28} className="mx-auto mb-2" style={{ color: "var(--ink-soft)" }} />
        <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Você ainda não tem outra vistoria para comparar com esta.</p>
      </div>
    );
  }

  const [A, B] = outra
    ? [outra, inspection].sort((x, y) => new Date(x.dataVistoria) - new Date(y.dataVistoria))
    : [null, null];

  const linhas = [];
  if (A && B) {
    A.ambientes.forEach((ambA) => {
      const ambB = B.ambientes.find((a) => a.nome === ambA.nome);
      ambA.itens.forEach((itA) => {
        const itB = ambB?.itens.find((it) => it.nome === itA.nome);
        if (!itB) {
          linhas.push({ ambiente: ambA.nome, item: itA.nome, tipo: "removido", estadoA: itA.estado, estadoB: null });
          return;
        }
        const mudouEstado = itA.estado !== itB.estado || itA.semTeste !== itB.semTeste;
        const mudouDano = itA.temDano !== itB.temDano || (itA.temDano && itB.temDano && itA.descricaoDano !== itB.descricaoDano);
        if (mudouEstado || mudouDano) {
          linhas.push({
            ambiente: ambA.nome, item: itA.nome, tipo: "mudou",
            estadoA: itA.semTeste ? "Sem teste" : itA.estado, estadoB: itB.semTeste ? "Sem teste" : itB.estado,
            danoA: itA.temDano ? (itA.descricaoDano || "avaria registrada") : null,
            danoB: itB.temDano ? (itB.descricaoDano || "avaria registrada") : null,
          });
        }
      });
      ambB?.itens.forEach((itB) => {
        if (!ambA.itens.find((it) => it.nome === itB.nome)) {
          linhas.push({ ambiente: ambA.nome, item: itB.nome, tipo: "novo", estadoA: null, estadoB: itB.estado });
        }
      });
    });
    B.ambientes.forEach((ambB) => {
      if (!A.ambientes.find((a) => a.nome === ambB.nome)) {
        linhas.push({ ambiente: ambB.nome, item: null, tipo: "ambiente_novo" });
      }
    });
  }

  return (
    <div>
      <div className="card p-4 mb-4">
        <label className="label block mb-1.5">Comparar com</label>
        <select className="select w-full px-4 py-2.5 text-sm" value={compareId} onChange={(e) => setCompareId(e.target.value)}>
          <option value="">Selecione uma vistoria...</option>
          {lista.map((i) => (
            <option key={i.id} value={i.id}>{i.tipo} · {fmtDate(i.dataVistoria)} · {enderecoCompleto(i.imovel) || "sem endereço"}</option>
          ))}
        </select>
        {mesmoEndereco.length === 0 && (
          <p className="text-xs mt-2" style={{ color: "var(--ink-soft)" }}>Nenhuma outra vistoria encontrada com o mesmo endereço — mostrando todas as vistorias.</p>
        )}
      </div>

      {A && B && (
        <>
          <div className="flex items-center gap-2 mb-4 text-xs flex-wrap" style={{ color: "var(--ink-soft)" }}>
            <span className="badge badge-neutral">{A.tipo} — {fmtDate(A.dataVistoria)}</span>
            <ChevronRight size={13} />
            <span className="badge badge-neutral">{B.tipo} — {fmtDate(B.dataVistoria)}</span>
          </div>

          {linhas.length === 0 ? (
            <div className="card p-6 text-center">
              <CheckCircle2 size={22} className="mx-auto mb-2" style={{ color: "var(--good)" }} />
              <p className="text-sm" style={{ color: "var(--ink-soft)" }}>Nenhuma diferença encontrada entre as duas vistorias.</p>
            </div>
          ) : (
            <div className="grid gap-2">
              {linhas.map((l, i) => (
                <div key={i} className="card p-3">
                  <p className="text-xs mb-1" style={{ color: "var(--ink-soft)" }}>{l.ambiente}</p>
                  {l.tipo === "ambiente_novo" ? (
                    <p className="text-sm"><span className="badge badge-warn">Ambiente novo</span> adicionado na vistoria mais recente</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium mb-1" style={{ color: "var(--ink-strong)" }}>{l.item}</p>
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {l.tipo === "novo" && <span className="badge badge-warn">Item novo</span>}
                        {l.tipo === "removido" && <span className="badge badge-neutral">Item removido</span>}
                        {l.estadoA && <span className="badge badge-neutral">{l.estadoA}</span>}
                        {l.estadoA && l.estadoB && <ChevronRight size={12} />}
                        {l.estadoB && <span className={`badge ${l.estadoB === "Bom" || l.estadoB === "Novo" ? "badge-good" : l.estadoB === "Regular" ? "badge-warn" : "badge-bad"}`}>{l.estadoB}</span>}
                      </div>
                      {(l.danoA || l.danoB) && (
                        <p className="text-xs mt-1" style={{ color: "var(--bad)" }}>
                          {l.danoA ? `Antes: ${l.danoA}` : "Sem avaria antes"} → {l.danoB ? `Agora: ${l.danoB}` : "Sem avaria agora"}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// =====================================================================
// 🏠 AMBIENTES E ITENS
// =====================================================================

function AmbientesTab({ inspection, locked, templateOpen, setTemplateOpen, addAmbiente, removeAmbiente, updateAmbiente, applyModel, customModels = [] }) {
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
                <button
                  key={nome}
                  onClick={() => { addAmbiente(nome, itens); setTemplateOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center justify-between"
                  style={{ color: "var(--ink-strong)" }}
                >
                  <span>{nome}</span>
                  <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{itens.length} itens</span>
                </button>
              ))}
              <div className="divider my-1" />
              <button
                onClick={() => {
                  const nome = prompt("Nome do ambiente personalizado:");
                  if (nome && nome.trim()) { addAmbiente(nome.trim(), []); }
                  setTemplateOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center gap-2"
                style={{ color: "var(--accent)" }}
              >
                <Plus size={14} /> Ambiente personalizado
              </button>

              <div className="divider my-1" />
              <p className="label px-3 pt-1 pb-1.5">Aplicar modelo pronto (vários ambientes)</p>
              {Object.entries(PROPERTY_MODELS).map(([key, model]) => (
                <button
                  key={key}
                  onClick={() => { applyModel(key); setTemplateOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center justify-between"
                  style={{ color: "var(--ink-strong)" }}
                >
                  <span>{model.label}</span>
                  <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{Object.keys(model.ambientes).length} ambientes</span>
                </button>
              ))}
              {customModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => { applyModel(model); setTemplateOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-xl text-sm hover:bg-white/5 flex items-center justify-between"
                  style={{ color: "var(--ink-strong)" }}
                >
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
          <p className="text-sm" style={{ color: "var(--ink-soft)" }}>
            Nenhum ambiente adicionado. Use um modelo pronto ou crie um ambiente personalizado.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {inspection.ambientes.map((amb, idx) => (
            <AmbienteCard
              key={amb.id}
              ambiente={amb}
              numero={idx + 1}
              locked={locked}
              onRemove={() => removeAmbiente(amb.id)}
              onChange={(fn) => updateAmbiente(amb.id, fn)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function AmbienteCard({ ambiente, numero, locked, onRemove, onChange }) {
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

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer" style={{ background: "var(--card-alt)" }} onClick={() => setOpen((v) => !v)}>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {numero && (
          <span
            className="mono font-bold flex items-center justify-center rounded-full shrink-0"
            style={{ width: 22, height: 22, fontSize: 11, background: "var(--accent)", color: "#F3E4E7" }}
          >
            {String(numero).padStart(2, "0")}
          </span>
        )}
        <h3 className="display font-semibold text-sm flex-1">{ambiente.nome}</h3>
        <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{ambiente.itens.length} itens</span>
        {fotosAmbiente.length > 0 && <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{fotosAmbiente.length} mídia(s)</span>}
        {avariasAmb > 0 && <span className="badge badge-bad">{avariasAmb} avarias</span>}
        {!locked && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="btn-ghost rounded-full p-1.5">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {open && (
        <div className="p-4">
          <div className="mb-4 p-3 rounded-2xl" style={{ border: "1px dashed var(--line)" }}>
            <p className="label mb-2">Fotos e vídeos gerais do ambiente</p>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {fotosAmbiente.map((foto, idx) => (
                <PhotoThumb
                  key={idx}
                  foto={foto}
                  onRemove={!locked ? () => removeFotoAmbiente(idx) : null}
                  onUpdate={!locked ? (marcas) => onChange((a) => ({ ...a, fotos: (a.fotos || []).map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null}
                />
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

// =====================================================================
// 📝 CAMPOS TÉCNICOS E ITENS
// =====================================================================

function useFieldOptionsStore(fieldKey) {
  const [added, setAdded] = useState([]);
  const [removed, setRemoved] = useState([]);
  const [loaded, setLoaded] = useState(false);

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
      setLoaded(true);
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

  return { added, removed, addOption, removeOption, renameOption, loaded };
}

function TechFieldPicker({ fieldKey, label, value, options, disabled, onChange }) {
  const [expanded, setExpanded] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const { added, removed, addOption, removeOption, renameOption } = useFieldOptionsStore(fieldKey);

  const allOptions = [...(options || []).filter((o) => !removed.includes(o)), ...added];

  function handleAddOption(e) {
    e.stopPropagation();
    setAddModalOpen(true);
  }

  function submitAddOption(texto) {
    addOption(texto);
    setAddModalOpen(false);
    setExpanded(true);
  }

  function submitRenameOption(texto) {
    if (texto !== renameTarget) {
      renameOption(renameTarget, texto);
      if (value === renameTarget) onChange(texto);
    }
    setRenameTarget(null);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--line)", background: "var(--card)" }}>
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5" style={{ minHeight: 30 }}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-left min-w-0"
        >
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
            <button type="button" onClick={handleAddOption} className="btn-secondary rounded-full px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1">
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
                  <button
                    type="button"
                    onClick={() => { if (editMode) { setRenameTarget(o); } else { onChange(o); setExpanded(false); } }}
                    className={`estado-btn px-2.5 py-1.5 text-xs ${value === o ? "active-Bom" : ""}`}
                    style={editMode ? { paddingRight: 20 } : undefined}
                  >
                    {o}
                    {editMode && <Pencil size={9} className="inline-block ml-1" style={{ verticalAlign: "middle" }} />}
                  </button>
                  {editMode && (
                    <button
                      type="button"
                      onClick={() => { removeOption(o); if (value === o) onChange(""); }}
                      className="absolute rounded-full flex items-center justify-center"
                      style={{ top: -5, right: -5, width: 16, height: 16, background: "var(--bad)", color: "#fff" }}
                    >
                      <X size={9} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          <input
            className="input w-full px-3 py-1.5 text-xs"
            placeholder="Ou digite outro valor..."
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}

      {addModalOpen && (
        <PromptModal
          title={`Nova opção para ${label}`}
          placeholder="Digite a nova opção..."
          confirmLabel="Adicionar"
          onSubmit={submitAddOption}
          onCancel={() => setAddModalOpen(false)}
        />
      )}
      {renameTarget && (
        <PromptModal
          title="Editar opção"
          defaultValue={renameTarget}
          confirmLabel="Salvar"
          onSubmit={submitRenameOption}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </div>
  );
}

function QuantityStepper({ label, value, disabled, onChange }) {
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

function ItemRow({ item, locked, onChange, onRemove }) {
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
        <span className={`badge ${item.semTeste ? "badge-neutral" : estadoLabel === "Bom" || estadoLabel === "Novo" ? "badge-good" : estadoLabel === "Regular" ? "badge-warn" : estadoLabel === "Péssimo" ? "badge-worse" : "badge-bad"}`}>
          {estadoLabel}
        </span>
        {item.temDano && <AlertTriangle size={14} style={{ color: "var(--bad)" }} />}
        {item.fotos.length > 0 && <span className="text-xs mono" style={{ color: "var(--ink-soft)" }}>{item.fotos.length} mídia(s)</span>}
        {!locked && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="btn-ghost rounded-full p-1.5">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {!open && camposPreenchidos > 0 && (
        <p className="text-xs px-4 pb-3 pt-2" style={{ color: "var(--ink-soft)", borderTop: "1px solid var(--line)" }}>
          {ITEM_FIELD_DEFS.filter((f) => campos[f.key]).map((f) => `${f.label}: ${campos[f.key]}`).join(" · ")}
        </p>
      )}

      {open && (
        <div className="px-4 pb-4">
          <div className="flex gap-2 flex-wrap mb-2">
            {ESTADOS.map((e) => (
              <button
                key={e}
                disabled={locked}
                onClick={() => onChange((it) => ({ ...it, estado: e, semTeste: false }))}
                className={`estado-btn px-4 py-2 ${!item.semTeste && item.estado === e ? `active-${e}` : ""}`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            <button
              disabled={locked}
              onClick={() => onChange((it) => ({ ...it, semTeste: !it.semTeste }))}
              className={`estado-btn px-4 py-2 ${item.semTeste ? "active-semteste" : ""}`}
            >
              Sem teste
            </button>
          </div>

          <div className="grid gap-2 mb-2">
            {visibleFields.map((f) =>
              f.type === "number" ? (
                <QuantityStepper
                  key={f.key}
                  label={f.label}
                  value={campos[f.key]}
                  disabled={locked}
                  onChange={(val) => onChange((it) => ({ ...it, campos: { ...(it.campos || {}), [f.key]: val } }))}
                />
              ) : (
                <TechFieldPicker
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  value={campos[f.key]}
                  // @ts-ignore
                  options={FIELD_OPTIONS[f.key]} 
                  disabled={locked}
                  // @ts-ignore
                  onChange={(val) => onChange((it) => ({ ...it, campos: { ...(it.campos || {}), [f.key]: val } }))}
                />
              )
            )}
          </div>
          {!locked && hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllFields((v) => !v)}
              className="btn-ghost rounded-full px-3 py-1.5 text-xs mb-3 flex items-center gap-1.5"
            >
              {showAllFields ? <><ChevronDown size={12} className="rotate-180" /> Mostrar só os campos relevantes</> : <><Plus size={12} /> Mostrar mais {hiddenCount} campo(s)</>}
            </button>
          )}
{/* @ts-ignore */}
          <TextAreaWithDictation
            disabled={locked}
            className="px-4 py-2.5"
            rows={2}
            placeholder="Observação..."
            value={item.observacoes}
            onChange={(val) => onChange((it) => ({ ...it, observacoes: val }))}
          />

          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={locked}
              checked={item.temDano}
              onChange={(e) => onChange((it) => ({ ...it, temDano: e.target.checked }))}
            />
            <span className="flex items-center gap-1" style={{ color: item.temDano ? "var(--bad)" : "var(--ink-soft)" }}>
              <AlertTriangle size={13} /> Registrar avaria
            </span>
          </label>

          {item.temDano && (
            <div className="mt-2">
              <TextAreaWithDictation
                disabled={locked}
                className="px-4 py-2.5"
                rows={2}
                placeholder="Descreva a avaria encontrada..."
                style={{ borderColor: "var(--bad)" }}
                value={item.descricaoDano}
                onChange={(val) => onChange((it) => ({ ...it, descricaoDano: val }))}
              />
            </div>
          )}

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {item.fotos.map((foto, idx) => (
              <PhotoThumb
                key={idx}
                foto={foto}
                onRemove={!locked ? () => removePhoto(idx) : null}
                onUpdate={!locked ? (marcas) => onChange((it) => ({ ...it, fotos: it.fotos.map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null}
              />
            ))}
          </div>
          {!locked && <div className="mt-2"><PhotoPicker onAdd={handleAddPhotos} small /></div>}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// 💧 MEDIDORES E CHAVES
// =====================================================================

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
            <input
              type="checkbox"
              disabled={locked}
              checked={ativo}
              onChange={(e) => onChange((d) => ({ ...d, ativo: e.target.checked }))}
            />
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
          <TextAreaWithDictation
            disabled={locked}
            className="px-4 py-2.5 mb-3"
            rows={2}
            placeholder="Observação..."
            value={data.observacoes}
            onChange={(val) => onChange((d) => ({ ...d, observacoes: val }))}
          />
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {data.fotos.map((foto, idx) => (
              <PhotoThumb
                key={idx}
                foto={foto}
                size={56}
                onRemove={!locked ? () => removePhoto(idx) : null}
                onUpdate={!locked ? (marcas) => onChange((d) => ({ ...d, fotos: d.fotos.map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null}
              />
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
          <PhotoThumb
            key={idx}
            foto={foto}
            size={50}
            onRemove={!locked ? () => removePhoto(idx) : null}
            onUpdate={!locked ? (marcas) => onChange((d) => ({ ...d, fotos: (d.fotos || []).map((f, i) => (i === idx ? { ...f, marcas } : f)) })) : null}
          />
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
        <ChaveRow
          key={t.key}
          label={t.label}
          data={chaves[t.key]}
          locked={locked}
          onChange={(fn) => onChange((c) => ({ ...c, [t.key]: fn(c[t.key]) }))}
        />
      ))}

      {chaves.outras.map((o) => (
        <ChaveRow
          key={o.id}
          label={o.nome}
          data={o}
          locked={locked}
          onChange={(fn) => updateOutra(o.id, fn)}
          onRemove={() => removeOutra(o.id)}
        />
      ))}

      {!locked && (
        <button onClick={addOutra} className="btn-ghost rounded-full px-4 py-2.5 text-sm flex items-center gap-2 w-fit">
          <Plus size={14} /> Outras chaves
        </button>
      )}
    </div>
  );
}

// =====================================================================
// 📄 PARECER TÉCNICO
// =====================================================================

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
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
          Escreva uma avaliação técnica geral do imóvel — conclusões, recomendações ou observações que não se encaixam em um item específico.
        </p>
        <TextAreaWithDictation
          disabled={locked}
          className="px-4 py-2.5"
          rows={6}
          placeholder="Escreva aqui o parecer técnico da vistoria..."
          value={parecerTecnico?.texto || ""}
          onChange={(val) => onChange((p) => ({ ...p, texto: val }))}
        />
      </div>

      <div className="card p-5">
        <h3 className="display text-sm font-bold mb-1 flex items-center gap-2"><Upload size={15} /> Anexos</h3>
        <p className="text-xs mb-3" style={{ color: "var(--ink-soft)" }}>
          Anexe qualquer tipo de arquivo — laudos anteriores, plantas, orçamentos, PDFs, planilhas, etc.
        </p>

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

// =====================================================================
// ✍️ ASSINATURAS (SignaturePad e AssinaturaTab) - CORRIGIDO
// =====================================================================

function SignaturePad({ label, value, onSave, locked }) {
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
          <button 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); clear(); }}
            className="btn-ghost rounded-full px-2.5 py-1 text-xs no-print flex"
            type="button"
          >
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

function AssinaturaTab({ inspection, locked, onUpdate }) {
  return (
    <div className="card p-5">
      <h3 className="display text-sm font-bold mb-1 flex items-center gap-2"><PenLine size={15} /> Assinatura digital</h3>
      <p className="text-xs mb-4" style={{ color: "var(--ink-soft)" }}>
        Vistoriador, locador e locatário podem assinar direto na tela — com o dedo ou o mouse. Se preferir, deixe em branco para assinar à caneta depois de imprimir.
      </p>

      {/* ---------- 1. VISTORIADOR ---------- */}
      <div className="border rounded-lg p-3 bg-white mb-4">
        <p className="text-sm font-medium mb-2">Assinatura do vistoriador</p>
        <SignaturePad
          label="Assinatura do vistoriador"
          value={inspection.signatures?.vistoriador}
          locked={locked || inspection.signatures?.vistoriadorSalva}
          onSave={(dataUrl) => { window._assinaturaTempVistoriador = dataUrl; }}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            onClick={(e) => {
              e.preventDefault();
              const dados = window._assinaturaTempVistoriador;
              if (dados) { onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriador: dados, vistoriadorSalva: true } })); }
            }}
            type="button"
            className="btn-primary px-3 py-1.5 text-sm rounded"
          >💾 Salvar</button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriador: null, vistoriadorSalva: false } }));
            }}
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm rounded text-red-600"
          >🗑️ Limpar</button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriadorSalva: false } }));
            }}
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm rounded"
          >✏️ Editar</button>
        </div>
      </div>

      {/* ---------- 2. LOCADOR ---------- */}
      <div className="border rounded-lg p-3 bg-white mb-4">
        <p className="text-sm font-medium mb-2">Assinatura do locador</p>
        <SignaturePad
          label="Assinatura do locador"
          value={inspection.signatures?.locador}
          locked={locked || inspection.signatures?.locadorSalva}
          onSave={(dataUrl) => { window._assinaturaTempLocador = dataUrl; }}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            onClick={(e) => {
              e.preventDefault();
              const dados = window._assinaturaTempLocador;
              if (dados) { onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locador: dados, locadorSalva: true } })); }
            }}
            type="button"
            className="btn-primary px-3 py-1.5 text-sm rounded"
          >💾 Salvar</button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locador: null, locadorSalva: false } }));
            }}
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm rounded text-red-600"
          >🗑️ Limpar</button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locadorSalva: false } }));
            }}
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm rounded"
          >✏️ Editar</button>
        </div>
      </div>

      {/* ---------- 3. LOCATÁRIO ---------- */}
      <div className="border rounded-lg p-3 bg-white">
        <p className="text-sm font-medium mb-2">Assinatura do locatário</p>
        <SignaturePad
          label="Assinatura do locatário"
          value={inspection.signatures?.locatario}
          locked={locked || inspection.signatures?.locatarioSalva}
          onSave={(dataUrl) => { window._assinaturaTempLocatario = dataUrl; }}
        />
        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            onClick={(e) => {
              e.preventDefault();
              const dados = window._assinaturaTempLocatario;
              if (dados) { onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatario: dados, locatarioSalva: true } })); }
            }}
            type="button"
            className="btn-primary px-3 py-1.5 text-sm rounded"
          >💾 Salvar</button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatario: null, locatarioSalva: false } }));
            }}
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm rounded text-red-600"
          >🗑️ Limpar</button>
          <button
            onClick={(e) => {
              e.preventDefault();
              onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatarioSalva: false } }));
            }}
            type="button"
            className="btn-ghost px-3 py-1.5 text-sm rounded"
          >✏️ Editar</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// 🖨️ RELATÓRIO E GERAÇÃO DE PDF
// =====================================================================

function mediaHtml(foto) {
  const cap = foto.date ? `<p style="font-size:10px;color:#a8828a;margin:5px 0 0;font-family:'JetBrains Mono',monospace">${escapeHtml(fmtDateTime(foto.date))}</p>` : "";
  if (foto.type === "video") return `<div class="media-card"><video src="${foto.src}" controls style="width:100%;height:120px;object-fit:cover;border-radius:8px 8px 0 0;background:#000;display:block"></video><div style="padding:6px 8px">${cap || '<span style="font-size:10px;color:#a8828a">Vídeo</span>'}</div></div>`;
  if (foto.type === "audio") return `<div class="media-card" style="width:180px"><div style="padding:10px 10px 4px"><audio src="${foto.src}" controls style="width:100%"></audio></div><div style="padding:0 10px 8px">${cap || '<span style="font-size:10px;color:#a8828a">Áudio</span>'}</div></div>`;
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

  const medidoresList = [{ label: "Água", d: inspection.medidores.agua }, { label: "Energia", d: inspection.medidores.energia }, { label: "Gás", d: inspection.medidores.gas }].filter((m) => m.d.ativo);
  const chavesList = [...CHAVE_TIPOS.map((t) => ({ label: t.label, ...inspection.chaves[t.key] })), ...inspection.chaves.outras.map((o) => ({ label: o.nome, ...o }))].filter((c) => c.quantidade || c.observacoes || (c.fotos || []).length);

  const estadoColors = { "Novo": ["#e5f6ec", "#2e8f57"], "Bom": ["#e5f6ec", "#2e8f57"], "Regular": ["#fdf1dc", "#a97a1f"], "Ruim": ["#fbe4e1", "#b23e2a"], "Péssimo": ["#f5d9dd", "#8e2e3d"], "Sem teste": ["#eef0f2", "#6b7280"] };

  const ambientesHtml = inspection.ambientes.map((amb, ambIdx) => {
    const fotosAmbienteHtml = (amb.fotos || []).length ? `<div style="margin-bottom:14px"><p class="eyebrow">Fotos/vídeos gerais do ambiente</p><div class="media-grid">${amb.fotos.map(mediaHtml).join("")}</div></div>` : "";
    const itensHtml = amb.itens.map((item) => {
      const camposPreenchidos = ITEM_FIELD_DEFS.filter((f) => (item.campos || {})[f.key]);
      const estadoLabel = item.semTeste ? "Sem teste" : item.estado;
      const [bg, fg] = estadoColors[estadoLabel] || estadoColors["Sem teste"];
      const camposLine = camposPreenchidos.length ? `<p class="meta-line">${camposPreenchidos.map((f) => `<strong>${f.label}:</strong> ${escapeHtml(item.campos[f.key])}`).join(" &nbsp;·&nbsp; ")}</p>` : "";
      const obsLine = item.observacoes ? `<p class="obs-line">${escapeHtml(item.observacoes)}</p>` : "";
      const danoLine = item.temDano && item.descricaoDano ? `<p class="dano-line">⚠ Avaria: ${escapeHtml(item.descricaoDano)}</p>` : "";
      const fotosHtml = (item.fotos || []).length ? `<div class="media-grid" style="margin-top:8px">${item.fotos.map(mediaHtml).join("")}</div>` : "";
      return `<div class="item-card"><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px"><strong style="font-size:14px">${escapeHtml(item.nome)}</strong><span class="pill" style="background:${bg};color:${fg}">${escapeHtml(estadoLabel)}</span>${item.temDano ? `<span class="pill" style="background:#fbe4e1;color:#b23e2a">Avaria</span>` : ""}</div>${camposLine}${obsLine}${danoLine}${fotosHtml}</div>`;
    }).join("");
    return `<div class="section-card"><h2 class="section-title"><span class="section-num">${String(ambIdx + 1).padStart(2, "0")}</span>${escapeHtml(amb.nome)}</h2>${fotosAmbienteHtml}${itensHtml}</div>`;
  }).join("");

  const medidoresHtml = medidoresList.length ? `<div class="section-card"><h2 class="section-title"><span class="section-num" style="background:#3d7a57">💧</span>Medidores</h2>${medidoresList.map((m) => `<div class="item-card"><strong style="font-size:14px">${m.label}</strong><p class="meta-line">${[m.d.numero && `<strong>Nº:</strong> ${m.d.numero}`, m.d.leitura && `<strong>Leitura:</strong> ${m.d.leitura}${m.d.unidade ? " " + m.d.unidade : ""}`, m.d.concessionaria && `<strong>Concessionária:</strong> ${m.d.concessionaria}`].filter(Boolean).join(" &nbsp;·&nbsp; ")}</p>${m.d.observacoes ? `<p class="obs-line">${escapeHtml(m.d.observacoes)}</p>` : ""}${(m.d.fotos || []).length ? `<div class="media-grid" style="margin-top:8px">${m.d.fotos.map(mediaHtml).join("")}</div>` : ""}</div>`).join("")}</div>` : "";

  const chavesHtml = chavesList.length ? `<div class="section-card"><h2 class="section-title"><span class="section-num" style="background:#a97a1f">🔑</span>Chaves e acessos</h2>${chavesList.map((c) => `<div class="item-card"><strong style="font-size:14px">${escapeHtml(c.label)}</strong><p class="meta-line">${[c.quantidade && `<strong>Qtd.:</strong> ${c.quantidade}`, c.observacoes && escapeHtml(c.observacoes)].filter(Boolean).join(" &nbsp;·&nbsp; ")}</p>${(c.fotos || []).length ? `<div class="media-grid" style="margin-top:8px">${c.fotos.map(mediaHtml).join("")}</div>` : ""}</div>`).join("")}</div>` : "";

  const capaHtml = inspection.capaFoto ? `<div style="margin-bottom:22px"><img src="${getUrlFoto(inspection.capaFoto.src)}" class="zoomable-photo" style="width:100%;max-height:300px;object-fit:cover;border-radius:14px;cursor:zoom-in;display:block;box-shadow:0 4px 16px rgba(0,0,0,0.12)" /></div>` : "";

  const sigHtml = (label, src) => `<div style="flex:1;min-width:200px"><p class="eyebrow">${label}</p>${src ? `<img src="${getUrlFoto(src)}" style="width:100%;height:90px;object-fit:contain;border:1px solid #e7dcd6;border-radius:10px;background:#fff" />` : `<div style="width:100%;height:90px;border:1.5px dashed #d9cec7;border-radius:10px"></div>`}<div style="border-top:1px solid #e7dcd6;margin-top:36px;padding-top:4px;font-size:10px;text-align:center;color:#a8828a">Assinatura manual (se necessário)</div></div>`;

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

  .section-card {
    background: #fbf8f6; border: 1px solid #eee0da; border-radius: 16px;
    padding: 18px 20px; margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid;
  }
  .section-title {
    display: flex; align-items: center; gap: 10px; font-size: 17px; font-weight: 700;
    margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid #eee0da; color: #4e1b26;
  }
  .section-num {
    display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px;
    border-radius: 999px; background: #A23A4C; color: #fff; font-size: 11px; font-weight: 700;
    font-family: 'JetBrains Mono', monospace; flex-shrink: 0;
  }

  .item-card {
    background: #fff; border: 1px solid #f0e6e1; border-radius: 12px;
    padding: 12px 14px; margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid;
  }
  .item-card:last-child { margin-bottom: 0; }

  .pill {
    display: inline-block; font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.03em; padding: 3px 10px; border-radius: 999px;
  }

  .meta-line { font-size: 12px; color: #7a5a60; margin: 4px 0; line-height: 1.5; }
  .obs-line { font-size: 12.5px; color: #3a2a2e; margin: 6px 0; line-height: 1.5; }
  .dano-line { font-size: 12.5px; color: #b23e2a; font-weight: 600; margin: 6px 0; line-height: 1.5; }

  .media-grid { display: flex; gap: 10px; flex-wrap: wrap; }
  .media-card {
    width: 130px; border: 1px solid #eee0da; border-radius: 10px; overflow: hidden;
    background: #fff; box-shadow: 0 2px 6px rgba(40,20,25,0.06); break-inside: avoid;
  }

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
            O botão abre o laudo pronto em uma nova aba, já formatado para leitura e impressão — use o botão
            "Imprimir / salvar como PDF" dentro dessa aba. {printHint && (
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
                    <button
                      onClick={handleRemoveLogo}
                      className="no-print absolute -top-2 -right-2 rounded-full bg-black/60 text-white flex items-center justify-center"
                      style={{ width: 16, height: 16 }}
                      title="Remover logo"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => logoFileRef.current?.click()}
                    className="btn-ghost rounded-xl px-3 py-2 text-xs flex flex-col items-center justify-center gap-1 no-print"
                    style={{ width: 90, height: 52 }}
                  >
                    <Camera size={14} />
                    Add. logo
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
              <img
                src={getUrlFoto(inspection.capaFoto.src)}
                alt="Foto do imóvel"
                loading="lazy"
                className="cursor-zoom-in"
                style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }}
                onClick={() => openLightbox(inspection.capaFoto.src)}
              />
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
                <span className="mono font-bold flex items-center justify-center rounded-full" style={{ width: 20, height: 20, fontSize: 10, background: "var(--accent)", color: "#F3E4E7" }}>
                  {String(ambIdx + 1).padStart(2, "0")}
                </span>
                {amb.nome}
              </h2>
              {(amb.fotos || []).length > 0 && (
                <div className="mb-3">
                  <p className="label mb-1.5">Fotos/vídeos gerais do ambiente</p>
                  <div className="flex gap-2 flex-wrap">
                    {amb.fotos.map((foto, fi) => (
                      <div key={fi} className="text-center">
                        <img
                          src={getUrlFoto(foto.src)}
                          alt=""
                          loading="lazy"
                          className="rounded-md object-cover cursor-zoom-in"
                          style={{ width: 70, height: 70, border: "1px solid var(--line)" }}
                          onClick={() => openLightbox(foto.src)}
                        />
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
                          <span className={`badge ${item.estado === "Bom" || item.estado === "Novo" ? "badge-good" : item.estado === "Regular" ? "badge-warn" : item.estado === "Péssimo" ? "badge-worse" : "badge-bad"}`}>
                            {item.estado}
                          </span>
                        )}
                        {item.temDano && <span className="badge badge-bad flex items-center gap-1"><AlertTriangle size={10} /> Avaria</span>}
                      </div>
                      {camposPreenchidos.length > 0 && (
                        <p className="mt-1 text-xs" style={{ color: "var(--ink-soft)" }}>
                          {camposPreenchidos.map((f) => `${f.label}: ${item.campos[f.key]}`).join(" · ")}
                        </p>
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
                                  <img
                                    src={getUrlFoto(foto.src)}
                                    alt=""
                                    loading="lazy"
                                    className="rounded-md object-cover cursor-zoom-in"
                                    style={{ width: 70, height: 70, border: "1px solid var(--line)" }}
                                    onClick={() => openLightbox(foto.src)}
                                  />
                                  {pontos.map((p, mi) => (
                                    <div
                                      key={mi}
                                      style={{
                                        position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)",
                                        width: 13, height: 13, borderRadius: "50%", border: "2px solid #E23B3B", background: "rgba(226,59,59,0.3)",
                                        color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
                                      }}
                                    >
                                      {mi + 1}
                                    </div>
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
                    <span style={{ color: "var(--ink-soft)" }}>
                      {" — "}{m.d.numero ? `nº ${m.d.numero}` : ""}{m.d.leitura ? ` · leitura ${m.d.leitura}${m.d.unidade ? " " + m.d.unidade : ""}` : ""}{m.d.concessionaria ? ` · ${m.d.concessionaria}` : ""}{m.d.observacoes ? ` · ${m.d.observacoes}` : ""}
                    </span>
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
                    <span style={{ color: "var(--ink-soft)" }}>
                      {c.quantidade ? ` — qtd. ${c.quantidade}` : ""}{c.observacoes ? ` · ${c.observacoes}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="divider pt-6 mt-8 flex gap-6 flex-wrap">
            <SignaturePad
              label="Assinatura do vistoriador"
              value={inspection.signatures?.vistoriador}
              locked={inspection.status === "Finalizada"}
              onSave={(dataUrl) => onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, vistoriador: dataUrl } }))}
            />
            <SignaturePad
              label="Assinatura do locador"
              value={inspection.signatures?.locador}
              locked={inspection.status === "Finalizada"}
              onSave={(dataUrl) => onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locador: dataUrl } }))}
            />
            <SignaturePad
              label="Assinatura do locatário"
              value={inspection.signatures?.locatario}
              locked={inspection.status === "Finalizada"}
              onSave={(dataUrl) => onUpdate((insp) => ({ ...insp, signatures: { ...insp.signatures, locatario: dataUrl } }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}