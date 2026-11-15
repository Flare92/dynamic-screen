// Coppia: due persone si scambiano un codice (link) con i soli dati che servono per
// cucinare e allenarsi insieme. Nessun server: il codice viaggia dove lo mandi tu (WhatsApp, email…).
// Non contiene diagnosi né dolori: solo gli esercizi da evitare e il livello per ogni schema motorio.

import { notAllowedIds, derive } from './engine.js';

export const CARD_VERSION = 1;

/**
 * Scheda da condividere.
 * state: stato dell'app · plan: piano della settimana corrente · ctx: contesto del piano (cp, swaps, excluded, exAdj)
 */
export function buildCard(state, plan, ctx, stats = {}) {
  const p = state.profile;
  const d = derive(p, ctx);
  if (!state.coupleId) state.coupleId = Math.random().toString(36).slice(2, 10);
  return {
    v: CARD_VERSION,
    id: state.coupleId,
    nome: p.nome || '',
    o: p.obiettivo,
    dieta: p.dieta || 'onnivora',
    intolleranze: p.intolleranze || [],
    noncibi: p.noncibi || [],
    kcal: plan.nutrition.kcal,
    protein: plan.nutrition.protein,
    pl: d.pl,
    no: notAllowedIds(p, ctx),
    // la settimana: giorno, minuti, luogo, tipo, titolo
    w: plan.schedule.filter((x) => x.session).map((x) => [x.weekday, x.session.minutes, x.session.luogo || '', x.session.kind, x.session.title]),
    s: { done: stats.done || 0, streak: stats.streak || 0, week: stats.week || 0 },
    at: new Date().toISOString().slice(0, 10),
  };
}

// --------- codifica: JSON → compresso → base64url (testo da mettere in un link)
const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const fromB64 = (str) => { const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, (c) => c.charCodeAt(0)); };
async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeCard(card) {
  const raw = new TextEncoder().encode(JSON.stringify(card));
  if (typeof CompressionStream !== 'undefined') return `z${toB64(await pipe(raw, new CompressionStream('deflate-raw')))}`;
  return `j${toB64(raw)}`;
}

export async function decodeCard(code) {
  const c = String(code || '').trim().replace(/^.*[?&]c=/, '').replace(/[^A-Za-z0-9_-]/g, '');
  if (c.length < 10) throw new Error('codice troppo corto');
  const bytes = fromB64(c.slice(1));
  const raw = c[0] === 'z' ? await pipe(bytes, new DecompressionStream('deflate-raw')) : bytes;
  const card = JSON.parse(new TextDecoder().decode(raw));
  if (card.v !== CARD_VERSION || !card.id || !Array.isArray(card.w)) throw new Error('codice non valido');
  return card;
}

export const shareUrl = (code, base) => `${base}#/coppia?c=${code}`;

// --------- cosa si può fare insieme

/** giorni in cui vi allenate entrambi, giorni in cui uno solo si allena */
export function weekTogether(mySchedule, card) {
  const theirs = new Map(card.w.map(([wd, min, luogo, kind, title]) => [wd, { minutes: min, luogo, kind, title }]));
  return mySchedule.map((d) => ({ weekday: d.weekday, label: d.label, me: d.session, them: theirs.get(d.weekday) || null }));
}

/** il giorno migliore per allenarsi insieme: entrambi hanno una sessione di forza, preferibilmente nello stesso luogo */
export function bestTogetherDay(together, from = 0) {
  const both = together.filter((d) => d.weekday >= from && d.me && d.them);
  const score = (d) => (d.me.kind === 'forza' && d.them.kind === 'forza' ? 3 : 0) + (d.me.luogo && d.me.luogo === d.them.luogo ? 2 : 0) + (Math.abs(d.me.minutes - d.them.minutes) <= 15 ? 1 : 0);
  return both.sort((a, b) => score(b) - score(a) || a.weekday - b.weekday)[0] || null;
}
