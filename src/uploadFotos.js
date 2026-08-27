import { supabase, supabaseEnabled } from './components/supabaseClient.js';

// =====================================================
// ✅ FUNÇÃO DE UPLOAD — 1 FOTO POR VEZ (completa, sem avisos)
// =====================================================
async function uploadFotoVistoria(userId, caminhoPasta, foto, index = 0) {
  console.log(`📤 Enviando foto ${index + 1} para: ${caminhoPasta}`);

  let fotoBase64 = foto;
  if (foto && typeof foto === 'object' && foto.src) {
    fotoBase64 = foto.src;
  }

  if (!fotoBase64 || typeof fotoBase64 !== 'string') {
    console.warn(`⚠️ Foto ${index + 1} inválida, pulando`);
    return null;
  }

  // Remove o prefixo data:image se existir
  const partes = fotoBase64.split(',');
  const dadosLimpos = partes.length > 1 ? partes[1] : partes[0];
  const tipoConteudo = partes[0]?.match(/data:(image\/[^;]+)/)?.[1] || 'image/jpeg';

  // Converte para Blob
  const resposta = await fetch(`data:${tipoConteudo};base64,${dadosLimpos}`);
  const blob = await resposta.blob();

  // Nome de arquivo único
  const nomeArquivo = `${Date.now()}_${index}.jpg`;
  const caminhoCompleto = `${userId}/${caminhoPasta}/${nomeArquivo}`;

  try {
    const { data, error } = await supabase.storage
      .from('vistoria_fotos')
      .upload(caminhoCompleto, blob, {
        contentType: tipoConteudo,
        upsert: false
      });

    if (error) {
      console.error(`❌ Erro foto ${index + 1}:`, error);
      return null;
    }

    // Gera URL pública para exibir no laudo/PDF
    const { data: { publicUrl } } = supabase.storage
      .from('vistoria_fotos')
      .getPublicUrl(caminhoCompleto);

    console.log(`✅ Foto ${index + 1} enviada:`, publicUrl);
    return publicUrl;

  } catch (err) {
    console.error(`❌ Exceção foto ${index + 1}:`, err);
    return null;
  }
}

// =====================================================
// ✅ FUNÇÃO PRINCIPAL — ENVIA TODAS AS FOTOS
// =====================================================
export async function enviarTodasFotosParaSupabase(userId, dadosVistoria) {
  if (!supabaseEnabled) {
    console.log('ℹ️ Supabase desativado, fotos não enviadas');
    return { ...dadosVistoria };
  }

  console.log('🚀 Iniciando envio de todas as fotos...');
  const dadosAtualizados = { ...dadosVistoria };
  let totalEnviadas = 0;

  // 1️⃣ Foto da Capa
  if (dadosAtualizados.fotoCapa?.src) {
    const url = await uploadFotoVistoria(userId, 'capa', dadosAtualizados.fotoCapa, 0);
    if (url) {
      dadosAtualizados.fotoCapa = { ...dadosAtualizados.fotoCapa, urlStorage: url };
      totalEnviadas++;
    }
  }

  // 2️⃣ Ambientes (Sala, Quarto, Cozinha, Área Externa, etc.)
  if (dadosAtualizados.ambientes && Array.isArray(dadosAtualizados.ambientes)) {
    for (const ambiente of dadosAtualizados.ambientes) {
      if (ambiente.fotos && Array.isArray(ambiente.fotos)) {
        const urlsEnviadas = [];
        for (let i = 0; i < ambiente.fotos.length; i++) {
          const foto = ambiente.fotos[i];
          if (foto?.src && !foto?.urlStorage) {
            const url = await uploadFotoVistoria(userId, `ambientes/${ambiente.nome}`, foto, i);
            if (url) {
              urlsEnviadas.push({ ...foto, urlStorage: url });
              totalEnviadas++;
            } else {
              urlsEnviadas.push(foto);
            }
          } else {
            urlsEnviadas.push(foto);
          }
        }
        ambiente.fotos = urlsEnviadas;
      }
    }
  }

  // 3️⃣ Medidores — Água, Energia, Gás
  if (dadosAtualizados.medidores) {
    for (const tipo of ['agua', 'energia', 'gas']) {
      const sec = dadosAtualizados.medidores[tipo];
      if (sec?.fotos && Array.isArray(sec.fotos)) {
        const urlsEnviadas = [];
        for (let i = 0; i < sec.fotos.length; i++) {
          const foto = sec.fotos[i];
          if (foto?.src && !foto?.urlStorage) {
            const url = await uploadFotoVistoria(userId, `medidores/${tipo}`, foto, i);
            if (url) {
              urlsEnviadas.push({ ...foto, urlStorage: url });
              totalEnviadas++;
            } else {
              urlsEnviadas.push(foto);
            }
          } else {
            urlsEnviadas.push(foto);
          }
        }
        sec.fotos = urlsEnviadas;
      }
    }
  }

  // 4️⃣ Chaves
  if (dadosAtualizados.chaves?.fotos && Array.isArray(dadosAtualizados.chaves.fotos)) {
    const urlsEnviadas = [];
    for (let i = 0; i < dadosAtualizados.chaves.fotos.length; i++) {
      const foto = dadosAtualizados.chaves.fotos[i];
      if (foto?.src && !foto?.urlStorage) {
        const url = await uploadFotoVistoria(userId, 'chaves', foto, i);
        if (url) {
          urlsEnviadas.push({ ...foto, urlStorage: url });
          totalEnviadas++;
        } else {
          urlsEnviadas.push(foto);
        }
      } else {
        urlsEnviadas.push(foto);
      }
    }
    dadosAtualizados.chaves.fotos = urlsEnviadas;
  }

  // 5️⃣ Parecer Técnico
  if (dadosAtualizados.parecer?.fotos && Array.isArray(dadosAtualizados.parecer.fotos)) {
    const urlsEnviadas = [];
    for (let i = 0; i < dadosAtualizados.parecer.fotos.length; i++) {
      const foto = dadosAtualizados.parecer.fotos[i];
      if (foto?.src && !foto?.urlStorage) {
        const url = await uploadFotoVistoria(userId, 'parecer', foto, i);
        if (url) {
          urlsEnviadas.push({ ...foto, urlStorage: url });
          totalEnviadas++;
        } else {
          urlsEnviadas.push(foto);
        }
      } else {
        urlsEnviadas.push(foto);
      }
    }
    dadosAtualizados.parecer.fotos = urlsEnviadas;
  }

  // 6️⃣ Outras observações
  if (dadosAtualizados.outras && Array.isArray(dadosAtualizados.outras)) {
    for (const item of dadosAtualizados.outras) {
      if (item.fotos && Array.isArray(item.fotos)) {
        const urlsEnviadas = [];
        for (let i = 0; i < item.fotos.length; i++) {
          const foto = item.fotos[i];
          if (foto?.src && !foto?.urlStorage) {
            const url = await uploadFotoVistoria(userId, `outras/${item.nome || 'item'}`, foto, i);
            if (url) {
              urlsEnviadas.push({ ...foto, urlStorage: url });
              totalEnviadas++;
            } else {
              urlsEnviadas.push(foto);
            }
          } else {
            urlsEnviadas.push(foto);
          }
        }
        item.fotos = urlsEnviadas;
      }
    }
  }

  console.log(`🎉 Envio concluído! ${totalEnviadas} foto(s) enviada(s)`);
  return dadosAtualizados;
}