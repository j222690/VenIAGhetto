// PresetLibrary — banco de imagens inicial do app.
//
// Modelos prontos (gerados por IA e hospedados no bucket público `presets`) que
// lojas SEM fotos próprias podem usar para criar posts/looks. São curados e
// fixos — não são conteúdo fake pré-carregado na loja, e sim um acervo de apoio
// oferecido pelo app. Para adicionar/trocar, gere novas imagens e suba em
// `presets/models/*` (ver scratchpad/gen-presets ou a Edge Function).

export interface PresetModel {
  id: string;
  label: string;
  gender: "female" | "male";
  url: string;
}

const PRESETS_BASE =
  "https://vjjbihptzgxptyhzaftp.supabase.co/storage/v1/object/public/presets/models";

export const PRESET_MODELS: PresetModel[] = [
  { id: "fem-01", label: "Modelo Feminino 01", gender: "female", url: `${PRESETS_BASE}/fem-01.png` },
  { id: "fem-02", label: "Modelo Feminino 02", gender: "female", url: `${PRESETS_BASE}/fem-02.png` },
  { id: "fem-03", label: "Modelo Feminino 03", gender: "female", url: `${PRESETS_BASE}/fem-03.png` },
  { id: "masc-01", label: "Modelo Masculino 01", gender: "male", url: `${PRESETS_BASE}/masc-01.png` },
  { id: "masc-02", label: "Modelo Masculino 02", gender: "male", url: `${PRESETS_BASE}/masc-02.png` },
  { id: "masc-03", label: "Modelo Masculino 03", gender: "male", url: `${PRESETS_BASE}/masc-03.png` },
];

export const PresetLibrary = {
  models(gender?: "female" | "male"): PresetModel[] {
    return gender ? PRESET_MODELS.filter((m) => m.gender === gender) : PRESET_MODELS;
  },
};
