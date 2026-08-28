// @ts-nocheck
import { supabase } from '../components/supabaseClient';

// Função que faz o upload de um arquivo (foto ou vídeo) para o Supabase
export async function uploadFileToSupabase(file, pasta = 'vistoria_fotos') {
  if (!file) return null;
  
  // Gera um nome único para não sobrescrever fotos antigas
  const nomeUnico = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = `${pasta}/${nomeUnico}`;

  try {
    const { error } = await supabase.storage
      .from(pasta)
      .upload(caminho, file, { cacheControl: '3600', upsert: false });

    if (error) throw error;

    // Pega a URL pública do arquivo que acabou de subir
    const { data } = supabase.storage.from(pasta).getPublicUrl(caminho);
    return data?.publicUrl;
  } catch (err) {
    console.error("Erro no upload Supabase:", err);
    return null; // Retorna null se falhar
  }
}