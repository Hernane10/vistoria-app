// @ts-nocheck
import { storage } from '../lib/storage';
import { supabase } from '../components/supabaseClient';
import { uploadFileToSupabase } from "./supabaseUpload";
import { PROPERTY_MODELS } from "../App";


const STORAGE_INDEX_KEY = "insp-index";
const inspKey = (id: string) => `insp:${id}`;

export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function makeItem(nome: string) {
  return {
    id: uid(),
    nome,
    estado: "Bom",
    semTeste: false,
    observacoes: "",
    temDano: false,
    descricaoDano: "",
    fotos: [],
    campos: {},
  };
}

export function makeAmbiente(nome: string, itensNomes: string[] = []) {
  return { id: uid(), nome, fotos: [], itens: itensNomes.map(makeItem) };
}

export function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export function emptyInspection() {
  return {
    id: uid(),
    tipo: "Entrada",
    dataVistoria: new Date().toISOString().slice(0, 10),
    vistoriador: "",
    imovel: {
      cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "", complemento: "",
      metragem: "", proprietario: "", inquilino: "", tipoImovel: "Apartamento",
    },
    mobiliario: "Vazio",
    status: "Em andamento",
    capaFoto: null,
    ambientes: [],
    medidores: { agua: {}, energia: {}, gas: {} },
    chaves: { entrada: {}, garagem: {}, controle: {}, tags: {}, outras: [] },
    signatures: { vistoriador: null, locador: null, locatario: null },
    parecerTecnico: { texto: "", anexos: [] },
    createdAt: Date.now(),
  };
}

export function mediaTypeOf(file: any) {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "image";
}

export function normalizePhoto(p: any) {
  if (typeof p === "string") return { src: p, date: null, type: "image", marcas: [] };
  return { type: "image", marcas: [], ...p };
}

export function fmtFileSize(bytes: any) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function storageLoadAll() {
  try {
    const idxRes = await storage.get(STORAGE_INDEX_KEY);
    const ids = idxRes ? JSON.parse(idxRes.value) : [];
    const results = await Promise.all(ids.map(async (id: any) => {
      try { const r = await storage.get(inspKey(id)); return r ? JSON.parse(r.value) : null; } catch { return null; }
    }));
    return results.filter(Boolean).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch { return []; }
}

export async function storageSaveInspection(insp: any) {
  await storage.set(inspKey(insp.id), JSON.stringify(insp));
}

export async function storageSaveIndex(ids: any) {
  await storage.set(STORAGE_INDEX_KEY, JSON.stringify(ids));
}

export async function storageDeleteInspection(id: any, remainingIds: any) {
  await storage.delete(inspKey(id)).catch(() => {});
  await storageSaveIndex(remainingIds);
}

export function withDefaults(insp) {
  const base = emptyInspection();
  const oldSig = insp.signatures || {};
  return {
    ...base, ...insp,
    imovel: { ...base.imovel, ...(insp.imovel || {}) },
    mobiliario: insp.mobiliario || base.mobiliario,
    ambientes: (insp.ambientes || []).map((amb) => ({ ...amb, fotos: (amb.fotos || []).map(normalizePhoto), itens: (amb.itens || []).map((it) => ({ ...it, fotos: (it.fotos || []).map(normalizePhoto) })) })),
    medidores: {
      agua: { ...base.medidores.agua, ...(insp.medidores?.agua || {}), fotos: (insp.medidores?.agua?.fotos || []).map(normalizePhoto) },
      energia: { ...base.medidores.energia, ...(insp.medidores?.energia || {}), fotos: (insp.medidores?.energia?.fotos || []).map(normalizePhoto) },
      gas: { ...base.medidores.gas, ...(insp.medidores?.gas || {}), fotos: (insp.medidores?.gas?.fotos || []).map(normalizePhoto) },
    },
    chaves: {
      entrada: { ...base.chaves.entrada, ...(insp.chaves?.entrada || {}), fotos: (insp.chaves?.entrada?.fotos || []).map(normalizePhoto) },
      garagem: { ...base.chaves.garagem, ...(insp.chaves?.garagem || {}), fotos: (insp.chaves?.garagem?.fotos || []).map(normalizePhoto) },
      controle: { ...base.chaves.controle, ...(insp.chaves?.controle || {}), fotos: (insp.chaves?.controle?.fotos || []).map(normalizePhoto) },
      tags: { ...base.chaves.tags, ...(insp.chaves?.tags || {}), fotos: (insp.chaves?.tags?.fotos || []).map(normalizePhoto) },
      outras: (insp.chaves?.outras || []).map((o) => ({ ...o, fotos: (o.fotos || []).map(normalizePhoto) })),
    },
    signatures: {
      vistoriador: oldSig.vistoriador ?? null,
      locador: oldSig.locador ?? null,
      locatario: oldSig.locatario ?? oldSig.responsavel ?? null,
    },
    parecerTecnico: { texto: insp.parecerTecnico?.texto || "", anexos: insp.parecerTecnico?.anexos || [] },
  };
}

export function getUrlFoto(caminho) {
  if (!caminho) return '';
  if (typeof caminho === 'object') {
    if (caminho.src) caminho = caminho.src;
    else return '';
  }
  if (caminho.startsWith('http')) return caminho;
  if (caminho.startsWith('data:image')) return caminho;
  const { data } = supabase.storage.from('vistoria-fotos').getPublicUrl(caminho);
  return data?.publicUrl || caminho;
}

export function fichaText(inspection) {
  return ["Ficha rápida do imóvel — VistorIA", `Endereço: ${enderecoCompleto(inspection.imovel) || "—"}`, `Tipo: ${inspection.imovel.tipoImovel} (${inspection.mobiliario})`, inspection.imovel.metragem ? `Metragem: ${inspection.imovel.metragem}` : null, `Proprietário: ${inspection.imovel.proprietario || "—"}`, `Inquilino: ${inspection.imovel.inquilino || "—"}`, `Última vistoria: ${fmtDate(inspection.dataVistoria)} (${inspection.tipo})`, `Status: ${inspection.status}`].filter(Boolean).join("\n");
}

export function qrCodeUrl(text, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
}

export function enderecoCompleto(imovel) {
  if (!imovel) return "";
  const linha1 = [imovel.endereco, imovel.numero && `nº ${imovel.numero}`].filter(Boolean).join(", ");
  const linha2 = [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(" - ");
  const comp = imovel.complemento ? ` (${imovel.complemento})` : "";
  return [linha1, linha2].filter(Boolean).join(" - ") + comp;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyChave() {
  return { quantidade: "", observacoes: "", fotos: [] };
}

export async function filesToPhotos(files) {
  const now = new Date().toISOString();
  const photos = await Promise.all(files.map(async (file) => {
    let src = await fileToDataURL(file);
    const publicUrl = await uploadFileToSupabase(file);
    if (publicUrl) src = publicUrl;
    return { src, date: now, type: mediaTypeOf(file), marcas: [] };
  }));
  return photos;
}

export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function getImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Não foi possível ler a imagem.")); };
    img.src = url;
  });
}

export async function maybeCompressImage(file) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const { width, height } = await getImageDimensions(file);
    const alreadySmallDim = Math.max(width, height) <= 1200;
    const alreadySmallFile = file.size <= 250 * 1024;
    const compressed = await compressImageFile(file);
    return compressed.size < file.size ? compressed : file;
  } catch { return file; }
}

export function compressImageFile(file, maxDim = 1200, quality = 0.8) {
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

export function ambientesFromModel(modelKeyOrObj) {
  const model = typeof modelKeyOrObj === "string" ? PROPERTY_MODELS[modelKeyOrObj] : modelKeyOrObj;
  if (!model || !model.ambientes) return [];
  return Object.entries(model.ambientes).map(([nome, itens]) => makeAmbiente(nome, itens));
}

