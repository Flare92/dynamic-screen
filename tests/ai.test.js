import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, aiRicette, aiError, GEMINI_MODEL } from '../js/ai.js';

const cfg = { provider: 'gemini', key: 'AIzaTEST' };
const schema = { type: 'object', additionalProperties: false, properties: { a: { type: 'string' } }, required: ['a'] };
const reply = (obj, status = 200) => ({ ok: status < 300, status, json: async () => obj });
const ok = (data) => reply({ candidates: [{ content: { parts: [{ text: JSON.stringify(data) }] }, finishReason: 'STOP' }] });

function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return responses.shift(); };
  return calls;
}

test('Gemini: richiesta con il modello, la chiave e lo schema JSON', async () => {
  const calls = mockFetch([ok({ a: 'ciao' })]);
  const r = await ask(cfg, { system: 'sys', user: 'u', schema });
  assert.deepEqual(r, { a: 'ciao' });
  assert.match(calls[0].url, new RegExp(`/v1beta/models/${GEMINI_MODEL.replace('.', '\\.')}:generateContent$`));
  assert.equal(GEMINI_MODEL, 'gemini-3.8-flash');
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'AIzaTEST');
  assert.deepEqual(calls[0].body.generationConfig.responseJsonSchema, schema);
  assert.equal(calls[0].body.generationConfig.responseMimeType, 'application/json');
  assert.equal(calls[0].body.systemInstruction.parts[0].text, 'sys');
});

test('Gemini: modello non disponibile → ultimo Flash; schema rifiutato → schema nelle istruzioni', async () => {
  let calls = mockFetch([reply({ error: { message: 'not found' } }, 404), ok({ a: 'x' })]);
  assert.deepEqual(await ask(cfg, { system: 's', user: 'u', schema }), { a: 'x' });
  assert.match(calls[1].url, /gemini-flash-latest/);
  calls = mockFetch([reply({ error: { message: 'Invalid JSON schema' } }, 400), ok({ a: 'y' })]);
  assert.deepEqual(await ask(cfg, { system: 's', user: 'u', schema }), { a: 'y' });
  assert.equal(calls[1].body.generationConfig.responseJsonSchema, undefined);
  assert.match(calls[1].body.systemInstruction.parts[0].text, /JSON Schema/);
});

test('Gemini: chiave non valida e risposte bloccate danno errori comprensibili', async () => {
  mockFetch([reply({ error: { message: 'API key not valid. Please pass a valid API key.' } }, 400)]);
  await assert.rejects(ask(cfg, { system: 's', user: 'u', schema }), (e) => aiError(e) === 'la chiave API non è valida');
  mockFetch([reply({ promptFeedback: { blockReason: 'SAFETY' } })]);
  await assert.rejects(ask(cfg, { system: 's', user: 'u', schema }), /non ha potuto/);
  mockFetch([reply({ candidates: [{ content: { parts: [{ text: '```json\n{"a":"z"}\n```' }] } }] })]);
  assert.deepEqual(await ask(cfg, { system: 's', user: 'u', schema }), { a: 'z' });
});

test('ricette con Gemini: valori ricalcolati sulla tabella per gli alimenti noti', async () => {
  mockFetch([ok({ ricette: [{ titolo: 'Riso e pollo', tempo_min: 20, perche: 'ok', passi: ['a', 'b'], ingredienti: [
    { nome: 'Riso', grammi: 80, cibo: 'riso', kcal: 1, proteine: 1, carboidrati: 1, grassi: 1 },
    { nome: 'Pollo', grammi: 150, cibo: 'pollo', kcal: 1, proteine: 1, carboidrati: 1, grassi: 1 },
    { nome: 'Zucchine', grammi: 200, cibo: 'altro', kcal: 34, proteine: 2.4, carboidrati: 6, grassi: 0.6 },
  ] }] })]);
  const [r] = await aiRicette(cfg, { have: ['riso', 'pollo'], altro: 'zucchine', pasto: 'pranzo', target: { kcal: 600, protein: 40 }, p: { obiettivo: 'tonificare' }, dietaLabel: 'Onnivora' });
  assert.equal(r.kcal, Math.round(350 * 0.8 + 110 * 1.5 + 34));
  assert.equal(r.protein, Math.round(7.5 * 0.8 + 23 * 1.5 + 2.4));
  assert.ok(r.items[2].stima && !r.items[0].stima);
});
