// Intelligenza artificiale (facoltativa): Claude con la chiave API della persona, chiamato dal browser.
// Ogni funzione ha un'alternativa offline nell'app: l'AI migliora le scelte, non è indispensabile.

import { FOOD_IDS, foodMacros, foodLabel } from './diet.js';

async function ask(apiKey, { system, user, schema, maxTokens = 8000 }) {
  const { Anthropic, betaJSONSchemaOutputFormat } = await import('../vendor/anthropic-sdk.js');
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 90_000 });
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

/** messaggio d'errore comprensibile */
export function aiError(e) {
  if (e?.status === 401) return 'la chiave API non è valida';
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
export async function aiRicette(apiKey, { have, altro, pasto, target, p, dietaLabel }) {
  const user = [
    `Pasto: ${pasto}.`,
    `Obiettivo del pasto: circa ${Math.round(target.kcal)} kcal e ${Math.round(target.protein)} g di proteine${target.carbs ? `, ${Math.round(target.carbs)} g di carboidrati, ${Math.round(target.fat)} g di grassi` : ''}.`,
    `Obiettivo della persona: ${p.obiettivo}. Tipo di alimentazione: ${dietaLabel}.`,
    p.intolleranze?.length ? `Intolleranze o allergie: ${p.intolleranze.join(', ')}.` : '',
    p.noncibi?.length ? `Non mangia: ${p.noncibi.join(', ')}.` : '',
    p.cucina === 'poco' ? 'Ha pochissimo tempo per cucinare: massimo 15 minuti.' : '',
    `In casa ha: ${[...have.map(foodLabel), altro].filter(Boolean).join(', ') || 'nulla di specificato'}.`,
  ].filter(Boolean).join('\n');
  const r = await ask(apiKey, { system: RICETTE_SYSTEM, user, schema: RICETTE_SCHEMA });
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

export async function aiGiornata(apiKey, { opzioni, settimana, risposte, nota, obiettivo }) {
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
  return ask(apiKey, { system: GIORNATA_SYSTEM, user, schema, maxTokens: 2000 });
}
