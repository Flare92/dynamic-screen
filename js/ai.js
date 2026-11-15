// Intelligenza artificiale (facoltativa), chiamata dal browser con la chiave della persona:
// - Gemini 3.8 Flash (Google): ha un piano gratuito, chiave da Google AI Studio;
// - Claude (Anthropic): a pagamento, chiave da console.anthropic.com.
// Ogni funzione ha un'alternativa offline nell'app: l'AI migliora le scelte, non è indispensabile.

import { FOOD_IDS, foodMacros, foodLabel } from './diet.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini 3.8 Flash', by: 'Google', free: true, keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'Incolla la chiave (AIza…)', keyRe: /^AIza[\w-]{20,}$/ },
  claude: { label: 'Claude', by: 'Anthropic', free: false, keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'Incolla la chiave (sk-ant-…)', keyRe: /^sk-ant-/ },
};
const KEY_STORE = { gemini: 'ritmo.geminikey', claude: 'ritmo.aikey' };
const PROV_STORE = 'ritmo.aiprov';
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* */ } return null; };

/** il motore scelto e la sua chiave; null se l'AI non è attiva */
export function aiConfig() {
  let provider = ls(PROV_STORE);
  if (!PROVIDERS[provider]) provider = ls(KEY_STORE.gemini) ? 'gemini' : ls(KEY_STORE.claude) ? 'claude' : 'gemini';
  const key = ls(KEY_STORE[provider]);
  return key ? { provider, key, ...PROVIDERS[provider] } : null;
}
export const aiProvider = () => { const p = ls(PROV_STORE); return PROVIDERS[p] ? p : (ls(KEY_STORE.claude) && !ls(KEY_STORE.gemini) ? 'claude' : 'gemini'); };
export function setAiProvider(provider) { if (PROVIDERS[provider]) ls(PROV_STORE, provider); }
export function setAiKey(provider, key) { ls(KEY_STORE[provider], key); if (key) ls(PROV_STORE, provider); }
export const hasAiKey = (provider) => !!ls(KEY_STORE[provider]);

// ---------- Gemini (REST, risposta JSON vincolata allo schema)
export const GEMINI_MODEL = 'gemini-3.8-flash';
const GEMINI_FALLBACK = 'gemini-flash-latest';

async function askGemini(key, { system, user, schema, maxTokens }, model = GEMINI_MODEL, strict = true) {
  const generationConfig = { responseMimeType: 'application/json', maxOutputTokens: maxTokens };
  if (strict) generationConfig.responseJsonSchema = schema;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      // senza vincolo di schema, lo schema va nelle istruzioni
      systemInstruction: { parts: [{ text: strict ? system : `${system}\n\nRispondi solo con un oggetto JSON valido conforme a questo JSON Schema:\n${JSON.stringify(schema)}` }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error?.message || '';
    // se il modello non è disponibile per questa chiave, usa l'ultimo Flash disponibile
    if (res.status === 404 && model !== GEMINI_FALLBACK) return askGemini(key, { system, user, schema, maxTokens }, GEMINI_FALLBACK, strict);
    // se lo schema non è accettato, riprova con lo schema nelle istruzioni
    if (res.status === 400 && strict && !/API key/i.test(msg)) return askGemini(key, { system, user, schema, maxTokens }, model, false);
    const err = new Error(data?.error?.message || `errore ${res.status}`);
    err.status = res.status === 400 && /API key/i.test(data?.error?.message || '') ? 401 : res.status;
    throw err;
  }
  if (data.promptFeedback?.blockReason) throw new Error('Gemini non ha potuto rispondere a questa richiesta.');
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
  if (!text) throw new Error(cand?.finishReason === 'MAX_TOKENS' ? 'Risposta incompleta, riprova.' : 'Gemini non ha risposto, riprova.');
  try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')); } catch { throw new Error('Risposta non leggibile, riprova.'); }
}

// ---------- Claude (SDK Anthropic, output strutturato)
async function askClaude(key, { system, user, schema, maxTokens }) {
  const { Anthropic, betaJSONSchemaOutputFormat } = await import('../vendor/anthropic-sdk.js');
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
  const response = await client.beta.messages.parse({
    model: 'claude-opus-5-5',
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(schema) },
    system,
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') throw new Error('Claude non ha potuto rispondere a questa richiesta.');
  if (response.stop_reason === 'max_tokens' || !response.parsed_output) throw new Error('Risposta incompleta, riprova.');
  return response.parsed_output;
}

/** chiede una risposta JSON che rispetta lo schema al motore scelto */
export async function ask(cfg, { system, user, schema, maxTokens = 8000 }) {
  if (!cfg?.key) throw new Error('AI non attiva');
  return cfg.provider === 'claude' ? askClaude(cfg.key, { system, user, schema, maxTokens }) : askGemini(cfg.key, { system, user, schema, maxTokens });
}

/** messaggio d'errore comprensibile */
export function aiError(e) {
  if (e?.status === 401 || e?.status === 403) return 'la chiave API non è valida';
  if (e?.status === 429) return 'troppe richieste, riprova tra un minuto';
  if (e?.status === 529 || e?.status === 503) return 'il servizio è momentaneamente occupato';
  if (!navigator.onLine) return 'sei offline';
  return e?.message || 'errore di rete';
}

// ------------------------------------------------------------------
// Ricette con quello che c'è in casa
// ------------------------------------------------------------------

const N = { type: 'number' };
const RICETTE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    ricette: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          titolo: { type: 'string' },
          tempo_min: { type: 'integer' },
          ingredienti: {
            type: 'array',
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                nome: { type: 'string' },
                grammi: N,
                cibo: { type: 'string', enum: [...FOOD_IDS, 'altro'], description: 'alimento della tabella più simile, oppure "altro"' },
                kcal: N, proteine: N, carboidrati: N, grassi: N,
              },
              required: ['nome', 'grammi', 'cibo', 'kcal', 'proteine', 'carboidrati', 'grassi'],
            },
          },
          passi: { type: 'array', items: { type: 'string' } },
          perche: { type: 'string', description: 'una frase: perché questa ricetta va bene per l’obiettivo della persona' },
        },
        required: ['titolo', 'tempo_min', 'ingredienti', 'passi', 'perche'],
      },
    },
  },
  required: ['ricette'],
};

const RICETTE_SYSTEM = `Sei un nutrizionista e cuoco italiano. Crei ricette semplici e gustose con quello che la persona ha in casa.
Regole:
- Usa solo gli ingredienti disponibili, più acqua, sale, pepe, spezie ed erbe aromatiche. Se manca qualcosa di essenziale, non inventarlo.
- Ogni ricetta deve avvicinarsi ai valori del pasto da sostituire: calorie entro ±10%, proteine almeno il 90% dell'obiettivo.
- Rispetta sempre tipo di dieta, intolleranze e cibi esclusi.
- Grammi a crudo per pasta, riso e cereali; legumi già cotti. Valori nutrizionali per gli ingredienti alle grammature indicate.
- Per "cibo" scegli l'alimento della tabella che corrisponde all'ingrediente; usa "altro" solo se non c'è.
- Passi brevi e concreti, in italiano, con tempi di cottura. Al massimo 6 passi.
- Proponi 2 ricette diverse tra loro.`;

/**
 * have: id degli alimenti spuntati · altro: testo libero · pasto: nome del pasto · target: { kcal, protein, carbs?, fat? }
 * p: profilo (dieta, intolleranze, noncibi, cucina, obiettivo)
 */
export async function aiRicette(cfg, { have, altro, pasto, target, p, dietaLabel }) {
  const user = [
    `Pasto: ${pasto}.`,
    `Obiettivo del pasto: circa ${Math.round(target.kcal)} kcal e ${Math.round(target.protein)} g di proteine${target.carbs ? `, ${Math.round(target.carbs)} g di carboidrati, ${Math.round(target.fat)} g di grassi` : ''}.`,
    `Obiettivo della persona: ${p.obiettivo}. Tipo di alimentazione: ${dietaLabel}.`,
    p.intolleranze?.length ? `Intolleranze o allergie: ${p.intolleranze.join(', ')}.` : '',
    p.noncibi?.length ? `Non mangia: ${p.noncibi.join(', ')}.` : '',
    p.cucina === 'poco' ? 'Ha pochissimo tempo per cucinare: massimo 15 minuti.' : '',
    `In casa ha: ${[...have.map(foodLabel), altro].filter(Boolean).join(', ') || 'nulla di specificato'}.`,
  ].filter(Boolean).join('\n');
  const r = await ask(cfg, { system: RICETTE_SYSTEM, user, schema: RICETTE_SCHEMA });
  // i valori degli alimenti in tabella si ricalcolano: così le calorie sono coerenti con il resto del piano
  return r.ricette.map((x) => {
    const items = x.ingredienti.map((i) => {
      const m = i.cibo !== 'altro' ? foodMacros(i.cibo, i.grammi) : null;
      return { name: i.nome, grams: Math.round(i.grammi), label: `${Math.round(i.grammi)} g`, food: i.cibo !== 'altro' ? i.cibo : null, ...(m || { kcal: i.kcal, protein: i.proteine, carbs: i.carboidrati, fat: i.grassi }), stima: !m };
    });
    const sum = (k) => Math.round(items.reduce((a, i) => a + (i[k] || 0), 0));
    return { name: x.titolo, items, passi: x.passi, tempo: x.tempo_min, perche: x.perche, kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'), fonte: 'ai' };
  });
}

// ------------------------------------------------------------------
// Giornata: scegliere tra le opzioni calcolate
// ------------------------------------------------------------------

const GIORNATA_SYSTEM = `Sei un personal trainer che segue a distanza una persona. Oggi ti dice come sta.
Hai davanti la sua settimana e un elenco di opzioni già calcolate dall'app (sono le uniche possibili).
Scegli l'opzione migliore pensando a: costanza nel tempo, recupero, obiettivo, impegni dichiarati.
Rispondi in italiano, in seconda persona, con tono caldo e concreto. Niente diagnosi mediche: con dolori nuovi o forti consiglia il medico.`;

export async function aiGiornata(cfg, { opzioni, settimana, risposte, nota, obiettivo }) {
  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      scelta: { type: 'string', enum: opzioni.map((o) => o.id) },
      perche: { type: 'string', description: '2-3 frasi: perché è la scelta migliore oggi' },
      consiglio: { type: 'string', description: 'un consiglio pratico per oggi (alimentazione, recupero o motivazione)' },
    },
    required: ['scelta', 'perche', 'consiglio'],
  };
  const user = [
    `Obiettivo: ${obiettivo}.`,
    'Settimana:', ...settimana.map((d) => `- ${d}`),
    `Come sta oggi: energia ${risposte.energia}, sonno ${risposte.sonno === 'poco' ? 'scarso' : 'nella norma'}, tempo disponibile ${risposte.tempo} minuti${risposte.dolore ? ', ha un dolore o un fastidio nuovo' : ''}${risposte.impegni?.length ? `, giorni pieni di impegni: ${risposte.impegni.join(', ')}` : ''}.`,
    nota ? `Ha scritto: "${nota}"` : '',
    'Opzioni:', ...opzioni.map((o) => `- ${o.id}: ${o.title}. ${o.text}`),
  ].filter(Boolean).join('\n');
  return ask(cfg, { system: GIORNATA_SYSTEM, user, schema, maxTokens: 2000 });
}
