import { supabase, supabaseEnabled } from './supabaseClient.js';

// =====================================================
// ✅ FUNÇÃO DE UPLOAD — 1 FOTO POR VEZ (corrigida sem erro de blob)
// =====================================================
async function uploadFotoVistoria(userId, caminhoPasta, foto, index = 0) {
  console.log(`📤 Enviando foto ${index + 1} para: ${caminhoPasta}`);

  // Extrai .src se for objeto
  let fotoBase64 = foto;
  if (foto && typeof foto === 'object' && foto.src) {
    fotoBase64 = foto.src;
  }

  if (!fotoBase64 || typeof fotoBase64 !== 'string') {
    console.warn(`⚠️ Foto ${index} inválida — pulando`);
    return null;
  }

  // Limpa o prefixo base64
  const base64Data = fotoBase64.includes(',') 
    ? fotoBase64.split(',')[1] 
    : fotoBase64;

  // Detecta tipo de imagem/vídeo
  let mimeType = 'image/jpeg';
  if (fotoBase64.includes('video/mp4')) mimeType = 'video/mp4';
  else if (fotoBase64.includes('video/')) mimeType = 'video/mp4';
  else if (fotoBase64.includes('image/png')) mimeType = 'image/png';
  else if (fotoBase64.includes('image/webp')) mimeType = 'image/webp';

  // Converte base64 → Blob
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  console.log(`📦 Blob criado — tipo: ${mimeType}, tamanho: ${blob.size} bytes`);

  // Nome único do arquivo
  const caminhoArquivo = `${caminhoPasta}/foto_${index}_${Date.now()}.jpg`;

  // Upload para o Storage
  const { data, error } = await supabase
    .storage
    .from('vistoria-fotos')
    .upload(caminhoArquivo, blob, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error(`❌ Falha na foto ${index}:`, error);
    return null;
  }

  console.log(`✅ UPLOAD OK! → ${data.path}`);
  return { path: data.path, tipo: 'storage', src: fotoBase64 };
}

// =====================================================
// ✅ FUNÇÃO AUXILIAR — ENVIA TODO O ARRAY DE FOTOS (sem limite!)
// =====================================================
async function enviarLoteDeFotos(userId, vistoriaId, fotos, subPasta) {
  if (!fotos || !Array.isArray(fotos) || fotos.length === 0) {
    console.log(`ℹ️ ${subPasta}: Nenhuma foto para enviar`);
    return [];
  }

  console.log(`📸 ${subPasta}: ${fotos.length} foto(s) encontrada(s) — enviando TODAS...`);
  const caminhoBase = `${userId}/${vistoriaId}/${subPasta}`;
  const resultados = [];

  // 🔄 PERCORRE TODO O ARRAY — NÃO IMPORTA SE É 1 OU 100!
  for (let i = 0; i < fotos.length; i++) {
    const res = await uploadFotoVistoria(userId, caminhoBase, fotos[i], i);
    if (res) resultados.push(res);
  }

  console.log(`✅ ${subPasta}: ${resultados.length}/${fotos.length} enviada(s) com sucesso!`);
  return resultados;
}

// =====================================================
// ✅ AUTENTICAÇÃO
// =====================================================
export async function ensureSignedIn() {
  if (!supabaseEnabled) throw new Error("Supabase não configurado.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session?.user) return session.user;
  const { data: { user }, error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) throw signInError;
  return user;
}

// =====================================================
// ✅ FUNÇÃO PRINCIPAL — ENVIA TUDO! CAPA, AMBIENTES, ITENS, MEDIDORES, CHAVES, PARECER
// =====================================================
export async function pushInspections(inspections, onProgress) {
  console.log('🔄 INICIANDO ENVIO COMPLETO DE', inspections.length, 'VISTORIA(S)...');
  const user = await ensureSignedIn();
  console.log('👤 Usuário:', user.id);
  
  let done = 0;

  for (const insp of inspections) {
    console.log('📋 Processando vistoria:', insp.id);
    
    // Salva no banco primeiro
    const { error: saveError } = await supabase.from("inspections").upsert({
      id: insp.id,
      owner_id: user.id,
      data: insp.dataVistoria || new Date().toISOString().split('T')[0],
      dados: insp
    });

    if (saveError) throw saveError;
    done++;
    onProgress?.(done, inspections.length);

    let totalFotos = 0;
    let vistoriaAtualizada = { ...insp };
    const userId = user.id;
    const vistoriaId = insp.id;

    // =====================================================
    // 🖼️ 1. FOTO DE CAPA
    // =====================================================
    console.log('🖼️ === FOTO DE CAPA ===');
    const fotosCapa = insp.capaFoto ? [insp.capaFoto] : [];
    const capaEnviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosCapa, 'capa');
    totalFotos += capaEnviadas.length;
    if (capaEnviadas.length > 0) {
      vistoriaAtualizada.capaFoto = { ...insp.capaFoto, ...capaEnviadas[0] };
    }

    // =====================================================
    // 🏠 2. AMBIENTES — FOTOS GERAIS + FOTOS DOS ITENS
    // =====================================================
    if (insp.ambientes && Array.isArray(insp.ambientes)) {
      vistoriaAtualizada.ambientes = [...insp.ambientes];
      
      for (let ambIndex = 0; ambIndex < insp.ambientes.length; ambIndex++) {
        const amb = insp.ambientes[ambIndex];
        console.log(`🏠 === AMBIENTE ${ambIndex}: ${amb.nome} ===`);

        // 📸 FOTOS GERAIS DO AMBIENTE — TODAS, SEM LIMITE!
        const fotosAmbiente = amb.fotos && Array.isArray(amb.fotos) ? amb.fotos : [];
        const caminhoAmb = `ambiente-${ambIndex}`;
        const ambEnviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosAmbiente, caminhoAmb);
        totalFotos += ambEnviadas.length;
        vistoriaAtualizada.ambientes[ambIndex].fotos = ambEnviadas.length > 0 
          ? ambEnviadas.map((r, i) => ({ ...amb.fotos[i], ...r })) 
          : amb.fotos;

        // 📦 FOTOS DOS ITENS DO AMBIENTE — TODAS, SEM LIMITE!
        if (amb.itens && Array.isArray(amb.itens)) {
          for (let itemIndex = 0; itemIndex < amb.itens.length; itemIndex++) {
            const item = amb.itens[itemIndex];
            console.log(`📦 Item ${itemIndex}: ${item.nome || `Item ${itemIndex}`}`);
            
            // Pega fotos do item — pode ser .fotos (array), .foto, .midia, etc.
            let fotosItem = item.fotos || (item.foto ? [item.foto] : null) || (item.midia ? [item.midia] : null);
            if (!fotosItem || !Array.isArray(fotosItem)) continue;
            
            const caminhoItem = `ambiente-${ambIndex}/item-${itemIndex}`;
            const itemEnviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosItem, caminhoItem);
            totalFotos += itemEnviadas.length;
            
            if (itemEnviadas.length > 0) {
              vistoriaAtualizada.ambientes[ambIndex].itens[itemIndex].fotos = itemEnviadas.map((r, i) => ({ ...fotosItem[i], ...r }));
              // Mantém compatibilidade com .foto se tiver só 1
              if (itemEnviadas.length === 1) {
                vistoriaAtualizada.ambientes[ambIndex].itens[itemIndex].foto = { ...fotosItem[0], ...itemEnviadas[0] };
              }
            }
          }
        }
      }
    }

    // =====================================================
    // ⚡ 3. MEDIDORES — AGORA É OBJETO: agua, energia, gas — TODAS AS FOTOS DE CADA UM!
    // =====================================================
    console.log('⚡ === MEDIDORES ===');
    const medidores = insp.medidores;
    
    if (medidores && typeof medidores === 'object') {
      vistoriaAtualizada.medidores = { ...medidores };
      
      for (const [nomeMed, dadosMed] of Object.entries(medidores)) {
        if (!dadosMed) continue;
        console.log(`🔍 Medidor: ${nomeMed}`);
        
        // Pega TODAS as fotos do medidor — campo "fotos" (array)
        let fotosMed = dadosMed.fotos || (dadosMed.foto ? [dadosMed.foto] : null);
        if (!fotosMed || !Array.isArray(fotosMed) || fotosMed.length === 0) {
          console.log(`⚠️ Medidor "${nomeMed}" sem fotos — pulando`);
          continue;
        }
        
        const caminhoMed = `medidor-${nomeMed}`;
        const medEnviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosMed, caminhoMed);
        totalFotos += medEnviadas.length;
        
        // Salva todos os caminhos de volta
        vistoriaAtualizada.medidores[nomeMed] = {
          ...dadosMed,
          fotos: medEnviadas.map((r, i) => ({ ...fotosMed[i], ...r }))
        };
        // Compatibilidade com .foto
        if (medEnviadas.length === 1) {
          vistoriaAtualizada.medidores[nomeMed].foto = { ...fotosMed[0], ...medEnviadas[0] };
        }
      }
    }

    // =====================================================
    // 🔑 4. CHAVES — TODAS AS FOTOS
    // =====================================================
    if (insp.chaves && Array.isArray(insp.chaves)) {
      vistoriaAtualizada.chaves = [...insp.chaves];
      
      for (let chaveIndex = 0; chaveIndex < insp.chaves.length; chaveIndex++) {
        const chave = insp.chaves[chaveIndex];
        let fotosChave = chave.fotos || (chave.foto ? [chave.foto] : null);
        if (!fotosChave || !Array.isArray(fotosChave) || fotosChave.length === 0) continue;
        
        const caminhoChave = `chave-${chaveIndex}`;
        const chaveEnviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosChave, caminhoChave);
        totalFotos += chaveEnviadas.length;
        
        vistoriaAtualizada.chaves[chaveIndex].fotos = chaveEnviadas.map((r, i) => ({ ...fotosChave[i], ...r }));
        if (chaveEnviadas.length === 1) {
          vistoriaAtualizada.chaves[chaveIndex].foto = { ...fotosChave[0], ...chaveEnviadas[0] };
        }
      }
    }

    // =====================================================
    // 📝 5. PARECER TÉCNICO — FOTOS
    // =====================================================
    if (insp.parecerTecnico) {
      let fotosParecer = insp.parecerTecnico.fotos || (insp.parecerTecnico.foto ? [insp.parecerTecnico.foto] : null);
      if (fotosParecer && Array.isArray(fotosParecer) && fotosParecer.length > 0) {
        console.log('📝 === PARECER TÉCNICO ===');
        const parecerEnviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosParecer, 'parecer');
        totalFotos += parecerEnviadas.length;
        vistoriaAtualizada.parecerTecnico = {
          ...insp.parecerTecnico,
          fotos: parecerEnviadas.map((r, i) => ({ ...fotosParecer[i], ...r }))
        };
        if (parecerEnviadas.length === 1) {
          vistoriaAtualizada.parecerTecnico.foto = { ...fotosParecer[0], ...parecerEnviadas[0] };
        }
      }
    }

    // =====================================================
    // ✅ FINALIZA — ATUALIZA BANCO
    // =====================================================
    console.log('=========================================');
    console.log(`📸 TOTAL DE FOTOS ENVIADAS: ${totalFotos}`);
    console.log('=========================================');

    if (totalFotos > 0) {
      console.log('🔄 Atualizando banco com caminhos das fotos...');
      await supabase.from("inspections").update({
        dados: vistoriaAtualizada
      }).eq('id', insp.id);
    }
  }

  console.log('🎉 ENVIO FINALIZADO! Vistorias:', done);
  return done;
}

// =====================================================
// ✅ BAIXAR / SINCRONIZAR — PEGA AS FOTOS DE VOLTA
// =====================================================
export async function pullInspections() {
  const user = await ensureSignedIn();
  const { data, error } = await supabase
    .from("inspections")
    .select("*")
    .eq("owner_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  // Gera URLs assinadas para exibir as fotos
  const gerarUrlFoto = async (foto) => {
    if (!foto) return foto;
    if (typeof foto === 'string') return foto;
    if (foto.tipo === 'storage' && foto.path) {
      try {
        const { data: urlData } = await supabase.storage
          .from('vistoria-fotos')
          .createSignedUrl(foto.path, 3600 * 24 * 7);
        return urlData?.signedUrl || foto.path;
      } catch {
        return foto.path;
      }
    }
    return foto;
  };

  // Processa todas as fotos para exibição
  const processarFotos = async (item) => {
    if (!item) return item;
    if (item.fotos && Array.isArray(item.fotos)) {
      item.fotos = await Promise.all(item.fotos.map(f => gerarUrlFoto(f)));
    }
    if (item.foto) item.foto = await gerarUrlFoto(item.foto);
    return item;
  };

  const resultado = await Promise.all(
    (data || []).map(async (row) => {
      const vistoria = { ...row.dados };

      // Capa
      if (vistoria.capaFoto) vistoria.capaFoto = await gerarUrlFoto(vistoria.capaFoto);

      // Ambientes e itens
      if (vistoria.ambientes) {
        for (const amb of vistoria.ambientes) {
          await processarFotos(amb);
          if (amb.itens) {
            for (const item of amb.itens) {
              await processarFotos(item);
            }
          }
        }
      }

      // Medidores
      if (vistoria.medidores) {
        for (const [_, med] of Object.entries(vistoria.medidores)) {
          await processarFotos(med);
        }
      }

      // Chaves
      if (vistoria.chaves) {
        for (const chave of vistoria.chaves) {
          await processarFotos(chave);
        }
      }

      // Parecer
      if (vistoria.parecerTecnico) await processarFotos(vistoria.parecerTecnico);

      return { id: row.id, data: row.data, ...vistoria };
    })
  );

  return resultado;
}

export async function deleteInspectionRemote(id) {
  const user = await ensureSignedIn();
  const { error } = await supabase.from("inspections").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
}