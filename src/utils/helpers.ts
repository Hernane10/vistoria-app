// src/utils/helpers.ts
import { Inspecao, ItemVistoria, Ambiente } from '../types/vistoria';

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