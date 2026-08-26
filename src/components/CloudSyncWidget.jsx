import { useState } from 'react';
import { CloudOff, CloudUpload, CloudDownload } from 'lucide-react';
import { pushInspections, pullInspections } from './sync.js';
import { supabaseEnabled } from './supabaseClient.js';

export default function CloudSyncWidget({ inspections, onImportInspections }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // 🔄 Enviar para a nuvem
  const handlePush = async () => {
    setLoading(true);
    setMessage('Enviando...');
    try {
      const count = await pushInspections(inspections, (done, total) => {
        setMessage(`Enviando ${done}/${total}...`);
      });
      setMessage(`✅ ${count} vistoria(s) enviada(s) com sucesso!`);
    } catch (err) {
      setMessage(`❌ ${err.message || 'Erro ao enviar'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // ⬇️ Baixar da nuvem
  const handlePull = async () => {
    setLoading(true);
    setMessage('Baixando...');
    try {
      const data = await pullInspections();
      onImportInspections?.(data);
      setMessage(`✅ ${data.length} vistoria(s) recebida(s) da nuvem!`);
    } catch (err) {
      setMessage(`❌ ${err.message || 'Erro ao baixar'}`);
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  if (!supabaseEnabled) {
    return (
      <button
        className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5 opacity-60"
        disabled
      >
        <CloudOff size={14} /> Nuvem desativada
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handlePush}
        disabled={loading || inspections.length === 0}
        className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5"
      >
        <CloudUpload size={14} /> Enviar
      </button>
      <button
        onClick={handlePull}
        disabled={loading}
        className="btn-ghost rounded-full px-3 py-2.5 text-xs flex items-center gap-1.5"
      >
        <CloudDownload size={14} /> Baixar
      </button>
      {message && (
        <span className="text-xs text-gray-600 dark:text-gray-300 ml-2 whitespace-nowrap">
          {message}
        </span>
      )}
    </div>
  );
}