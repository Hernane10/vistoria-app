// @ts-nocheck
import { useState, useRef, useContext } from "react";
import { Camera, Upload, Video, X, Play, Target, Mic } from "lucide-react";
import { LightboxContext } from "../App";
import { filesToPhotos, getUrlFoto, fmtDateTime } from "../utils/helpers";

function MediaPicker({ onAdd, multiple = true, small = false }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const videoRef = useRef(null);
  const [recordingVideo, setRecordingVideo] = useState(false);
  const [recError, setRecError] = useState("");

  async function handlePick(e) {
    const files = Array.from(e.target.files || []);
    if (files.length) await onAdd(files);
    e.target.value = "";
  }
  async function handleVideoRecorded(file) { setRecordingVideo(false); await onAdd([file]); }

  const btnClass = small ? "btn-ghost rounded-xl flex flex-col items-center justify-center gap-0.5" : "btn-ghost rounded-2xl flex items-center justify-center gap-1.5 text-xs px-3 py-2.5";
  const size = small ? { width: 60, height: 60 } : undefined;
  const label = (txt) => (small ? <span className="text-[9px] text-center leading-tight">{txt}</span> : <span>{txt}</span>);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => cameraRef.current?.click()} className={btnClass} style={size}><Camera size={small ? 16 : 14} />{label("Tirar foto")}</button>
        <button type="button" onClick={() => galleryRef.current?.click()} className={btnClass} style={size}><Upload size={small ? 16 : 14} />{label("Enviar imagem")}</button>
        <button type="button" onClick={() => { setRecError(""); setRecordingVideo(true); }} className={btnClass} style={size}><Video size={small ? 16 : 14} />{label("Gravar vídeo")}</button>
        <button type="button" onClick={() => videoRef.current?.click()} className={btnClass} style={size}><Upload size={small ? 16 : 14} />{label("Enviar vídeo")}</button>
      </div>
      {recError && <p className="text-xs" style={{ color: "var(--bad)" }}>{recError}</p>}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple={multiple} className="hidden" onChange={handlePick} />
      <input ref={galleryRef} type="file" accept="image/*" multiple={multiple} className="hidden" onChange={handlePick} />
      <input ref={videoRef} type="file" accept="video/*" multiple={multiple} className="hidden" onChange={handlePick} />
      {recordingVideo && <VideoRecorderModal onSave={handleVideoRecorded} onClose={() => setRecordingVideo(false)} onError={(msg) => { setRecordingVideo(false); setRecError(msg); }} />}
    </div>
  );
}

function VideoRecorderModal({ onSave, onClose, onError }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [recording, setRecording] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
        setReady(true);
      } catch { onError("Não foi possível acessar a câmera. Verifique as permissões do navegador."); }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  function startRecording() {
    if (!streamRef.current) return;
    const recorder = new MediaRecorder(streamRef.current);
    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const file = new File([blob], `video-${Date.now()}.webm`, { type: "video/webm" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onSave(file);
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  }

  function stopRecording() { recorderRef.current?.stop(); }

  return (
    <div className="no-print modal-fade" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card modal-pop p-4" style={{ maxWidth: 460, width: "100%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="display text-sm font-bold">Gravar vídeo</h3>
          <button onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); onClose(); }} className="btn-ghost rounded-full p-1.5"><X size={14} /></button>
        </div>
        <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", background: "#000", position: "relative" }}>
          <video ref={videoRef} muted playsInline style={{ width: "100%", display: "block", maxHeight: 320, objectFit: "cover" }} />
          {recording && <span className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#E23B3B" }} className="pulseRing" /> Gravando</span>}
        </div>
        <div className="flex justify-center gap-2 mt-3">
          {!recording ? <button onClick={startRecording} disabled={!ready} className="btn-primary rounded-full px-5 py-2.5 text-sm flex items-center gap-2"><Video size={15} /> Iniciar gravação</button> : <button onClick={stopRecording} className="btn-primary rounded-full px-5 py-2.5 text-sm flex items-center gap-2" style={{ background: "var(--bad)" }}>Parar e salvar</button>}
        </div>
      </div>
    </div>
  );
}

function PhotoAnnotator({ src, marcas, onSave, onClose }) {
  const marcasArray = Array.isArray(marcas) ? marcas : (marcas?.points || []);
  const marcasComentario = Array.isArray(marcas) ? "" : (marcas?.comentario || "");
  const [pontos, setPontos] = useState(marcasArray);
  const [comentario, setComentario] = useState(marcasComentario);
  const imgRef = useRef(null);

  function handleClick(e) {
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPontos((prev) => [...prev, { x, y }]);
  }
  function undo() { setPontos((prev) => prev.slice(0, -1)); }
  function save() { onSave({ points: pontos, comentario }); onClose(); }

  return (
    <div className="no-print" style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="card p-4" style={{ maxWidth: 520, width: "100%" }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="display text-sm font-bold">Marcar avaria na foto</h3>
          <button onClick={onClose} className="btn-ghost rounded-full p-1.5"><X size={14} /></button>
        </div>
        <p className="text-xs mb-2" style={{ color: "var(--ink-soft)" }}>Toque na foto para marcar o ponto exato da avaria.</p>
        <div className="relative" style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)", cursor: "crosshair" }}>
          <img ref={imgRef} src={getUrlFoto(src)} alt="" onClick={handleClick} style={{ width: "100%", height: "auto", maxHeight: 500, objectFit: "contain", display: "block", userSelect: "none" }} />
          {pontos.map((p, i) => (
            <div key={i} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 22, height: 22, borderRadius: "50%", border: "2.5px solid #E23B3B", background: "rgba(226,59,59,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>{i + 1}</div>
          ))}
        </div>
        <div className="mt-3">
          <label className="label block mb-1.5">Comentário / observação da marcação</label>
          <textarea className="textarea w-full px-4 py-2.5 text-sm" rows={2} placeholder="Descreva a avaria marcada..." value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </div>
        <div className="flex items-center justify-between gap-2 mt-3">
          <button onClick={undo} disabled={pontos.length === 0} className="btn-ghost rounded-full px-3 py-2 text-xs">Desfazer último</button>
          <div className="flex gap-2"><button onClick={onClose} className="btn-ghost rounded-full px-3 py-2 text-xs">Cancelar</button><button onClick={save} className="btn-primary rounded-full px-4 py-2 text-xs">Salvar marcações</button></div>
        </div>
      </div>
    </div>
  );
}

function PhotoThumb({ foto, size = 60, onRemove, onUpdate }) {
  const openLightbox = useContext(LightboxContext);
  const [annotating, setAnnotating] = useState(false);
  const type = foto.type || "image";
  const marcas = foto.marcas || null;
  const pontos = Array.isArray(marcas) ? marcas : (marcas?.points || []);
  const comentarioMarcacao = Array.isArray(marcas) ? "" : (marcas?.comentario || "");

  if (type === "video") {
    return (
      <div className="photo-thumb" style={{ width: size, height: size, background: "#000" }}>
        <video src={foto.src} className="w-full h-full object-cover cursor-zoom-in" onClick={() => openLightbox(foto.src)} muted />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><Play size={size > 70 ? 22 : 16} color="#fff" fill="#fff" style={{ opacity: 0.85 }} /></div>
        {foto.date && <span className="photo-date">{fmtDateTime(foto.date).split(" ")[0]}</span>}
        {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }}><X size={10} /></button>}
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="photo-thumb flex flex-col items-center justify-center gap-1 p-1" style={{ width: Math.max(size, 130), height: size, background: "var(--card-alt)" }}>
        <audio src={foto.src} controls style={{ width: "100%", height: 28 }} />
        {foto.date && <span className="text-[8px] mono" style={{ color: "var(--ink-soft)" }}>{fmtDateTime(foto.date)}</span>}
        {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }}><X size={10} /></button>}
      </div>
    );
  }

  return (
    <div className="photo-thumb" style={{ width: size, height: size }}>
      <img src={getUrlFoto(foto.src)} alt="" loading="lazy" className="w-full h-full object-contain cursor-zoom-in" onClick={() => openLightbox(getUrlFoto(foto.src))} />
      {pontos.map((p, i) => (
        <div key={i} title={comentarioMarcacao || undefined} style={{ position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%,-50%)", width: 12, height: 12, borderRadius: "50%", border: "1.5px solid #E23B3B", background: "rgba(226,59,59,0.35)" }} />
      ))}
      {foto.date && <span className="photo-date">{fmtDateTime(foto.date).split(" ")[0]}</span>}
      {onUpdate && <button onClick={(e) => { e.stopPropagation(); setAnnotating(true); }} className="absolute bottom-0.5 left-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }} title="Marcar avaria na foto"><Target size={10} /></button>}
      {onRemove && <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="absolute top-0.5 right-0.5 rounded-full bg-black/60 text-white flex items-center justify-center" style={{ width: 16, height: 16 }}><X size={10} /></button>}
      {annotating && <PhotoAnnotator src={foto.src} marcas={marcas} onSave={(novasMarcas) => onUpdate(novasMarcas)} onClose={() => setAnnotating(false)} />}
    </div>
  );
}

function Lightbox({ src, onClose }) {
  if (!src) return null;
  return (
    <div className="no-print" onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,11,16,0.92)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, cursor: "zoom-out" }}>
      <button onClick={onClose} style={{ position: "absolute", top: 18, right: 18, width: 36, height: 36, borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
      <img src={getUrlFoto(src)} alt="" style={{ maxWidth: "94vw", maxHeight: "90vh", width: "auto", height: "auto", objectFit: "contain", borderRadius: 8 }} onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

function TextAreaWithDictation({ value, onChange, placeholder, rows = 2, disabled, className = "", style }) {
  const [listening, setListening] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const recognitionRef = useRef(null);
  const baseValueRef = useRef(value);

  function toggleDictation() {
    if (listening) { recognitionRef.current?.stop(); return; }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setUnsupported(true); return; }
    baseValueRef.current = value;
    const rec = new SpeechRecognition();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      const prefix = baseValueRef.current ? baseValueRef.current.trim() + " " : "";
      onChange(prefix + transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  }

  return (
    <div className="relative">
      <textarea disabled={disabled} className={`textarea w-full text-sm ${className}`} style={{ paddingRight: 40, ...style }} rows={rows} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
      {!disabled && (
        <button type="button" onClick={toggleDictation} title={listening ? "Parar ditado" : "Falar por áudio"} className="absolute rounded-full flex items-center justify-center no-print" style={{ top: 8, right: 8, width: 24, height: 24, background: listening ? "var(--bad)" : "var(--card-alt)", color: listening ? "#fff" : "var(--ink-soft)", border: "1px solid var(--line)" }}>
          <Mic size={12} />
        </button>
      )}
      {unsupported && <p className="text-xs mt-1" style={{ color: "var(--ink-soft)" }}>Ditado por voz não é suportado neste navegador.</p>}
    </div>
  );
}



