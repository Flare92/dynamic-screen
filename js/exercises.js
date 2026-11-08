// Database esercizi.
// cat: warmup | strength | cardio | mobility | balance
// pat: schema motorio (solo per strength)
// eq: attrezzi richiesti (basta averne uno)
// lvl: 1 principiante · 2 intermedio · 3 avanzato
// contra: condizioni cliniche per cui l'esercizio viene escluso
// tags: caratteristiche che il profilo può bloccare
//   impatto      salti / corsa
//   supino       sdraiati sulla schiena
//   prono        sdraiati a pancia in giù
//   valsalva     carichi massimali che portano a trattenere il respiro
//   testaGiu     testa più in basso del cuore
//   flessioneCarico  flessione della colonna sotto carico
// unit: reps | sec | min

const E = (id, n, cat, o = {}) => ({
  id, n, cat,
  pat: o.pat || null,
  eq: o.eq || ['corpo'],
  lvl: o.lvl || 1,
  contra: o.contra || [],
  tags: o.tags || [],
  unit: o.unit || (cat === 'strength' ? 'reps' : cat === 'cardio' ? 'min' : 'sec'),
  how: o.how || '',
});

export const EXERCISES = [
  // ---------- RISCALDAMENTO ----------
  E('w_marcia', 'Marcia sul posto con braccia attive', 'warmup', { how: 'Ginocchia verso l’alto, braccia che oscillano. Aumenta pian piano il ritmo.' }),
  E('w_braccia', 'Cerchi con le braccia', 'warmup', { how: 'Cerchi piccoli che diventano grandi, avanti e indietro.' }),
  E('w_busto', 'Rotazioni del busto', 'warmup', { how: 'Piedi alla larghezza delle anche, ruota il busto lasciando le braccia morbide.' }),
  E('w_anche', 'Rotazioni delle anche', 'warmup', { how: 'Mani sui fianchi, disegna cerchi ampi con il bacino in entrambe le direzioni.' }),
  E('w_gatto', 'Gatto-mucca', 'warmup', { how: 'In quadrupedia alterna schiena arrotondata e schiena inarcata seguendo il respiro.' }),
  E('w_step', 'Step-touch laterale', 'warmup', { how: 'Passo laterale e chiusura, prima a destra poi a sinistra, braccia che accompagnano.' }),
  E('w_jj', 'Jumping jack', 'warmup', { tags: ['impatto'], lvl: 2, how: 'Salta aprendo gambe e braccia, atterra morbido sugli avampiedi.' }),
  E('w_squatmob', 'Mezzo squat lento', 'warmup', { how: 'Scendi solo a metà, lentamente, spingendo le ginocchia in fuori.' }),
  E('w_affrot', 'Affondo con rotazione', 'warmup', { lvl: 2, contra: ['ginocchia'], how: 'Affondo in avanti e rotazione del busto verso la gamba davanti.' }),
  E('w_caviglie', 'Mobilità caviglie', 'warmup', { how: 'Piede appoggiato al muro, porta il ginocchio avanti senza staccare il tallone.' }),
  E('w_angeli', 'Angeli al muro', 'warmup', { how: 'Schiena al muro, fai scivolare le braccia su e giù mantenendo il contatto.' }),
  E('w_hinge', 'Piegamenti a busto (hip hinge)', 'warmup', { how: 'Mani sui fianchi, spingi il bacino indietro con la schiena dritta e risali.' }),

  // ---------- FORZA: SQUAT ----------
  E('s_sitstand', 'Alzarsi e sedersi dalla sedia', 'strength', { pat: 'squat', how: 'Siediti appena, senza crollare, e rialzati spingendo dai talloni. Ottimo anche con ginocchia sensibili.' }),
  E('s_squat_talloni', 'Squat con talloni rialzati', 'strength', { pat: 'squat', contra: ['ginocchia'], how: 'Talloni su un libro o un disco (2–3 cm): il busto resta più dritto anche con caviglie rigide.' }),
  E('s_squat', 'Squat a corpo libero', 'strength', { pat: 'squat', contra: ['ginocchia'], how: 'Piedi larghi quanto le spalle, scendi come per sederti, petto alto, ginocchia in linea con le punte.' }),
  E('s_squat_el', 'Squat con elastico', 'strength', { pat: 'squat', eq: ['elastici'], contra: ['ginocchia'], how: 'Elastico sotto i piedi e sulle spalle: stessa tecnica dello squat, salita controllata.' }),
  E('s_legpress', 'Leg press', 'strength', { pat: 'squat', eq: ['palestra'], how: 'Piedi alti sulla pedana; con ginocchia sensibili limita l’escursione a 90°.' }),
  E('s_goblet', 'Goblet squat con manubrio', 'strength', { pat: 'squat', eq: ['manubri'], lvl: 2, contra: ['ginocchia'], how: 'Manubrio al petto, gomiti tra le ginocchia in basso, schiena neutra.' }),
  E('s_wallsit', 'Sedia al muro (wall sit)', 'strength', { pat: 'squat', unit: 'sec', contra: ['ginocchia'], how: 'Schiena al muro, cosce quasi parallele al pavimento. Respira regolarmente, non trattenere il fiato.' }),
  E('s_backsquat', 'Squat con bilanciere', 'strength', { pat: 'squat', eq: ['palestra'], lvl: 3, contra: ['ginocchia', 'schiena'], tags: ['valsalva'], how: 'Bilanciere sui trapezi, core attivo, scendi fino al parallelo con controllo.' }),

  // ---------- FORZA: HINGE (anca) ----------
  E('h_ponte', 'Ponte glutei', 'strength', { pat: 'hinge', tags: ['supino'], how: 'Supino, piedi vicini ai glutei: solleva il bacino stringendo i glutei, pausa di 1 s in alto.' }),
  E('h_ponte1', 'Ponte glutei a una gamba', 'strength', { pat: 'hinge', lvl: 2, tags: ['supino'], how: 'Come il ponte, ma con una gamba tesa in aria. Bacino a livello.' }),
  E('h_hipthrust', 'Hip thrust con manubrio', 'strength', { pat: 'hinge', eq: ['manubri'], lvl: 2, tags: ['supino'], how: 'Scapole sul divano/panca, manubrio sul bacino: spingi in alto fino ad allineare busto e cosce.' }),
  E('h_rdl_el', 'Stacco rumeno con elastico', 'strength', { pat: 'hinge', eq: ['elastici'], contra: ['schiena'], how: 'Elastico sotto i piedi, ginocchia morbide, porta il bacino indietro con schiena piatta.' }),
  E('h_rdl', 'Stacco rumeno con manubri', 'strength', { pat: 'hinge', eq: ['manubri'], lvl: 2, contra: ['schiena'], how: 'Manubri lungo le cosce, scendi fino a metà tibia sentendo i femorali, schiena neutra.' }),
  E('h_superman', 'Superman a terra', 'strength', { pat: 'hinge', contra: ['schiena'], tags: ['prono'], how: 'Prono, solleva insieme braccia e gambe di pochi centimetri, sguardo a terra.' }),
  E('h_stacco', 'Stacco da terra con bilanciere', 'strength', { pat: 'hinge', eq: ['palestra'], lvl: 3, contra: ['schiena'], tags: ['valsalva'], how: 'Bilanciere vicino agli stinchi, spingi il pavimento, schiena neutra dall’inizio alla fine.' }),

  // ---------- FORZA: AFFONDI / MONOPODALICI ----------
  E('l_step', 'Step-up su gradino basso', 'strength', { pat: 'lunge', how: 'Sali su un gradino spingendo dal tallone della gamba d’appoggio, scendi lentamente. Alterna.' }),
  E('l_affind', 'Affondi indietro', 'strength', { pat: 'lunge', lvl: 2, contra: ['ginocchia'], how: 'Passo indietro e scendi con il ginocchio verso terra, busto dritto. Alterna le gambe.' }),
  E('l_laterale', 'Affondo laterale', 'strength', { pat: 'lunge', lvl: 2, contra: ['ginocchia', 'anche'], how: 'Passo largo di lato, siediti sulla gamba piegata, l’altra resta tesa.' }),
  E('l_affman', 'Affondi con manubri', 'strength', { pat: 'lunge', eq: ['manubri'], lvl: 2, contra: ['ginocchia'], how: 'Manubri ai fianchi, affondo indietro controllato, spinta dal tallone davanti.' }),
  E('l_bulgaro', 'Split squat bulgaro', 'strength', { pat: 'lunge', lvl: 3, contra: ['ginocchia', 'anche'], how: 'Piede posteriore su una sedia, scendi in verticale con il busto leggermente inclinato.' }),

  // ---------- FORZA: GLUTEI / ANCHE ----------
  E('g_clam', 'Conchiglia (clamshell)', 'strength', { pat: 'glutei', how: 'Su un fianco, ginocchia piegate: apri il ginocchio superiore tenendo i piedi uniti.' }),
  E('g_abd_el', 'Passi laterali con elastico', 'strength', { pat: 'glutei', eq: ['elastici'], how: 'Elastico sopra le ginocchia, mezzo squat, passi laterali senza far cedere le ginocchia.' }),
  E('g_kick', 'Slanci posteriori in quadrupedia', 'strength', { pat: 'glutei', how: 'In quadrupedia spingi un tallone verso il soffitto senza inarcare la schiena.' }),

  // ---------- FORZA: SPINTA ORIZZONTALE ----------
  E('p_muro', 'Piegamenti al muro', 'strength', { pat: 'push_h', how: 'Mani al muro all’altezza delle spalle, corpo dritto, porta il petto verso il muro.' }),
  E('p_rialzo', 'Piegamenti su rialzo (tavolo/divano)', 'strength', { pat: 'push_h', how: 'Mani su un appoggio stabile: più è basso, più è difficile. Corpo come una tavola.' }),
  E('p_ginocchia', 'Piegamenti sulle ginocchia', 'strength', { pat: 'push_h', how: 'Ginocchia a terra, corpo dritto dalle spalle alle ginocchia, petto verso il pavimento.' }),
  E('p_el', 'Chest press con elastico', 'strength', { pat: 'push_h', eq: ['elastici'], how: 'Elastico dietro la schiena, spingi in avanti fino a braccia tese, ritorno lento.' }),
  E('p_floor', 'Distensioni a terra con manubri', 'strength', { pat: 'push_h', eq: ['manubri'], tags: ['supino'], how: 'Supino, gomiti a 45°: spingi i manubri verso l’alto, i gomiti toccano appena il pavimento.' }),
  E('p_machine', 'Chest press alla macchina', 'strength', { pat: 'push_h', eq: ['palestra'], how: 'Regola il sedile: maniglie all’altezza del petto, spinta senza bloccare i gomiti.' }),
  E('p_classici', 'Piegamenti classici', 'strength', { pat: 'push_h', lvl: 2, contra: ['spalle'], how: 'Mani sotto le spalle, corpo rigido, petto quasi a terra. Se servono, appoggia le ginocchia.' }),
  E('p_panca_man', 'Panca con manubri', 'strength', { pat: 'push_h', eq: ['palestra'], lvl: 2, tags: ['supino'], how: 'Scapole addotte, scendi fino all’altezza del petto, spinta controllata.' }),
  E('p_dip', 'Dip alla sedia', 'strength', { pat: 'push_h', lvl: 2, contra: ['spalle'], how: 'Mani sul bordo di una sedia stabile, piega i gomiti fino a 90° e risali.' }),
  E('p_panca', 'Panca piana con bilanciere', 'strength', { pat: 'push_h', eq: ['palestra'], lvl: 3, contra: ['spalle'], tags: ['supino', 'valsalva'], how: 'Piedi a terra, scapole strette, bilanciere al petto e spinta. Usa sempre un assistente.' }),

  // ---------- FORZA: SPINTA VERTICALE ----------
  E('v_wallslide', 'Scivolamenti al muro con braccia alte', 'strength', { pat: 'push_v', how: 'Avambracci al muro, fai scivolare le braccia verso l’alto spingendo leggermente nel muro.' }),
  E('v_el', 'Shoulder press con elastico', 'strength', { pat: 'push_v', eq: ['elastici'], contra: ['spalle'], how: 'Elastico sotto i piedi, spingi le mani sopra la testa senza inarcare la schiena.' }),
  E('v_alzate', 'Alzate laterali con manubri', 'strength', { pat: 'push_v', eq: ['manubri'], contra: ['spalle'], how: 'Carico leggero, solleva le braccia di lato fino all’altezza delle spalle.' }),
  E('v_lento', 'Lento avanti con manubri', 'strength', { pat: 'push_v', eq: ['manubri'], lvl: 2, contra: ['spalle'], how: 'Seduto o in piedi, manubri all’altezza delle spalle, spingi sopra la testa.' }),
  E('v_pike', 'Pike push-up', 'strength', { pat: 'push_v', lvl: 3, contra: ['spalle'], tags: ['testaGiu'], how: 'A V rovesciata, porta la testa verso terra tra le mani e spingi indietro.' }),

  // ---------- FORZA: TIRATA ORIZZONTALE ----------
  E('r_towel', 'Rematore isometrico con asciugamano', 'strength', { pat: 'pull_h', unit: 'sec', how: 'Asciugamano attorno a un palo o alla maniglia di una porta chiusa: tira stringendo le scapole.' }),
  E('r_ytw', 'Y-T-W a terra', 'strength', { pat: 'pull_h', tags: ['prono'], how: 'Prono, solleva le braccia formando Y, poi T, poi W, stringendo le scapole.' }),
  E('r_el', 'Rematore con elastico', 'strength', { pat: 'pull_h', eq: ['elastici'], how: 'Elastico fissato davanti a te, tira i gomiti indietro vicino al corpo, scapole strette.' }),
  E('r_man', 'Rematore con manubrio', 'strength', { pat: 'pull_h', eq: ['manubri'], how: 'Una mano e un ginocchio sul divano/panca, tira il manubrio verso l’anca.' }),
  E('r_pulley', 'Pulley basso', 'strength', { pat: 'pull_h', eq: ['palestra'], how: 'Busto fermo e dritto, tira la maniglia all’ombelico, ritorno lento.' }),
  E('r_tavolo', 'Rematore inverso sotto un tavolo', 'strength', { pat: 'pull_h', lvl: 2, tags: ['supino'], how: 'Sotto un tavolo molto robusto, afferra il bordo e tira il petto verso il piano.' }),
  E('r_bil', 'Rematore con bilanciere', 'strength', { pat: 'pull_h', eq: ['palestra'], lvl: 3, contra: ['schiena'], how: 'Busto inclinato a 45°, schiena neutra, tira il bilanciere all’ombelico.' }),

  // ---------- FORZA: TIRATA VERTICALE ----------
  E('t_lat_el', 'Lat pulldown con elastico', 'strength', { pat: 'pull_v', eq: ['elastici'], how: 'Elastico fissato in alto, tira verso il petto portando i gomiti ai fianchi.' }),
  E('t_lat', 'Lat machine', 'strength', { pat: 'pull_v', eq: ['palestra'], how: 'Presa poco più larga delle spalle, tira la barra al petto senza dondolare.' }),
  E('t_neg', 'Trazioni negative o assistite', 'strength', { pat: 'pull_v', eq: ['sbarra', 'palestra'], lvl: 2, contra: ['spalle'], how: 'Parti dall’alto (salto o sedia) e scendi in 3–5 secondi. Oppure usa un elastico di assistenza.' }),
  E('t_trazioni', 'Trazioni alla sbarra', 'strength', { pat: 'pull_v', eq: ['sbarra', 'palestra'], lvl: 3, contra: ['spalle'], how: 'Presa prona, porta il mento sopra la sbarra, discesa controllata.' }),

  // ---------- FORZA: CORE ----------
  E('c_birddog', 'Bird dog', 'strength', { pat: 'core', how: 'In quadrupedia allunga braccio e gamba opposti, bacino fermo. Alterna.' }),
  E('c_deadbug', 'Dead bug', 'strength', { pat: 'core', tags: ['supino'], how: 'Supino, braccia e ginocchia in alto: allunga braccio e gamba opposti con la schiena a terra.' }),
  E('c_curlup', 'Curl-up di McGill', 'strength', { pat: 'core', tags: ['supino'], how: 'Supino, una gamba piegata, mani sotto la zona lombare: solleva di pochi cm testa e spalle come un blocco unico.' }),
  E('c_plank_g', 'Plank sulle ginocchia', 'strength', { pat: 'core', unit: 'sec', how: 'Avambracci e ginocchia a terra, linea dritta spalle-ginocchia. Respira.' }),
  E('c_pallof', 'Pallof press con elastico', 'strength', { pat: 'core', eq: ['elastici', 'palestra'], how: 'Elastico di lato, spingi le mani in avanti resistendo alla rotazione.' }),
  E('c_farmer', 'Camminata del contadino', 'strength', { pat: 'core', eq: ['manubri', 'palestra'], unit: 'sec', how: 'Un manubrio pesante per mano, cammina dritto con spalle basse e passo regolare.' }),
  E('c_plank', 'Plank', 'strength', { pat: 'core', unit: 'sec', lvl: 2, how: 'Avambracci e punte dei piedi, glutei stretti, corpo in linea. Non trattenere il respiro.' }),
  E('c_side', 'Plank laterale', 'strength', { pat: 'core', unit: 'sec', lvl: 2, contra: ['spalle'], how: 'Su un avambraccio, bacino alto. Fai entrambi i lati.' }),
  E('c_crunch', 'Crunch', 'strength', { pat: 'core', contra: ['schiena'], tags: ['supino', 'flessioneCarico'], how: 'Supino, solleva solo le scapole da terra, mento lontano dal petto.' }),
  E('c_hollow', 'Hollow hold', 'strength', { pat: 'core', unit: 'sec', lvl: 3, contra: ['schiena'], tags: ['supino'], how: 'Supino, schiena incollata a terra, braccia e gambe tese sollevate.' }),

  // ---------- FORZA: POLPACCI ----------
  E('k_calf', 'Sollevamenti sui polpacci', 'strength', { pat: 'calf', how: 'Sali sulle punte lentamente, pausa in alto, scendi in 2 secondi. Appoggiati se serve.' }),

  // ---------- CARDIO ----------
  E('x_cammino', 'Camminata veloce', 'cardio', { how: 'Passo svelto, braccia attive. All’aperto o sul posto/tapis.' }),
  E('x_basso', 'Cardio a basso impatto a corpo libero', 'cardio', { how: 'Alterna 1 minuto ciascuno: marcia con ginocchia alte, step-touch, pugni in avanti, talloni ai glutei camminati.' }),
  E('x_salita', 'Camminata in salita / tapis inclinato', 'cardio', { eq: ['tapis', 'palestra'], how: 'Pendenza 5–10%, non tenerti alle maniglie.' }),
  E('x_bici', 'Cyclette o bici', 'cardio', { eq: ['bici', 'palestra'], how: 'Sella all’altezza dell’anca, cadenza 80–90 pedalate al minuto.' }),
  E('x_ellittica', 'Ellittica', 'cardio', { eq: ['palestra'], how: 'Movimento fluido, schiena dritta, usa anche le braccia.' }),
  E('x_nuoto', 'Nuoto', 'cardio', { eq: ['piscina'], how: 'Stile libero o dorso a ritmo regolare; pause brevi a bordo vasca se servono.' }),
  E('x_vogatore', 'Vogatore', 'cardio', { eq: ['palestra'], lvl: 2, contra: ['schiena'], how: 'Spinta prima di gambe, poi busto, poi braccia. Schiena neutra.' }),
  E('x_corsa', 'Corsa', 'cardio', { lvl: 1, tags: ['impatto'], how: 'Passo corto, atterraggio sotto il corpo, respiro regolare.' }),
  E('x_corda', 'Salto della corda', 'cardio', { eq: ['corda'], lvl: 2, tags: ['impatto'], how: 'Salti bassi sugli avampiedi, polsi che girano la corda.' }),

  // ---------- MOBILITÀ / DEFATICAMENTO ----------
  E('m_flessori', 'Allungamento flessori dell’anca', 'mobility', { how: 'In affondo con il ginocchio dietro a terra (su un cuscino), spingi il bacino in avanti. Per lato.' }),
  E('m_femorali', 'Allungamento femorali da seduto', 'mobility', { how: 'Seduto, una gamba tesa: inclinati in avanti con la schiena lunga. Per lato.' }),
  E('m_quad', 'Allungamento quadricipiti in piedi', 'mobility', { how: 'Afferra la caviglia e porta il tallone al gluteo, ginocchia vicine. Appoggiati al muro.' }),
  E('m_pett', 'Allungamento pettorali al muro', 'mobility', { how: 'Avambraccio sul muro a 90°, ruota il busto dalla parte opposta. Per lato.' }),
  E('m_polpacci', 'Allungamento polpacci al muro', 'mobility', { how: 'Mani al muro, una gamba indietro tesa con il tallone a terra. Per lato.' }),
  E('m_collo', 'Mobilità collo e spalle', 'mobility', { how: 'Inclina lentamente la testa ai lati e ruota le spalle all’indietro.' }),
  E('m_gatto', 'Gatto-mucca lento', 'mobility', { how: 'In quadrupedia, muovi una vertebra alla volta seguendo il respiro.' }),
  E('m_bambino', 'Posizione del bambino', 'mobility', { how: 'Seduto sui talloni, braccia avanti e fronte verso terra. Ginocchia larghe se serve.' }),
  E('m_openbook', 'Rotazione toracica (open book)', 'mobility', { how: 'Su un fianco, ginocchia piegate: apri il braccio superiore come un libro seguendolo con lo sguardo.' }),
  E('m_9090', 'Rotazioni d’anca 90/90', 'mobility', { lvl: 2, how: 'Seduto con entrambe le ginocchia a 90°, ruota le gambe da un lato all’altro.' }),
  E('m_figura4', 'Allungamento glutei (figura 4)', 'mobility', { tags: ['supino'], how: 'Supino, caviglia sul ginocchio opposto, avvicina le gambe al petto. Per lato.' }),
  E('m_cobra', 'Cobra dolce', 'mobility', { tags: ['prono'], how: 'Prono, appoggiati sugli avambracci e lascia che la schiena si estenda senza forzare.' }),
  E('m_respiro', 'Respirazione diaframmatica', 'mobility', { how: 'Inspira dal naso per 4 secondi gonfiando la pancia, espira dalla bocca per 6 secondi.' }),

  // ---------- EQUILIBRIO ----------
  E('b_unagamba', 'Equilibrio su una gamba', 'balance', { how: 'Vicino a un appoggio, resta su un piede. Quando è facile, chiudi gli occhi. Per lato.' }),
  E('b_tandem', 'Camminata tallone-punta', 'balance', { how: 'Cammina in linea retta mettendo il tallone davanti alla punta dell’altro piede.' }),
];

export const BY_ID = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));
