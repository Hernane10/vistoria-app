import { supabase } from '../components/supabaseClient';

export async function uploadFileToSupabase(file, pasta = 'vistoria-fotos') {
  if (!file) return null;
  const nomeUnico = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
  const caminho = nomeUnico; // Caminho é apenas o nome do arquivo!

  try {
    const { error } = await supabase.storage
      .from(pasta)
      .upload(caminho, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;
    const { data } = supabase.storage.from(pasta).getPublicUrl(caminho);
    return data?.publicUrl;
  } catch (err) {
    console.error("Erro no upload Supabase:", err);
    return null;
  }
}