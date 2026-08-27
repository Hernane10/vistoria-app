// src/types/vistoria.ts

// Tipos base do sistema
export type EstadoItem = "Novo" | "Bom" | "Regular" | "Ruim" | "Péssimo" | "Sem teste";
export type TipoMidia = "image" | "video" | "audio";
export type TipoImovel = "Apartamento" | "Casa" | "Kitnet" | "Comercial" | "Sala comercial" | "Galpão";

// Interface de uma foto/vídeo/áudio
export interface Foto {
  src: string;
  date: string | null;
  type: TipoMidia;
  marcas?: { points: { x: number; y: number }[]; comentario?: string } | { x: number; y: number }[];
}

// Interface de um item (ex: Piso, Parede)
export interface ItemVistoria {
  id: string;
  nome: string;
  estado: EstadoItem;
  semTeste: boolean;
  observacoes: string;
  temDano: boolean;
  descricaoDano: string;
  fotos: Foto[];
  campos: Record<string, string | number>;
}

// Interface de um ambiente (ex: Sala, Cozinha)
export interface Ambiente {
  id: string;
  nome: string;
  fotos: Foto[];
  itens: ItemVistoria[];
}

// Interface das assinaturas
export interface Assinatura {
  vistoriador: string | null;
  locador: string | null;
  locatario: string | null;
  vistoriadorSalva?: boolean;
  locadorSalva?: boolean;
  locatarioSalva?: boolean;
}

// Interface do imóvel
export interface Imovel {
  cep: string;
  endereco: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  complemento: string;
  metragem: string;
  proprietario: string;
  inquilino: string;
  tipoImovel: TipoImovel;
}

// Interface principal da Inspeção (Vistoria)
export interface Inspecao {
  id: string;
  tipo: string;
  dataVistoria: string;
  vistoriador: string;
  imovel: Imovel;
  mobiliario: string;
  status: string;
  capaFoto: Foto | null;
  ambientes: Ambiente[];
  medidores: any; // Tiparemos depois
  chaves: any;    // Tiparemos depois
  signatures: Assinatura;
  parecerTecnico: { texto: string; anexos: any[] };
  createdAt: number;
}