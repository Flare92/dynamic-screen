// Intelligenza artificiale (facoltativa), chiamata dal browser con la chiave della persona:
// - Gemini 3.8 Flash (Google): ha un piano gratuito, chiave da Google AI Studio;
// - Claude (Anthropic): a pagamento, chiave da console.anthropic.com.
// Ogni funzione ha un'alternativa offline nell'app: l'AI migliora le scelte, non è indispensabile.

import { FOOD_IDS, foodMacros, foodLabel } from './diet.js';

export const PROVIDERS = {
  gemini: { label: 'Gemini 3.8 Flash', by: 'Google', free: true, keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'Incolla qui la chiave', keyRe: /^\S{20,}$/ },
  claude: { label: 'Claude', by: 'Anthropic', free: false, keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'Incolla qui la chiave (sk-ant-…)', keyRe: /^\S{20,}$/ },
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
// se un modello non è disponibile o non è nel piano gratuito della chiave, si prova il successivo
export const GEMINI_MODELS = [GEMINI_MODEL, 'gemini-flash-latest', 'gemini-flash-lite-latest'];
const MODEL_STORE = 'ritmo.geminimodel';
const TIMEOUT = 120_000;

/** il modello che ha risposto l'ultima volta (per mostrarlo e per partire da quello) */
export const geminiModelInUse = () => ls(MODEL_STORE) || GEMINI_MODEL;

async function callGemini(key, model, { system, user, schema }, strict) {
  const generationConfig = { responseMimeType: 'application/json' };
  if (strict) generationConfig.responseJsonSchema = schema;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        // senza vincolo di schema, lo schema va nelle istruzioni
        systemInstruction: { parts: [{ text: strict ? system : `${system}\n\nRispondi solo con un oggetto JSON valido conforme a questo JSON Schema:\n${JSON.stringify(schema)}` }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig,
      }),
    });
    const data = await res.json().catch(() => ({}));
    return { res, data };
  } catch (e) {
    if (e?.name === 'AbortError') { const err = new Error('nessuna risposta dopo 2 minuti'); err.status = 'timeout'; throw err; }
    const err = new Error(`connessione non riuscita (${e?.message || 'rete'})`); err.status = 'rete'; throw err;
  } finally { clearTimeout(timer); }
}

async function askGemini(key, req) {
  const remembered = ls(MODEL_STORE);
  const models = [...new Set([remembered, ...GEMINI_MODELS].filter(Boolean))];
  let last = null;
  for (const model of models) {
    let strict = true;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { res, data } = await callGemini(key, model, req, strict);
      const msg = data?.error?.message || '';
      if (res.ok) {
        if (data.promptFeedback?.blockReason) throw new Error('Gemini non ha potuto rispondere a questa richiesta.');
        const cand = data.candidates?.[0];
        const text = (cand?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
        if (!text) { last = Object.assign(new Error(cand?.finishReason === 'MAX_TOKENS' ? 'risposta incompleta' : `nessun testo (${cand?.finishReason || 'senza motivo'})`), { status: 'vuota' }); break; }
        try {
          const out = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
          ls(MODEL_STORE, model);
          return out;
        } catch { last = Object.assign(new Error('risposta non leggibile'), { status: 'json' }); if (strict) { strict = false; continue; } break; }
      }
      // chiave non valida: inutile provare altri modelli
      if (/API key|API_KEY/i.test(msg) || res.status === 401) throw Object.assign(new Error(msg || 'chiave non valida'), { status: 401 });
      if (res.status === 403) throw Object.assign(new Error(msg || 'accesso negato'), { status: 403 });
      // schema non accettato: riprova con lo schema nelle istruzioni
      if (res.status === 400 && strict) { strict = false; continue; }
      last = Object.assign(new Error(msg || `errore ${res.status}`), { status: res.status, model });
      break; // 404 (modello non disponibile), 429 (quota), 5xx: prova il modello successivo
    }
  }
  throw last || new Error('Gemini non ha risposto');
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
  // Gemini: nessun limite di lunghezza, perché anche il ragionamento interno conta nei token di uscita
  return cfg.provider === 'claude' ? askClaude(cfg.key, { system, user, schema, maxTokens }) : askGemini(cfg.key, { system, user, schema });
}

/** messaggio d'errore comprensibile */
export function aiError(e) {
  const det = e?.message ? `: ${e.message.slice(0, 160)}` : '';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'sei offline';
  if (e?.status === 401) return 'la chiave API non è valida';
  if (e?.status === 403) return `la chiave non ha accesso a Gemini${det}`;
  if (e?.status === 429) return /quota|limit/i.test(e?.message || '') ? `quota gratuita esaurita o non disponibile${det}` : 'troppe richieste, riprova tra un minuto';
  if (e?.status === 529 || e?.status === 503) return 'il servizio è momentaneamente occupato';
  return e?.message || 'errore di rete';
}

/** prova veloce del motore scelto: { ok, secondi, modello, errore } */
export async function testAI(cfg) {
  const t = Date.now();
  try {
    const r = await ask(cfg, { system: 'Rispondi in italiano.', user: 'Rispondi con la parola "pronto".', schema: { type: 'object', properties: { risposta: { type: 'string' } }, required: ['risposta'] }, maxTokens: 200 });
    return { ok: true, secondi: Math.round((Date.now() - t) / 100) / 10, modello: cfg.provider === 'gemini' ? geminiModelInUse() : 'claude-opus-5-5', risposta: r.risposta };
  } catch (e) {
    return { ok: false, secondi: Math.round((Date.now() - t) / 100) / 10, errore: aiError(e), codice: e?.status };
  }
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
