import fs from "fs";
import path from "path";

const srcRoot = path.resolve("src");
const appPath = path.join(srcRoot, "App.jsx");
const lines = fs.readFileSync(appPath, "utf8").split(/\r?\n/);

function slice(start, end) {
  return lines.slice(start - 1, end).join("\n");
}

function write(rel, content) {
  const p = path.join(srcRoot, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content.replace(/\n+$/, "") + "\n", "utf8");
}

function exportify(src) {
  return src
    .replace(/^async function /gm, "export async function ")
    .replace(/^function /gm, "export function ")
    .replace(/^const /gm, "export const ");
}

function unindent(src, n = 8) {
  const re = new RegExp(`^ {${n}}`, "gm");
  return src.replace(re, "");
}

write("utils/id.js", `export const uid = () => Math.random().toString(36).slice(2, 10);\n`);

write(
  "utils/dates.js",
  `${slice(290, 304)}

${slice(796, 800)}

${slice(3371, 3376)}`.replace(/^function /gm, "export function")
);

write("utils/html.js", exportify(slice(3597, 3599)));

write(
  "utils/media.js",
  `export ${slice(196, 288).replace(/^function fileToDataURL/, "export function fileToDataURL")}`
    .replace("export export function", "export function")
);
// fix media.js properly
write(
  "utils/media.js",
  exportify(slice(196, 288))
);

write(
  "utils/inspectionText.js",
  `import { fmtDate } from "./dates";

${exportify(slice(746, 769))}
`
);

write(
  "lib/constants.js",
  `${exportify(slice(15, 88))}

${exportify(slice(90, 175))}

export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
`
);

write(
  "lib/inspection.js",
  `import { uid } from "../utils/id";
import { todayISO } from "../utils/dates";
import { normalizePhoto } from "../utils/media";
import { ITEM_FIELD_DEFS, PROPERTY_MODELS } from "./constants";

${exportify(slice(177, 192))}

${exportify(slice(802, 836))}

${exportify(slice(875, 956))}
`
);

write(
  "lib/inspectionStorage.js",
  `import { storage } from "./storage";

${exportify(slice(838, 872))}
`
);

write(
  "lib/reportHtml.js",
  `import { fmtDate, fmtDateTime } from "../utils/dates";
import { escapeHtml } from "../utils/html";
import { enderecoCompleto } from "../utils/inspectionText";
import { CHAVE_TIPOS, ITEM_FIELD_DEFS } from "./constants";

${exportify(slice(3601, 3834))}
`
);

write(
  "lib/auth.js",
  `import { supabase, supabaseEnabled } from "./supabaseClient";

// Anonymous auth for this device — no login screen. Used by cloud sync.
export async function ensureSignedIn() {
  if (!supabaseEnabled) throw new Error("Supabase não configurado (veja .env.example).");
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}
`
);

write(
  "hooks/useLightbox.js",
  `import { createContext, useContext } from "react";

export const LightboxContext = createContext(() => {});

export function useLightbox() {
  return useContext(LightboxContext);
}

export function LightboxProvider({ value, children }) {
  return <LightboxContext.Provider value={value}>{children}</LightboxContext.Provider>;
}
`
);

write(
  "hooks/useFieldOptionsStore.js",
  `import { useState, useEffect } from "react";
import { storage } from "../lib/storage";

${exportify(slice(2799, 2863))}
`
);

const cssInner = unindent(slice(1187, 1413), 8);
write("App.css", cssInner + "\n");

write(
  "hooks/useApp.js",
  `import { useState, useRef, useEffect, useCallback } from "react";
import { storage } from "../lib/storage";
import { uid } from "../utils/id";
import { todayISO } from "../utils/dates";
import {
  emptyInspection,
  withDefaults,
  buildExampleInspection,
} from "../lib/inspection";
import {
  storageLoadAll,
  storageSaveInspection,
  storageSaveIndex,
  storageDeleteInspection,
} from "../lib/inspectionStorage";

export function useApp() {
${unindent(slice(959, 1182), 2)}

  return {
    inspections,
    view,
    setView,
    currentId,
    setCurrentId,
    current,
    query,
    setQuery,
    dateFilter,
    setDateFilter,
    calendarVisible,
    theme,
    pendingModel,
    customModels,
    agendamentos,
    lightboxSrc,
    setLightboxSrc,
    loaded,
    saveState,
    filtered,
    toggleTheme,
    saveCustomModel,
    deleteCustomModel,
    addAgendamento,
    removeAgendamento,
    toggleCalendar,
    updateInspection,
    createInspection,
    deleteInspection,
    startNew,
    generateExample,
    exportInspections,
    importInspections,
  };
}
`
);

function wrapComponent(rel, imports, start, end, extraTransform = (s) => s) {
  const body = extraTransform(exportify(slice(start, end)));
  write(rel, `${imports}\n\n${body}\n`);
}

wrapComponent(
  "components/Lightbox.jsx",
  `import { X } from "lucide-react";`,
  724,
  744
);

wrapComponent(
  "components/PromptModal.jsx",
  `import { useState } from "react";`,
  691,
  722
);

wrapComponent(
  "components/TextAreaWithDictation.jsx",
  `import { useState, useRef } from "react";
import { Mic } from "lucide-react";`,
  622,
  689
);

wrapComponent(
  "components/SaveIndicator.jsx",
  `import { Loader2, Cloud, CloudOff } from "lucide-react";`,
  1492,
  1505
);

wrapComponent(
  "components/media/VideoRecorderModal.jsx",
  `import { useState, useRef, useEffect } from "react";
import { X, Video } from "lucide-react";`,
  373,
  453
);

wrapComponent(
  "components/media/PhotoAnnotator.jsx",
  `import { useState, useRef } from "react";
import { X } from "lucide-react";`,
  455,
  530
);

wrapComponent(
  "components/media/PhotoThumb.jsx",
  `import { useState, useContext } from "react";
import { X, Play, Target } from "lucide-react";
import { LightboxContext } from "../../hooks/useLightbox";
import { fmtDateTime } from "../../utils/dates";
import { PhotoAnnotator } from "./PhotoAnnotator";`,
  532,
  620
);

wrapComponent(
  "components/media/MediaPicker.jsx",
  `import { useState, useRef } from "react";
import { Camera, Upload, Video } from "lucide-react";
import { VideoRecorderModal } from "./VideoRecorderModal";`,
  306,
  366
);

wrapComponent(
  "components/media/PhotoPicker.jsx",
  `import { MediaPicker } from "./MediaPicker";`,
  368,
  371
);

wrapComponent(
  "components/media/CapaFotoEditor.jsx",
  `import { useRef } from "react";
import { Camera, X } from "lucide-react";
import { fileToDataURL, maybeCompressImage } from "../../utils/media";
import { fmtDateTime } from "../../utils/dates";`,
  2312,
  2345
);

wrapComponent(
  "components/calendar/AgendarModal.jsx",
  `import { useState } from "react";
import { Calendar, X } from "lucide-react";
import { fmtDate } from "../../utils/dates";`,
  1651,
  1674
);

wrapComponent(
  "components/calendar/CalendarWidget.jsx",
  `import { useState } from "react";
import { ChevronRight, EyeOff, Calendar, X } from "lucide-react";
import { MESES, DIAS_SEMANA } from "../../lib/constants";
import { todayISO, fmtDate } from "../../utils/dates";
import { AgendarModal } from "./AgendarModal";`,
  1510,
  1649
);

wrapComponent(
  "components/inspection/AjudaTab.jsx",
  `import { Info } from "lucide-react";`,
  1855,
  1895
);

wrapComponent(
  "components/inspection/ModelosTab.jsx",
  `import { Plus, Wand2, Trash2 } from "lucide-react";
import { PROPERTY_MODELS } from "../../lib/constants";`,
  1897,
  1963
);

wrapComponent(
  "components/inspection/QrCodeModal.jsx",
  `import { QrCode, X } from "lucide-react";
import { fichaText, qrCodeUrl } from "../../utils/inspectionText";`,
  771,
  794
);

wrapComponent(
  "components/forms/TechFieldPicker.jsx",
  `import { useState } from "react";
import { ChevronDown, Pencil, Plus, X } from "lucide-react";
import { useFieldOptionsStore } from "../../hooks/useFieldOptionsStore";
import { PromptModal } from "../PromptModal";`,
  2865,
  2986
);

wrapComponent(
  "components/forms/QuantityStepper.jsx",
  ``,
  2988,
  3009
);

wrapComponent(
  "components/forms/ItemRow.jsx",
  `import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, AlertTriangle, Plus } from "lucide-react";
import { ESTADOS, ITEM_FIELD_DEFS, FIELD_OPTIONS, relevantFieldKeys } from "../../lib/constants";
import { filesToPhotos } from "../../utils/media";
import { PhotoThumb } from "../media/PhotoThumb";
import { PhotoPicker } from "../media/PhotoPicker";
import { TextAreaWithDictation } from "../TextAreaWithDictation";
import { TechFieldPicker } from "./TechFieldPicker";
import { QuantityStepper } from "./QuantityStepper";`,
  3011,
  3160
);

wrapComponent(
  "components/inspection/AmbienteCard.jsx",
  `import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, Plus } from "lucide-react";
import { makeItem } from "../../lib/inspection";
import { filesToPhotos } from "../../utils/media";
import { PhotoThumb } from "../media/PhotoThumb";
import { PhotoPicker } from "../media/PhotoPicker";
import { ItemRow } from "../forms/ItemRow";`,
  2714,
  2797
);

wrapComponent(
  "components/inspection/AmbientesTab.jsx",
  `import { Layers, ChevronDown, Plus, MapPin } from "lucide-react";
import { TEMPLATES, PROPERTY_MODELS } from "../../lib/constants";
import { AmbienteCard } from "./AmbienteCard";`,
  2625,
  2712
);

wrapComponent(
  "components/inspection/MedidorCard.jsx",
  `import { filesToPhotos } from "../../utils/media";
import { PhotoThumb } from "../media/PhotoThumb";
import { PhotoPicker } from "../media/PhotoPicker";
import { TextAreaWithDictation } from "../TextAreaWithDictation";`,
  3162,
  3242
);

wrapComponent(
  "components/inspection/MedidoresTab.jsx",
  `import { Droplet, Zap, Flame } from "lucide-react";
import { MedidorCard } from "./MedidorCard";`,
  3244,
  3276
);

wrapComponent(
  "components/inspection/ChaveRow.jsx",
  `import { KeyRound, Trash2 } from "lucide-react";
import { filesToPhotos } from "../../utils/media";
import { PhotoThumb } from "../media/PhotoThumb";
import { PhotoPicker } from "../media/PhotoPicker";
import { QuantityStepper } from "../forms/QuantityStepper";`,
  3278,
  3322
);

wrapComponent(
  "components/inspection/ChavesTab.jsx",
  `import { Plus } from "lucide-react";
import { uid } from "../../utils/id";
import { CHAVE_TIPOS } from "../../lib/constants";
import { emptyChave } from "../../lib/inspection";
import { ChaveRow } from "./ChaveRow";`,
  3324,
  3369
);

wrapComponent(
  "components/inspection/ParecerTecnicoTab.jsx",
  `import { useRef } from "react";
import { FileText, Upload, Trash2 } from "lucide-react";
import { uid } from "../../utils/id";
import { fileToDataURL } from "../../utils/media";
import { fmtFileSize, fmtDateTime } from "../../utils/dates";
import { TextAreaWithDictation } from "../TextAreaWithDictation";`,
  3378,
  3456
);

wrapComponent(
  "components/inspection/SignaturePad.jsx",
  `import { useState, useRef } from "react";
import { PenLine, RotateCcw } from "lucide-react";`,
  3489,
  3595
);

wrapComponent(
  "components/inspection/AssinaturaTab.jsx",
  `import { PenLine } from "lucide-react";
import { SignaturePad } from "./SignaturePad";`,
  3458,
  3487
);

wrapComponent(
  "components/inspection/ComparacaoTab.jsx",
  `import { useState } from "react";
import { GitCompare, ChevronRight, CheckCircle2 } from "lucide-react";
import { fmtDate } from "../../utils/dates";
import { enderecoCompleto } from "../../utils/inspectionText";`,
  2505,
  2623
);

wrapComponent(
  "pages/ListPage.jsx",
  `import { useState, useRef } from "react";
import {
  ClipboardList, Plus, Download, Upload, Loader2, Sun, Moon,
  Layers, HelpCircle, Search, Building2, Trash2, Eye,
} from "lucide-react";
import { SaveIndicator } from "../components/SaveIndicator";
import CloudSyncWidget from "../components/CloudSyncWidget";
import { CalendarWidget } from "../components/calendar/CalendarWidget";
import { AjudaTab } from "../components/inspection/AjudaTab";
import { ModelosTab } from "../components/inspection/ModelosTab";
import { fmtDate } from "../utils/dates";
import { enderecoCompleto } from "../utils/inspectionText";`,
  1676,
  1853,
  (s) => s.replace("export function ListView", "export default function ListPage").replace("function ListView", "export default function ListPage")
);

wrapComponent(
  "pages/ModelBuilderPage.jsx",
  `import { useState } from "react";
import { ArrowLeft, Layers, Trash2, Plus } from "lucide-react";
import { uid } from "../utils/id";`,
  1965,
  2060,
  (s) => s.replace("export function ModelBuilderView", "export default function ModelBuilderPage")
);

wrapComponent(
  "pages/NewInspectionPage.jsx",
  `import { useState, useRef } from "react";
import { ArrowLeft, Camera, X, Calendar, Building2, Loader2 } from "lucide-react";
import { todayISO } from "../utils/dates";
import { fileToDataURL, maybeCompressImage } from "../utils/media";
import { PROPERTY_MODELS } from "../lib/constants";
import { ambientesFromModel } from "../lib/inspection";`,
  2062,
  2310,
  (s) => s.replace("export function NewInspectionView", "export default function NewInspectionPage")
);

wrapComponent(
  "pages/InspectionDetailPage.jsx",
  `import { useState } from "react";
import {
  ArrowLeft, Download, QrCode, Unlock, Lock, CheckCircle2,
  Layers, Gauge, KeyRound, GitCompare, FileText, PenLine, Printer,
} from "lucide-react";
import { makeAmbiente, ambientesFromModel } from "../lib/inspection";
import { enderecoCompleto } from "../utils/inspectionText";
import { fmtDate } from "../utils/dates";
import { CapaFotoEditor } from "../components/media/CapaFotoEditor";
import { QrCodeModal } from "../components/inspection/QrCodeModal";
import { AmbientesTab } from "../components/inspection/AmbientesTab";
import { MedidoresTab } from "../components/inspection/MedidoresTab";
import { ChavesTab } from "../components/inspection/ChavesTab";
import { ComparacaoTab } from "../components/inspection/ComparacaoTab";
import { ParecerTecnicoTab } from "../components/inspection/ParecerTecnicoTab";
import { AssinaturaTab } from "../components/inspection/AssinaturaTab";
import ReportPage from "./ReportPage";`,
  2347,
  2503,
  (s) =>
    s
      .replace("export function DetailView", "export default function InspectionDetailPage")
      .replace("<ReportView ", "<ReportPage ")
);

wrapComponent(
  "pages/ReportPage.jsx",
  `import { useState, useRef, useEffect, useContext } from "react";
import {
  ArrowLeft, Share2, Printer, Info, Camera, X, AlertTriangle,
} from "lucide-react";
import { LightboxContext } from "../hooks/useLightbox";
import { storage } from "../lib/storage";
import { fileToDataURL, maybeCompressImage } from "../utils/media";
import { fmtDate, fmtDateTime } from "../utils/dates";
import { enderecoCompleto } from "../utils/inspectionText";
import { ITEM_FIELD_DEFS, CHAVE_TIPOS } from "../lib/constants";
import { buildReportHTML } from "../lib/reportHtml";
import { SignaturePad } from "../components/inspection/SignaturePad";`,
  3836,
  4191,
  (s) => s.replace("export function ReportView", "export default function ReportPage")
);

write(
  "App.jsx",
  `import { Loader2 } from "lucide-react";
import { LightboxContext } from "./hooks/useLightbox";
import { Lightbox } from "./components/Lightbox";
import ListPage from "./pages/ListPage";
import NewInspectionPage from "./pages/NewInspectionPage";
import ModelBuilderPage from "./pages/ModelBuilderPage";
import InspectionDetailPage from "./pages/InspectionDetailPage";
import { useApp } from "./hooks/useApp";
import "./App.css";

export default function App() {
  const {
    view,
    setView,
    current,
    currentId,
    setCurrentId,
    query,
    setQuery,
    dateFilter,
    setDateFilter,
    calendarVisible,
    theme,
    pendingModel,
    customModels,
    agendamentos,
    lightboxSrc,
    setLightboxSrc,
    loaded,
    saveState,
    inspections,
    filtered,
    toggleTheme,
    saveCustomModel,
    deleteCustomModel,
    addAgendamento,
    removeAgendamento,
    toggleCalendar,
    updateInspection,
    createInspection,
    deleteInspection,
    startNew,
    generateExample,
    exportInspections,
    importInspections,
  } = useApp();

  return (
    <div className={\`app-root \${theme === "light" ? "theme-light" : ""}\`}>
      <LightboxContext.Provider value={setLightboxSrc}>
        <Lightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />

        {!loaded && (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={22} className="animate-spin" style={{ color: "var(--ink-soft)" }} />
          </div>
        )}

        {loaded && view === "list" && (
          <div key="list" className="view-enter">
            <ListPage
              inspections={filtered}
              allInspections={inspections}
              query={query}
              setQuery={setQuery}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
              calendarVisible={calendarVisible}
              toggleCalendar={toggleCalendar}
              onOpen={(id) => { setCurrentId(id); setView("detail"); }}
              onNew={() => startNew(null)}
              onUseModel={(key) => startNew(key)}
              onGenerateExample={generateExample}
              onDelete={deleteInspection}
              saveState={saveState}
              customModels={customModels}
              onCreateCustomModel={() => setView("buildModel")}
              onDeleteCustomModel={deleteCustomModel}
              theme={theme}
              toggleTheme={toggleTheme}
              agendamentos={agendamentos}
              onAddAgendamento={addAgendamento}
              onRemoveAgendamento={removeAgendamento}
              onExport={exportInspections}
              onImport={importInspections}
            />
          </div>
        )}

        {view === "new" && (
          <div key="new" className="view-enter">
            <NewInspectionPage
              onCancel={() => setView("list")}
              onCreate={createInspection}
              initialModel={pendingModel}
            />
          </div>
        )}

        {view === "buildModel" && (
          <div key="buildModel" className="view-enter">
            <ModelBuilderPage
              onCancel={() => setView("list")}
              onSave={async (model) => { await saveCustomModel(model); setView("list"); }}
            />
          </div>
        )}

        {view === "detail" && current && (
          <div key="detail" className="view-enter">
            <InspectionDetailPage
              inspection={current}
              onBack={() => { setView("list"); setCurrentId(null); }}
              onUpdate={(updater) => updateInspection(current.id, updater)}
              customModels={customModels}
              allInspections={inspections}
              onExport={() => exportInspections([current.id])}
            />
          </div>
        )}
      </LightboxContext.Provider>
    </div>
  );
}
`
);

console.log("split complete");
