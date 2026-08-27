import { supabase, supabaseEnabled } from './supabaseClient.js';

// =====================================================
// ⚡ REDUZIR IMAGEM
// =====================================================
async function reduzirImagem(base64, qualidade = 0.8, larguraMax = 1200) {
  return new Promise((resolve) => {
    if (base64.length < 150000) { resolve(base64); return; }
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > larguraMax) {
        const proporcao = larguraMax / w;
        w = larguraMax;
        h = Math.round(h * proporcao);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', qualidade));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

// =====================================================
// ✅ GERAR URL PARA EXIBIR FOTO
// =====================================================
export async function getUrlFoto(foto) {
  if (!foto) return null;
  if (typeof foto === 'string') {
    if (foto.startsWith('http') || foto.startsWith('blob:') || foto.startsWith('data:')) return foto;
  }
  if (foto.path && foto.tipo === 'storage') {
    try {
      const { data } = await supabase.storage
        .from('vistoria-fotos')
        .createSignedUrl(foto.path, 3600 * 24 * 30);
      return data?.signedUrl || null;
    } catch { return null; }
  }
  if (foto.src && foto.src.startsWith('data:')) return foto.src;
  return null;
}

// =====================================================
// ✅ CARREGAR TODAS AS URLs DAS FOTOS
// =====================================================
export async function carregarUrlsFotos(vistoria) {
  if (!vistoria) return vistoria;
  const v = structuredClone(vistoria);

  if (v.capaFoto) v.capaFotoUrl = await getUrlFoto(v.capaFoto);

  if (v.ambientes) {
    for (let i = 0; i < v.ambientes.length; i++) {
      const amb = v.ambientes[i];
      if (amb.fotos?.length) v.ambientes[i].fotosUrls = await Promise.all(amb.fotos.map(getUrlFoto));
      if (amb.itens?.length) {
        for (let j = 0; j < amb.itens.length; j++) {
          if (amb.itens[j].fotos?.length)
            v.ambientes[i].itens[j].fotosUrls = await Promise.all(amb.itens[j].fotos.map(getUrlFoto));
        }
      }
    }
  }

  if (v.medidores) {
    for (const [nome, med] of Object.entries(v.medidores)) {
      if (med?.fotos?.length) v.medidores[nome].fotosUrls = await Promise.all(med.fotos.map(getUrlFoto));
    }
  }

  if (v.chaves) {
    for (const [nome, chave] of Object.entries(v.chaves)) {
      if (Array.isArray(chave)) {
        for (let i = 0; i < chave.length; i++) {
          if (chave[i]?.fotos?.length)
            v.chaves[nome][i].fotosUrls = await Promise.all(chave[i].fotos.map(getUrlFoto));
        }
      } else if (chave?.fotos?.length) {
        v.chaves[nome].fotosUrls = await Promise.all(chave.fotos.map(getUrlFoto));
      }
    }
  }

  if (v.parecerTecnico?.fotos?.length)
    v.parecerTecnico.fotosUrls = await Promise.all(v.parecerTecnico.fotos.map(getUrlFoto));

  return v;
}

// =====================================================
// ✅ UPLOAD DE FOTO
// =====================================================
async function uploadFotoVistoria(userId, caminhoPasta, foto, index = 0) {
  let fotoBase64 = foto;
  if (foto && typeof foto === 'object' && foto.src) fotoBase64 = foto.src;
  if (foto?.path && foto?.tipo === 'storage') return { path: foto.path, tipo: 'storage' };
  if (!fotoBase64 || typeof fotoBase64 !== 'string') return null;

  fotoBase64 = await reduzirImagem(fotoBase64);
  const base64Data = fotoBase64.includes(',') ? fotoBase64.split(',')[1] : fotoBase64;
  let mimeType = 'image/jpeg';
  if (fotoBase64.includes('image/png')) mimeType = 'image/png';
  else if (fotoBase64.includes('image/webp')) mimeType = 'image/webp';

  const byteCharacters = atob(base64Data);
  const byteNumbers = Array.from({ length: byteCharacters.length }, (_, i) => byteCharacters.charCodeAt(i));
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const caminhoArquivo = `${caminhoPasta}/foto_${index}_${Date.now()}.jpg`;

  const { data, error } = await supabase.storage
    .from('vistoria-fotos')
    .upload(caminhoArquivo, blob, { contentType: mimeType, upsert: false });

  if (error) return null;
  return { path: data.path, tipo: 'storage' };
}

async function enviarLoteDeFotos(userId, vistoriaId, fotos, subPasta) {
  if (!fotos?.length) return [];
  console.log(`📸 ${subPasta}: ${fotos.length} foto(s)`);
  const caminhoBase = `${userId}/${vistoriaId}/${subPasta}`;
  const resultados = [];
  for (let i = 0; i < fotos.length; i++) {
    const res = await uploadFotoVistoria(userId, caminhoBase, fotos[i], i);
    if (res) resultados.push(res);
    await new Promise(r => setTimeout(r, 50));
  }
  return resultados;
}

function limparDadosParaSalvar(vistoria) {
  const dados = structuredClone(vistoria);
  if (dados.capaFoto) dados.capaFoto = dados.capaFoto.path ? { path: dados.capaFoto.path, tipo: 'storage' } : null;
  if (dados.ambientes) {
    dados.ambientes = dados.ambientes.map(amb => ({
      ...amb,
      fotos: amb.fotos?.map(f => f?.path ? { path: f.path, tipo: 'storage' } : null).filter(Boolean) || [],
      itens: amb.itens?.map(item => ({
        ...item,
        fotos: item.fotos?.map(f => f?.path ? { path: f.path, tipo: 'storage' } : null).filter(Boolean) || []
      })) || []
    }));
  }
  if (dados.medidores) {
    for (const [_, med] of Object.entries(dados.medidores)) {
      if (med?.fotos) med.fotos = med.fotos.map(f => f?.path ? { path: f.path, tipo: 'storage' } : null).filter(Boolean);
    }
  }
  if (dados.chaves) {
    for (const [nome, chave] of Object.entries(dados.chaves)) {
      if (Array.isArray(chave)) {
        dados.chaves[nome] = chave.map(item => ({
          ...item,
          fotos: item.fotos?.map(f => f?.path ? { path: f.path, tipo: 'storage' } : null).filter(Boolean) || []
        }));
      } else if (chave?.fotos) {
        chave.fotos = chave.fotos.map(f => f?.path ? { path: f.path, tipo: 'storage' } : null).filter(Boolean);
      }
    }
  }
  if (dados.parecerTecnico?.fotos) {
    dados.parecerTecnico.fotos = dados.parecerTecnico.fotos.map(f => f?.path ? { path: f.path, tipo: 'storage' } : null).filter(Boolean);
  }
  return dados;
}

export async function ensureSignedIn() {
  if (!supabaseEnabled) throw new Error("Supabase não configurado.");
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data: { user }, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return user;
}

export async function pushInspections(inspections, onProgress) {
  console.log('🔄 Enviando', inspections.length, 'vistoria(s)...');
  const user = await ensureSignedIn();
  let done = 0;

  for (const insp of inspections) {
    console.log(`========== VISTORIA: ${insp.id} ==========`);
    const dadosParaSalvar = limparDadosParaSalvar(insp);
    
    const { error: saveError } = await supabase.from("inspections").upsert({
      id: insp.id, owner_id: user.id,
      data: insp.dataVistoria || new Date().toISOString().split('T')[0],
      dados: dadosParaSalvar
    });
    if (saveError) throw saveError;
    console.log(`✅ DADOS SALVOS`);

    let totalFotos = 0;
    const userId = user.id;
    const vistoriaId = insp.id;
    const fotosAtualizadas = { ...dadosParaSalvar };

    if (insp.capaFoto && !insp.capaFoto.path) {
      const enviadas = await enviarLoteDeFotos(userId, vistoriaId, [insp.capaFoto], 'capa');
      if (enviadas[0]) fotosAtualizadas.capaFoto = enviadas[0];
      totalFotos += enviadas.length;
    }

    if (insp.ambientes?.length) {
      fotosAtualizadas.ambientes = [...insp.ambientes];
      for (let ambIndex = 0; ambIndex < insp.ambientes.length; ambIndex++) {
        const amb = insp.ambientes[ambIndex];
        if (amb.fotos?.length) {
          const fotosNovas = amb.fotos.filter(f => !f?.path);
          if (fotosNovas.length) {
            const enviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosNovas, `ambiente-${ambIndex}`);
            fotosAtualizadas.ambientes[ambIndex].fotos = [...amb.fotos.filter(f => f?.path), ...enviadas];
            totalFotos += enviadas.length;
          }
        }
        if (amb.itens?.length) {
          for (let itemIndex = 0; itemIndex < amb.itens.length; itemIndex++) {
            const item = amb.itens[itemIndex];
            if (item.fotos?.length) {
              const fotosNovas = item.fotos.filter(f => !f?.path);
              if (fotosNovas.length) {
                const enviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosNovas, `ambiente-${ambIndex}/item-${itemIndex}`);
                fotosAtualizadas.ambientes[ambIndex].itens[itemIndex].fotos = [...item.fotos.filter(f => f?.path), ...enviadas];
                totalFotos += enviadas.length;
              }
            }
          }
        }
      }
    }

    if (insp.medidores && typeof insp.medidores === 'object') {
      fotosAtualizadas.medidores = { ...insp.medidores };
      for (const [nomeMed, dadosMed] of Object.entries(insp.medidores)) {
        if (!dadosMed?.fotos?.length) continue;
        const fotosNovas = dadosMed.fotos.filter(f => !f?.path);
        if (!fotosNovas.length) continue;
        const enviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosNovas, `medidor-${nomeMed}`);
        fotosAtualizadas.medidores[nomeMed].fotos = [...dadosMed.fotos.filter(f => f?.path), ...enviadas];
        totalFotos += enviadas.length;
      }
    }

    if (insp.chaves && typeof insp.chaves === 'object') {
      fotosAtualizadas.chaves = { ...insp.chaves };
      for (const [nomeChave, dadosChave] of Object.entries(insp.chaves)) {
        if (!dadosChave) continue;
        if (Array.isArray(dadosChave)) {
          for (let i = 0; i < dadosChave.length; i++) {
            if (!dadosChave[i]?.fotos?.length) continue;
            const fotosNovas = dadosChave[i].fotos.filter(f => !f?.path);
            if (!fotosNovas.length) continue;
            const enviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosNovas, `chave-${nomeChave}-${i}`);
            fotosAtualizadas.chaves[nomeChave][i].fotos = [...dadosChave[i].fotos.filter(f => f?.path), ...enviadas];
            totalFotos += enviadas.length;
          }
        } else if (dadosChave?.fotos?.length) {
          const fotosNovas = dadosChave.fotos.filter(f => !f?.path);
          if (!fotosNovas.length) continue;
          const enviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosNovas, `chave-${nomeChave}`);
          fotosAtualizadas.chaves[nomeChave].fotos = [...dadosChave.fotos.filter(f => f?.path), ...enviadas];
          totalFotos += enviadas.length;
        }
      }
    }

    if (insp.parecerTecnico?.fotos?.length) {
      const fotosNovas = insp.parecerTecnico.fotos.filter(f => !f?.path);
      if (fotosNovas.length) {
        const enviadas = await enviarLoteDeFotos(userId, vistoriaId, fotosNovas, 'parecer');
        fotosAtualizadas.parecerTecnico.fotos = [...insp.parecerTecnico.fotos.filter(f => f?.path), ...enviadas];
        totalFotos += enviadas.length;
      }
    }

    console.log(`📸 TOTAL DE FOTOS ENVIADAS: ${totalFotos}`);
    if (totalFotos > 0) {
      await supabase.from("inspections").update({ dados: fotosAtualizadas }).eq('id', insp.id);
    }

    done++;
    onProgress?.(done, inspections.length);
    console.log(`✅ VISTORIA ${insp.id} — FINALIZADA!\n`);
  }
  console.log('🎉 TODAS ENVIADAS COM SUCESSO!');
  return done;
}

export async function pullInspections() {
  const user = await ensureSignedIn();
  const { data, error } = await supabase
    .from("inspections").select("*").eq("owner_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).map(async row => {
    const vistoria = { ...row.dados, id: row.id, data: row.data };
    return await carregarUrlsFotos(vistoria);
  }));
}

export async function deleteInspectionRemote(id) {
  const user = await ensureSignedIn();
  const { error } = await supabase.from("inspections").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
}