// @ts-nocheck
// src/utils/helpers.ts
import { Inspecao, ItemVistoria, Ambiente } from '../types/vistoria';
import { storage } from '../lib/storage';
const STORAGE_INDEX_KEY = "insp-index";
const inspKey = (id: string) => `insp:${id}`;
// Funções utilitárias tipadas
export const uid = (): string => Math.random().toString(36).slice(2, 10);

export function makeItem(nome: string): ItemVistoria {
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

export function makeAmbiente(nome: string, itensNomes: string[] = []): Ambiente {
  return { id: uid(), nome, fotos: [], itens: itensNomes.map(makeItem) };
}

export function enderecoCompleto(imovel: Inspecao['imovel']): string {
  if (!imovel) return "";
  const linha1 = [imovel.endereco, imovel.numero && `nº ${imovel.numero}`].filter(Boolean).join(", ");
  const linha2 = [imovel.bairro, imovel.cidade, imovel.estado].filter(Boolean).join(" - ");
  const comp = imovel.complemento ? ` (${imovel.complemento})` : "";
  return [linha1, linha2].filter(Boolean).join(" - ") + comp;
}

export function fmtDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(iso: string | null): string {
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

export function emptyInspection(): Inspecao {
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

// Funções utilitárias para mídia
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

// Export e Import de dados
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
  // Se for objeto com .src → pega o valor de .src
  if (typeof caminho === 'object') {
    if (caminho.src) caminho = caminho.src;
    else return '';
  }
  // Se já é link completo → usa direto
  if (caminho.startsWith('http')) return caminho;
  // Se é base64 (foto local não enviada ainda) → mostra direto
  if (caminho.startsWith('data:image')) return caminho;
  // Gera o link público do Supabase
  const { data } = supabase.storage.from('vistoria_fotos').getPublicUrl(caminho);
  return data?.publicUrl || caminho;
}
export async function filesToPhotos(files) {
  const processed = await Promise.all(files.map((f) => (f.type.startsWith("image/") ? maybeCompressImage(f) : f)));
  const urls = await Promise.all(processed.map(fileToDataURL));
  const now = new Date().toISOString();
  return urls.map((src, i) => ({ src, date: now, type: mediaTypeOf(files[i]), marcas: [] }));
}
export function fichaText(inspection) {
  return ["Ficha rápida do imóvel — VistorIA", `Endereço: ${enderecoCompleto(inspection.imovel) || "—"}`, `Tipo: ${inspection.imovel.tipoImovel} (${inspection.mobiliario})`, inspection.imovel.metragem ? `Metragem: ${inspection.imovel.metragem}` : null, `Proprietário: ${inspection.imovel.proprietario || "—"}`, `Inquilino: ${inspection.imovel.inquilino || "—"}`, `Última vistoria: ${fmtDate(inspection.dataVistoria)} (${inspection.tipo})`, `Status: ${inspection.status}`].filter(Boolean).join("\n");
}