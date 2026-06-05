/* ============================================================
   Adventure Creator — Editor JS
   ============================================================ */

// ─── Stato globale ───────────────────────────────────────────

let avventura = {
  meta: {
    titolo: '',
    autore: '',
    intro: '',
    stanza_iniziale: '',
    testo_vittoria: '',
    testo_sconfitta: '',
  },
  stanze: {},
  oggetti: {},
  personaggi: {},
  azioni: {},
  flags: {},
};

// Stato delle modali
let modalCtx = {};

// ─── Utility ─────────────────────────────────────────────────

function genId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 8);
}

function slugify(str) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), duration);
}

function getAdventureId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || 'default';
}

function caricaLocalStorage() {
  const id = getAdventureId();
  const raw = localStorage.getItem('adventure_' + id);
  if (raw) {
    try { avventura = JSON.parse(raw); return true; } catch(e) {}
  }
  return false;
}

function salvaLocalStorage() {
  const id = getAdventureId();
  localStorage.setItem('adventure_' + id, JSON.stringify(avventura));
  // aggiorna metadati nell'index
  let index = JSON.parse(localStorage.getItem('adventures_index') || '[]');
  const i = index.findIndex(a => a.id === id);
  const meta = { id, titolo: avventura.meta?.titolo || 'Senza titolo', autore: avventura.meta?.autore || '', aggiornatoIl: new Date().toISOString() };
  if (i >= 0) index[i] = meta; else index.push(meta);
  localStorage.setItem('adventures_index', JSON.stringify(index));
}

// ─── Navigazione sezioni ─────────────────────────────────────

function mostraSezione(nome) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + nome).classList.add('active');
  document.querySelector(`.nav-btn[data-section="${nome}"]`).classList.add('active');
  renderSezione(nome);
}

function renderSezione(nome) {
  if (nome === 'impostazioni') renderImpostazioni();
  if (nome === 'stanze') renderStanze();
  if (nome === 'oggetti') renderOggetti();
  if (nome === 'personaggi') renderPersonaggi();
  if (nome === 'azioni') renderAzioniGlobali();
  if (nome === 'flags') renderFlags();
}

// ─── Impostazioni ─────────────────────────────────────────────

function renderImpostazioni() {
  document.getElementById('meta-titolo').value = avventura.meta.titolo || '';
  document.getElementById('meta-autore').value = avventura.meta.autore || '';
  document.getElementById('meta-intro').value = avventura.meta.intro || '';
  document.getElementById('meta-vittoria').value = avventura.meta.testo_vittoria || '';
  document.getElementById('meta-sconfitta').value = avventura.meta.testo_sconfitta || '';
  popolaSelectStanze('meta-stanza-iniziale', avventura.meta.stanza_iniziale);
}

function bindImpostazioni() {
  ['meta-titolo','meta-autore','meta-intro','meta-vittoria','meta-sconfitta'].forEach(id => {
    document.getElementById(id).addEventListener('input', leggiImpostazioni);
  });
  document.getElementById('meta-stanza-iniziale').addEventListener('change', leggiImpostazioni);
}

function leggiImpostazioni() {
  avventura.meta.titolo = document.getElementById('meta-titolo').value;
  avventura.meta.autore = document.getElementById('meta-autore').value;
  avventura.meta.intro = document.getElementById('meta-intro').value;
  avventura.meta.testo_vittoria = document.getElementById('meta-vittoria').value;
  avventura.meta.testo_sconfitta = document.getElementById('meta-sconfitta').value;
  avventura.meta.stanza_iniziale = document.getElementById('meta-stanza-iniziale').value;
  salvaLocalStorage();
}

// ─── Select helper ────────────────────────────────────────────

function popolaSelectStanze(selectId, valoreSelezionato) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— seleziona stanza —</option>';
  Object.values(avventura.stanze).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nome || s.id;
    if (s.id === valoreSelezionato) opt.selected = true;
    sel.appendChild(opt);
  });
}

function popolaSelectOggetti(selectId, valoreSelezionato) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— seleziona oggetto —</option>';
  Object.values(avventura.oggetti).forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.id;
    opt.textContent = o.nome || o.id;
    if (o.id === valoreSelezionato) opt.selected = true;
    sel.appendChild(opt);
  });
}

// ─── STANZE ──────────────────────────────────────────────────

function renderStanze() {
  const cont = document.getElementById('stanze-container');
  cont.innerHTML = '';
  Object.values(avventura.stanze).forEach(s => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${s.nome || '(senza nome)'}</h3>
      <div class="card-id">${s.id}</div>
      <div class="card-desc">${s.descrizione || ''}</div>`;
    card.addEventListener('click', () => apriModaleStanza(s.id));
    cont.appendChild(card);
  });
}

function apriModaleStanza(id) {
  const stanza = id ? avventura.stanze[id] : {
    id: '', nome: '', descrizione: '', descrizione_ritorno: '',
    uscite: { nord: null, sud: null, est: null, ovest: null },
    uscite_condizionali: [],
    oggetti: [], personaggi: [], azioni: [],
  };

  modalCtx.stanzaId = id || null;
  modalCtx.stanzaAzioni = stanza.azioni ? [...stanza.azioni] : [];
  modalCtx.stanzaOggetti = stanza.oggetti ? [...stanza.oggetti] : [];
  modalCtx.stanzaPersonaggi = stanza.personaggi ? [...stanza.personaggi] : [];

  document.getElementById('modal-stanza-title').textContent = id ? 'Modifica stanza' : 'Nuova stanza';
  document.getElementById('stanza-id').value = stanza.id;
  document.getElementById('stanza-id').disabled = !!id;
  document.getElementById('stanza-nome').value = stanza.nome;
  document.getElementById('stanza-descrizione').value = stanza.descrizione;
  document.getElementById('stanza-descrizione-ritorno').value = stanza.descrizione_ritorno || '';

  // Uscite
  ['nord','sud','est','ovest'].forEach(dir => {
    popolaSelectStanze('uscita-' + dir, stanza.uscite?.[dir] || '');
  });

  renderTagList('stanza-oggetti-list', modalCtx.stanzaOggetti, avventura.oggetti);
  renderTagList('stanza-personaggi-list', modalCtx.stanzaPersonaggi, avventura.personaggi);
  renderAzioniList('stanza-azioni-list', modalCtx.stanzaAzioni);

  document.getElementById('btn-elimina-stanza').style.display = id ? '' : 'none';
  apriModale('modal-stanza');
}

function renderTagList(containerId, ids, catalogo) {
  const cont = document.getElementById(containerId);
  cont.innerHTML = '';
  ids.forEach(id => {
    const nome = catalogo[id]?.nome || id;
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = `${nome} <span class="tag-remove" data-id="${id}">×</span>`;
    tag.querySelector('.tag-remove').addEventListener('click', () => {
      const arr = ids;
      arr.splice(arr.indexOf(id), 1);
      renderTagList(containerId, ids, catalogo);
    });
    cont.appendChild(tag);
  });
}

function salvaSzanza() {
  const idNuovo = document.getElementById('stanza-id').value.trim();
  const idVecchio = modalCtx.stanzaId;

  if (!idNuovo) { toast('Inserisci un ID per la stanza'); return; }

  const stanza = {
    id: idNuovo,
    nome: document.getElementById('stanza-nome').value.trim(),
    descrizione: document.getElementById('stanza-descrizione').value.trim(),
    descrizione_ritorno: document.getElementById('stanza-descrizione-ritorno').value.trim(),
    uscite: {
      nord: document.getElementById('uscita-nord').value || null,
      sud: document.getElementById('uscita-sud').value || null,
      est: document.getElementById('uscita-est').value || null,
      ovest: document.getElementById('uscita-ovest').value || null,
    },
    uscite_condizionali: avventura.stanze[idVecchio]?.uscite_condizionali || [],
    oggetti: modalCtx.stanzaOggetti,
    personaggi: modalCtx.stanzaPersonaggi,
    azioni: modalCtx.stanzaAzioni,
  };

  if (idVecchio && idVecchio !== idNuovo) delete avventura.stanze[idVecchio];
  avventura.stanze[idNuovo] = stanza;
  salvaLocalStorage();
  chiudiModali();
  renderStanze();
  toast('Stanza salvata');
}

function eliminaStanza() {
  const id = modalCtx.stanzaId;
  if (!id) return;
  if (!confirm(`Eliminare la stanza "${id}"?`)) return;
  delete avventura.stanze[id];
  salvaLocalStorage();
  chiudiModali();
  renderStanze();
  toast('Stanza eliminata');
}

// ─── OGGETTI ──────────────────────────────────────────────────

function renderOggetti() {
  const cont = document.getElementById('oggetti-container');
  cont.innerHTML = '';
  Object.values(avventura.oggetti).forEach(o => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${o.nome || '(senza nome)'}</h3>
      <div class="card-id">${o.id}</div>
      <div class="card-desc">${o.descrizione || ''}</div>`;
    card.addEventListener('click', () => apriModaleOggetto(o.id));
    cont.appendChild(card);
  });
}

function apriModaleOggetto(id) {
  const obj = id ? avventura.oggetti[id] : { id:'', nome:'', sinonimi:[], descrizione:'', raccoglibile:false, visibile:true };
  modalCtx.oggettoId = id || null;

  document.getElementById('modal-oggetto-title').textContent = id ? 'Modifica oggetto' : 'Nuovo oggetto';
  document.getElementById('oggetto-id').value = obj.id;
  document.getElementById('oggetto-id').disabled = !!id;
  document.getElementById('oggetto-nome').value = obj.nome;
  document.getElementById('oggetto-sinonimi').value = (obj.sinonimi || []).join(', ');
  document.getElementById('oggetto-descrizione').value = obj.descrizione;
  document.getElementById('oggetto-raccoglibile').checked = obj.raccoglibile;
  document.getElementById('oggetto-visibile').checked = obj.visibile !== false;

  document.getElementById('btn-elimina-oggetto').style.display = id ? '' : 'none';
  apriModale('modal-oggetto');
}

function salvaOggetto() {
  const idNuovo = document.getElementById('oggetto-id').value.trim();
  if (!idNuovo) { toast('Inserisci un ID per l\'oggetto'); return; }

  const obj = {
    id: idNuovo,
    nome: document.getElementById('oggetto-nome').value.trim(),
    sinonimi: document.getElementById('oggetto-sinonimi').value.split(',').map(s => s.trim()).filter(Boolean),
    descrizione: document.getElementById('oggetto-descrizione').value.trim(),
    raccoglibile: document.getElementById('oggetto-raccoglibile').checked,
    visibile: document.getElementById('oggetto-visibile').checked,
  };

  const idVecchio = modalCtx.oggettoId;
  if (idVecchio && idVecchio !== idNuovo) delete avventura.oggetti[idVecchio];
  avventura.oggetti[idNuovo] = obj;
  salvaLocalStorage();
  chiudiModali();
  renderOggetti();
  toast('Oggetto salvato');
}

function eliminaOggetto() {
  const id = modalCtx.oggettoId;
  if (!id || !confirm(`Eliminare l'oggetto "${id}"?`)) return;
  delete avventura.oggetti[id];
  salvaLocalStorage();
  chiudiModali();
  renderOggetti();
  toast('Oggetto eliminato');
}

// ─── PERSONAGGI ───────────────────────────────────────────────

function renderPersonaggi() {
  const cont = document.getElementById('personaggi-container');
  cont.innerHTML = '';
  Object.values(avventura.personaggi).forEach(p => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<h3>${p.nome || '(senza nome)'}</h3>
      <div class="card-id">${p.id}</div>
      <div class="card-desc">${p.descrizione || ''}</div>`;
    card.addEventListener('click', () => apriModalePersonaggio(p.id));
    cont.appendChild(card);
  });
}

function apriModalePersonaggio(id) {
  const p = id ? avventura.personaggi[id] : { id:'', nome:'', sinonimi:[], descrizione:'', dialogo_default:'' };
  modalCtx.personaggioId = id || null;

  document.getElementById('modal-personaggio-title').textContent = id ? 'Modifica personaggio' : 'Nuovo personaggio';
  document.getElementById('personaggio-id').value = p.id;
  document.getElementById('personaggio-id').disabled = !!id;
  document.getElementById('personaggio-nome').value = p.nome;
  document.getElementById('personaggio-sinonimi').value = (p.sinonimi || []).join(', ');
  document.getElementById('personaggio-descrizione').value = p.descrizione;
  document.getElementById('personaggio-dialogo').value = p.dialogo_default || '';

  document.getElementById('btn-elimina-personaggio').style.display = id ? '' : 'none';
  apriModale('modal-personaggio');
}

function salvaPersonaggio() {
  const idNuovo = document.getElementById('personaggio-id').value.trim();
  if (!idNuovo) { toast('Inserisci un ID per il personaggio'); return; }

  const p = {
    id: idNuovo,
    nome: document.getElementById('personaggio-nome').value.trim(),
    sinonimi: document.getElementById('personaggio-sinonimi').value.split(',').map(s => s.trim()).filter(Boolean),
    descrizione: document.getElementById('personaggio-descrizione').value.trim(),
    dialogo_default: document.getElementById('personaggio-dialogo').value.trim(),
  };

  const idVecchio = modalCtx.personaggioId;
  if (idVecchio && idVecchio !== idNuovo) delete avventura.personaggi[idVecchio];
  avventura.personaggi[idNuovo] = p;
  salvaLocalStorage();
  chiudiModali();
  renderPersonaggi();
  toast('Personaggio salvato');
}

function eliminaPersonaggio() {
  const id = modalCtx.personaggioId;
  if (!id || !confirm(`Eliminare il personaggio "${id}"?`)) return;
  delete avventura.personaggi[id];
  salvaLocalStorage();
  chiudiModali();
  renderPersonaggi();
  toast('Personaggio eliminato');
}

// ─── AZIONI ───────────────────────────────────────────────────

function renderAzioniGlobali() {
  renderAzioniList('azioni-container', Object.keys(avventura.azioni).filter(id => avventura.azioni[id].stanza === null));
}

function renderAzioniList(containerId, azioneIds) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = '';
  azioneIds.forEach(id => {
    const a = avventura.azioni[id];
    if (!a) return;
    const row = document.createElement('div');
    row.className = 'action-row';
    const nCond = (a.condizioni || []).length;
    row.innerHTML = `
      <div class="action-label">
        <span class="action-verb">${a.verbo}</span>
        <span class="action-target"> ${a.target || ''}</span>
      </div>
      <span class="action-conditions">${nCond} condiz. · ${(a.effetti||[]).length} effetti</span>
      <span>›</span>`;
    row.addEventListener('click', () => apriModaleAzione(id));
    cont.appendChild(row);
  });
}

function apriModaleAzione(id, stanzaId) {
  const azione = id ? avventura.azioni[id] : {
    id: genId('azione'), verbo: 'PRENDI', target: '', sinonimi_target: [],
    stanza: stanzaId || null, condizioni: [], effetti: [], priorita: 0,
  };

  modalCtx.azioneId = id || null;
  modalCtx.azioneStanzaId = stanzaId || azione.stanza;

  document.getElementById('azione-verbo').value = azione.verbo;
  document.getElementById('azione-target').value = azione.target;
  document.getElementById('azione-sinonimi').value = (azione.sinonimi_target || []).join(', ');
  document.getElementById('azione-priorita').value = azione.priorita || 0;

  renderCondizioniEditor(azione.condizioni || []);
  renderEffettiEditor(azione.effetti || []);

  document.getElementById('btn-elimina-azione').style.display = id ? '' : 'none';
  apriModale('modal-azione');
}

// ─── Condizioni editor ────────────────────────────────────────

const TIPI_CONDIZIONE = [
  { value: 'ha_oggetto',    label: 'Hai in inventario' },
  { value: 'non_ha_oggetto',label: 'Non hai in inventario' },
  { value: 'flag_vero',     label: 'Flag è VERO' },
  { value: 'flag_falso',    label: 'Flag è FALSO' },
  { value: 'prima_visita',  label: 'Prima visita alla stanza' },
  { value: 'visita_gte',    label: 'N. visite ≥' },
];

function renderCondizioniEditor(condizioni) {
  const cont = document.getElementById('condizioni-list');
  cont.innerHTML = '';
  condizioni.forEach((c, i) => aggiungiCondizioneRow(cont, c, i));
}

function aggiungiCondizioneRow(cont, cond, idx) {
  const row = document.createElement('div');
  row.className = 'condizione-row';

  const tipoSel = document.createElement('select');
  TIPI_CONDIZIONE.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value;
    opt.textContent = t.label;
    if (cond && cond.tipo === t.value) opt.selected = true;
    tipoSel.appendChild(opt);
  });

  const fields = document.createElement('div');
  fields.className = 'row-fields';

  const aggiornaCampi = () => {
    fields.innerHTML = '';
    const tipo = tipoSel.value;
    if (['ha_oggetto','non_ha_oggetto'].includes(tipo)) {
      const sel = document.createElement('select');
      sel.innerHTML = '<option value="">— oggetto —</option>';
      Object.values(avventura.oggetti).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id; opt.textContent = o.nome || o.id;
        if (cond?.valore === o.id) opt.selected = true;
        sel.appendChild(opt);
      });
      fields.appendChild(sel);
    } else if (['flag_vero','flag_falso'].includes(tipo)) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.placeholder = 'nome_flag';
      inp.value = cond?.valore || '';
      fields.appendChild(inp);
    } else if (tipo === 'visita_gte') {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.placeholder = 'N'; inp.min = 1;
      inp.value = cond?.valore || 2;
      fields.appendChild(inp);
    }
    // prima_visita non ha campi extra
  };

  tipoSel.addEventListener('change', aggiornaCampi);
  aggiornaCampi();

  const btnRimuovi = document.createElement('button');
  btnRimuovi.className = 'btn-remove-row';
  btnRimuovi.textContent = '×';
  btnRimuovi.addEventListener('click', () => row.remove());

  row.appendChild(tipoSel);
  row.appendChild(fields);
  row.appendChild(btnRimuovi);
  cont.appendChild(row);
}

function leggiCondizioni() {
  const rows = document.querySelectorAll('#condizioni-list .condizione-row');
  return Array.from(rows).map(row => {
    const tipo = row.querySelector('select').value;
    const inp = row.querySelector('.row-fields input, .row-fields select');
    return { tipo, valore: inp ? inp.value : '' };
  });
}

// ─── Effetti editor ───────────────────────────────────────────

const TIPI_EFFETTO = [
  { value: 'testo',            label: 'Mostra testo' },
  { value: 'aggiungi_oggetto', label: 'Aggiungi all\'inventario' },
  { value: 'rimuovi_oggetto',  label: 'Rimuovi dall\'inventario' },
  { value: 'attiva_flag',      label: 'Attiva flag' },
  { value: 'disattiva_flag',   label: 'Disattiva flag' },
  { value: 'sblocca_uscita',   label: 'Sblocca uscita' },
  { value: 'vai_a_stanza',     label: 'Vai a stanza' },
  { value: 'vittoria',         label: 'VITTORIA' },
  { value: 'sconfitta',        label: 'SCONFITTA' },
];

function renderEffettiEditor(effetti) {
  const cont = document.getElementById('effetti-list');
  cont.innerHTML = '';
  effetti.forEach((e, i) => aggiungiEffettoRow(cont, e, i));
}

function aggiungiEffettoRow(cont, effetto, idx) {
  const row = document.createElement('div');
  row.className = 'effetto-row';

  const tipoSel = document.createElement('select');
  TIPI_EFFETTO.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.value; opt.textContent = t.label;
    if (effetto && effetto.tipo === t.value) opt.selected = true;
    tipoSel.appendChild(opt);
  });

  const fields = document.createElement('div');
  fields.className = 'row-fields';

  const aggiornaCampi = () => {
    fields.innerHTML = '';
    const tipo = tipoSel.value;

    if (tipo === 'testo') {
      const ta = document.createElement('textarea');
      ta.placeholder = 'Testo mostrato al giocatore...';
      ta.value = effetto?.valore || '';
      fields.appendChild(ta);
    } else if (['aggiungi_oggetto','rimuovi_oggetto'].includes(tipo)) {
      const sel = document.createElement('select');
      sel.innerHTML = '<option value="">— oggetto —</option>';
      Object.values(avventura.oggetti).forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.id; opt.textContent = o.nome || o.id;
        if (effetto?.valore === o.id) opt.selected = true;
        sel.appendChild(opt);
      });
      fields.appendChild(sel);
    } else if (['attiva_flag','disattiva_flag'].includes(tipo)) {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.placeholder = 'nome_flag';
      inp.value = effetto?.valore || '';
      fields.appendChild(inp);
    } else if (tipo === 'sblocca_uscita') {
      const dirSel = document.createElement('select');
      ['nord','sud','est','ovest'].forEach(d => {
        const opt = document.createElement('option');
        opt.value = d; opt.textContent = d;
        const v = effetto?.valore || '';
        if (v.startsWith(d)) opt.selected = true;
        dirSel.appendChild(opt);
      });
      const stanzaSel = document.createElement('select');
      stanzaSel.innerHTML = '<option value="">— stanza —</option>';
      Object.values(avventura.stanze).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.nome || s.id;
        stanzaSel.appendChild(opt);
      });
      // encode: "nord:stanza_id"
      if (effetto?.valore) {
        const parts = effetto.valore.split(':');
        if (parts[1]) stanzaSel.value = parts[1];
      }
      fields.appendChild(dirSel);
      fields.appendChild(stanzaSel);
    } else if (tipo === 'vai_a_stanza') {
      const sel = document.createElement('select');
      sel.innerHTML = '<option value="">— stanza —</option>';
      Object.values(avventura.stanze).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = s.nome || s.id;
        if (effetto?.valore === s.id) opt.selected = true;
        sel.appendChild(opt);
      });
      fields.appendChild(sel);
    }
    // vittoria / sconfitta non hanno campi extra
  };

  tipoSel.addEventListener('change', aggiornaCampi);
  aggiornaCampi();

  const btnRimuovi = document.createElement('button');
  btnRimuovi.className = 'btn-remove-row';
  btnRimuovi.textContent = '×';
  btnRimuovi.addEventListener('click', () => row.remove());

  row.appendChild(tipoSel);
  row.appendChild(fields);
  row.appendChild(btnRimuovi);
  cont.appendChild(row);
}

function leggiEffetti() {
  const rows = document.querySelectorAll('#effetti-list .effetto-row');
  return Array.from(rows).map(row => {
    const tipo = row.querySelector('select').value;
    const fields = row.querySelector('.row-fields');
    let valore = '';
    if (tipo === 'testo') {
      valore = fields.querySelector('textarea')?.value || '';
    } else if (tipo === 'sblocca_uscita') {
      const sels = fields.querySelectorAll('select');
      valore = (sels[0]?.value || '') + ':' + (sels[1]?.value || '');
    } else {
      valore = fields.querySelector('input, select')?.value || '';
    }
    return { tipo, valore };
  });
}

function salvaAzione() {
  const id = modalCtx.azioneId || genId('azione');
  const azione = {
    id,
    verbo: document.getElementById('azione-verbo').value,
    target: document.getElementById('azione-target').value.trim(),
    sinonimi_target: document.getElementById('azione-sinonimi').value.split(',').map(s => s.trim()).filter(Boolean),
    stanza: modalCtx.azioneStanzaId || null,
    condizioni: leggiCondizioni(),
    effetti: leggiEffetti(),
    priorita: parseInt(document.getElementById('azione-priorita').value) || 0,
  };

  avventura.azioni[id] = azione;

  // se è locale, assicuriamoci che sia referenziata nella stanza
  if (azione.stanza && avventura.stanze[azione.stanza]) {
    const s = avventura.stanze[azione.stanza];
    if (!s.azioni) s.azioni = [];
    if (!s.azioni.includes(id)) s.azioni.push(id);
    if (modalCtx.stanzaAzioni && !modalCtx.stanzaAzioni.includes(id)) {
      modalCtx.stanzaAzioni.push(id);
    }
  }

  salvaLocalStorage();
  chiudiModale('modal-azione');

  // rirender opportuno
  if (azione.stanza) {
    renderAzioniList('stanza-azioni-list', modalCtx.stanzaAzioni || []);
  } else {
    renderAzioniGlobali();
  }
  toast('Azione salvata');
}

function eliminaAzione() {
  const id = modalCtx.azioneId;
  if (!id || !confirm('Eliminare questa azione?')) return;
  const stanzaId = avventura.azioni[id]?.stanza;
  delete avventura.azioni[id];
  if (stanzaId && avventura.stanze[stanzaId]) {
    avventura.stanze[stanzaId].azioni = (avventura.stanze[stanzaId].azioni || []).filter(a => a !== id);
  }
  if (modalCtx.stanzaAzioni) {
    modalCtx.stanzaAzioni = modalCtx.stanzaAzioni.filter(a => a !== id);
  }
  salvaLocalStorage();
  chiudiModale('modal-azione');
  renderAzioniGlobali();
  toast('Azione eliminata');
}

// ─── FLAGS ────────────────────────────────────────────────────

function renderFlags() {
  const cont = document.getElementById('flags-container');
  cont.innerHTML = '';
  Object.entries(avventura.flags).forEach(([nome, valore]) => {
    cont.appendChild(creaFlagRow(nome, valore));
  });
}

function creaFlagRow(nome, valore) {
  const row = document.createElement('div');
  row.className = 'flag-row';

  const nomeInp = document.createElement('input');
  nomeInp.type = 'text';
  nomeInp.value = nome;
  nomeInp.placeholder = 'nome_flag';

  const tipoSel = document.createElement('select');
  [['boolean','booleano'],['number','numero']].forEach(([v,l]) => {
    const opt = document.createElement('option');
    opt.value = v; opt.textContent = l;
    if (typeof valore === 'number') opt.selected = v === 'number';
    else opt.selected = v === 'boolean';
    tipoSel.appendChild(opt);
  });

  const valoreInp = document.createElement('input');
  valoreInp.style.width = '80px';
  if (typeof valore === 'boolean') {
    valoreInp.type = 'text'; valoreInp.value = valore ? 'true' : 'false';
  } else {
    valoreInp.type = 'number'; valoreInp.value = valore;
  }

  const salvaFlag = () => {
    const nomeVecchio = Object.keys(avventura.flags).find(k => avventura.flags[k] === valore && k === nome);
    const nomeNuovo = nomeInp.value.trim();
    if (!nomeNuovo) return;
    delete avventura.flags[nome];
    const tipo = tipoSel.value;
    avventura.flags[nomeNuovo] = tipo === 'number' ? parseFloat(valoreInp.value) || 0 : valoreInp.value === 'true';
    salvaLocalStorage();
  };

  nomeInp.addEventListener('blur', salvaFlag);
  tipoSel.addEventListener('change', salvaFlag);
  valoreInp.addEventListener('blur', salvaFlag);

  const btnElimina = document.createElement('button');
  btnElimina.className = 'btn-small';
  btnElimina.textContent = '×';
  btnElimina.style.color = 'var(--danger)';
  btnElimina.addEventListener('click', () => {
    delete avventura.flags[nomeInp.value];
    salvaLocalStorage();
    row.remove();
  });

  row.appendChild(nomeInp);
  row.appendChild(tipoSel);
  row.appendChild(valoreInp);
  row.appendChild(btnElimina);
  return row;
}

// ─── Modale selezione ─────────────────────────────────────────

function apriModaleSeleziona(titolo, catalogo, selezionati, onSeleziona) {
  document.getElementById('modal-seleziona-title').textContent = titolo;
  const lista = document.getElementById('seleziona-lista');
  lista.innerHTML = '';

  Object.values(catalogo).forEach(item => {
    if (selezionati.includes(item.id)) return;
    const el = document.createElement('div');
    el.className = 'select-item';
    el.textContent = `${item.nome || item.id} (${item.id})`;
    el.addEventListener('click', () => {
      onSeleziona(item.id);
      chiudiModale('modal-seleziona');
    });
    lista.appendChild(el);
  });

  if (!lista.children.length) {
    lista.innerHTML = '<p style="padding:12px;color:var(--text-muted)">Nessun elemento disponibile.</p>';
  }

  apriModale('modal-seleziona');
}

// ─── Gestione modali ──────────────────────────────────────────

function apriModale(id) {
  document.getElementById(id).classList.remove('hidden');
}

function chiudiModale(id) {
  document.getElementById(id).classList.add('hidden');
}

function chiudiModali() {
  document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
}

// ─── Export / Import ──────────────────────────────────────────

function esportaJSON() {
  leggiImpostazioni();
  const blob = new Blob([JSON.stringify(avventura, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (avventura.meta.titolo || 'avventura') + '.adventure.json';
  a.click();
  URL.revokeObjectURL(url);
  toast('JSON esportato');
}

function importaJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      avventura = JSON.parse(e.target.result);
      salvaLocalStorage();
      renderSezione('impostazioni');
      mostraSezione('impostazioni');
      toast('Avventura importata!');
    } catch (err) {
      toast('Errore nel file JSON');
    }
  };
  reader.readAsText(file);
}

// ─── Export gioco ─────────────────────────────────────────────

async function esportaGioco() {
  leggiImpostazioni();

  let engineJs = '';
  let templateHtml = '';

  try {
    const [resEngine, resTemplate] = await Promise.all([
      fetch('../engine/engine.js'),
      fetch('../engine/template.html'),
    ]);
    engineJs = await resEngine.text();
    templateHtml = await resTemplate.text();
  } catch (e) {
    toast('Errore caricamento engine/template');
    return;
  }

  const jsonAvventura = JSON.stringify(avventura);
  let html = templateHtml
    .replace('/*__ADVENTURE_JSON__*/', jsonAvventura)
    .replace('/*__ENGINE_JS__*/', engineJs);

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (avventura.meta.titolo || 'gioco') + '.html';
  a.click();
  URL.revokeObjectURL(url);
  toast('Gioco esportato!');
}

// ─── Init & binding eventi ────────────────────────────────────

function init() {
  caricaLocalStorage();
  // Titolo pagina dinamico
  document.title = 'Editor — ' + (avventura.meta?.titolo || 'Nuova avventura');

  // Navigazione
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => mostraSezione(btn.dataset.section));
  });

  bindImpostazioni();

  // Stanze
  document.getElementById('btn-nuova-stanza').addEventListener('click', () => apriModaleStanza(null));
  document.getElementById('btn-salva-stanza').addEventListener('click', () => salvaSzanza());
  document.getElementById('btn-elimina-stanza').addEventListener('click', () => eliminaStanza());
  document.getElementById('btn-add-oggetto-stanza').addEventListener('click', () => {
    apriModaleSeleziona('Aggiungi oggetto', avventura.oggetti, modalCtx.stanzaOggetti, (id) => {
      modalCtx.stanzaOggetti.push(id);
      renderTagList('stanza-oggetti-list', modalCtx.stanzaOggetti, avventura.oggetti);
    });
  });
  document.getElementById('btn-add-personaggio-stanza').addEventListener('click', () => {
    apriModaleSeleziona('Aggiungi personaggio', avventura.personaggi, modalCtx.stanzaPersonaggi, (id) => {
      modalCtx.stanzaPersonaggi.push(id);
      renderTagList('stanza-personaggi-list', modalCtx.stanzaPersonaggi, avventura.personaggi);
    });
  });
  document.getElementById('btn-add-azione-stanza').addEventListener('click', () => {
    apriModaleAzione(null, modalCtx.stanzaId);
  });

  // Oggetti
  document.getElementById('btn-nuovo-oggetto').addEventListener('click', () => apriModaleOggetto(null));
  document.getElementById('btn-salva-oggetto').addEventListener('click', salvaOggetto);
  document.getElementById('btn-elimina-oggetto').addEventListener('click', eliminaOggetto);

  // Personaggi
  document.getElementById('btn-nuovo-personaggio').addEventListener('click', () => apriModalePersonaggio(null));
  document.getElementById('btn-salva-personaggio').addEventListener('click', salvaPersonaggio);
  document.getElementById('btn-elimina-personaggio').addEventListener('click', eliminaPersonaggio);

  // Azioni
  document.getElementById('btn-nuova-azione-globale').addEventListener('click', () => apriModaleAzione(null, null));
  document.getElementById('btn-add-condizione').addEventListener('click', () => {
    aggiungiCondizioneRow(document.getElementById('condizioni-list'), null, -1);
  });
  document.getElementById('btn-add-effetto').addEventListener('click', () => {
    aggiungiEffettoRow(document.getElementById('effetti-list'), null, -1);
  });
  document.getElementById('btn-salva-azione').addEventListener('click', salvaAzione);
  document.getElementById('btn-elimina-azione').addEventListener('click', eliminaAzione);

  // Flags
  document.getElementById('btn-nuovo-flag').addEventListener('click', () => {
    const nome = 'flag_' + Object.keys(avventura.flags).length;
    avventura.flags[nome] = false;
    salvaLocalStorage();
    document.getElementById('flags-container').appendChild(creaFlagRow(nome, false));
  });

  // Export / Import
  document.getElementById('btn-export-json').addEventListener('click', esportaJSON);
  document.getElementById('btn-import-json').addEventListener('click', () => {
    document.getElementById('file-import').click();
  });
  document.getElementById('file-import').addEventListener('change', (e) => {
    if (e.target.files[0]) importaJSON(e.target.files[0]);
  });
  document.getElementById('btn-export-game').addEventListener('click', esportaGioco);

  // Chiudi modali
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal').classList.add('hidden');
    });
  });
  document.querySelectorAll('.modal-backdrop').forEach(bd => {
    bd.addEventListener('click', () => {
      bd.closest('.modal').classList.add('hidden');
    });
  });

  // Render iniziale
  renderSezione('impostazioni');
}

document.addEventListener('DOMContentLoaded', init);
