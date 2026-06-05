/* ============================================================
   Adventure Creator — Engine JS
   Motore parser per il gioco esportato
   ============================================================ */

(function () {
  'use strict';

  // ─── Stato partita ─────────────────────────────────────────

  const stato = {
    stanzaCorrente: null,
    inventario: [],       // array di oggetto_id
    flags: {},            // copia lavorante dei flags
    visite: {},           // stanza_id → numero visite
    finePartita: false,
  };

  let avventura = null;

  // ─── Normalizzazione testo ─────────────────────────────────

  const ARTICOLI = ['il','lo','la','le','gli','i','un','uno','una','delle','degli','dei','del','della','dello','dell'];
  const PREPOSIZIONI = ['a','di','da','in','con','su','per','tra','fra','al','ai','allo','alla','alle','agli','nel','nella','nei','nelle','negli','sul','sulla','sui','sulle','sugli','col','coi'];
  const STOP_WORDS = new Set([...ARTICOLI, ...PREPOSIZIONI]);

  function normalizza(testo) {
    return testo.trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''); // rimuove accenti
  }

  function tokenizza(testo) {
    return normalizza(testo).split(/\s+/).filter(t => t && !STOP_WORDS.has(t));
  }

  // ─── Parser ────────────────────────────────────────────────

  const ALIAS_DIREZIONI = {
    'n': 'nord', 'nord': 'nord',
    's': 'sud',  'sud': 'sud',
    'e': 'est',  'est': 'est',
    'o': 'ovest','ovest': 'ovest',
    'w': 'ovest',
  };

  const ALIAS_PARLA = ['parla', 'parla con', 'dialoga', 'dialoga con', 'interroga', 'chiedi'];
  const ALIAS_ESAMINA = ['esamina', 'guarda', 'osserva', 'ispeziona', 'descrivi', 'g'];
  const ALIAS_PRENDI = ['prendi', 'raccogli', 'afferra', 'porta'];
  const ALIAS_LASCIA = ['lascia', 'deposita', 'metti giu', 'abbandona'];
  const ALIAS_INV = ['inventario', 'inv', 'i', 'zaino', 'borsa'];
  const ALIAS_AIUTO = ['aiuto', 'help', '?', 'comandi'];
  const ALIAS_VAI = ['vai', 'va', 'go', 'spostati'];

  function parseComando(input) {
    const raw = normalizza(input);
    const tokens = tokenizza(input);

    if (!tokens.length) return null;

    // Direzione diretta (N, S, E, O, NORD, SUD, ...)
    if (tokens.length === 1 && ALIAS_DIREZIONI[tokens[0]]) {
      return { tipo: 'vai', direzione: ALIAS_DIREZIONI[tokens[0]] };
    }

    // VAI + direzione
    if (tokens.length >= 2 && ALIAS_VAI.includes(tokens[0]) && ALIAS_DIREZIONI[tokens[1]]) {
      return { tipo: 'vai', direzione: ALIAS_DIREZIONI[tokens[1]] };
    }

    // Inventario
    if (tokens.length === 1 && ALIAS_INV.includes(tokens[0])) {
      return { tipo: 'inventario' };
    }

    // Aiuto
    if (tokens.length === 1 && ALIAS_AIUTO.includes(tokens[0])) {
      return { tipo: 'aiuto' };
    }

    // ESAMINA [target]
    if (ALIAS_ESAMINA.includes(tokens[0])) {
      const target = tokens.slice(1).join(' ');
      return { tipo: 'esamina', target: target || null };
    }

    // PRENDI [target]
    if (ALIAS_PRENDI.includes(tokens[0])) {
      return { tipo: 'prendi', target: tokens.slice(1).join(' ') };
    }

    // LASCIA [target]
    if (ALIAS_LASCIA.includes(tokens[0])) {
      return { tipo: 'lascia', target: tokens.slice(1).join(' ') };
    }

    // PARLA CON [target]
    if (tokens[0] === 'parla') {
      const target = tokens.slice(tokens[1] === 'con' ? 2 : 1).join(' ');
      return { tipo: 'parla', target };
    }

    // Comando generico: VERBO TARGET
    return { tipo: 'azione', verbo: tokens[0].toUpperCase(), target: tokens.slice(1).join(' ') };
  }

  // ─── Valutazione condizioni ────────────────────────────────

  function valutaCondizione(cond) {
    switch (cond.tipo) {
      case 'ha_oggetto':
        return stato.inventario.includes(cond.valore);
      case 'non_ha_oggetto':
        return !stato.inventario.includes(cond.valore);
      case 'flag_vero':
        return !!stato.flags[cond.valore];
      case 'flag_falso':
        return !stato.flags[cond.valore];
      case 'prima_visita':
        return (stato.visite[stato.stanzaCorrente] || 0) === 1;
      case 'visita_gte':
        return (stato.visite[stato.stanzaCorrente] || 0) >= Number(cond.valore);
      default:
        return true;
    }
  }

  function condizioniSoddisfatte(condizioni) {
    return (condizioni || []).every(valutaCondizione);
  }

  // ─── Esecuzione effetti ────────────────────────────────────

  function eseguiEffetti(effetti) {
    const testi = [];
    for (const eff of (effetti || [])) {
      switch (eff.tipo) {
        case 'testo':
          testi.push(eff.valore);
          break;
        case 'aggiungi_oggetto':
          if (eff.valore && !stato.inventario.includes(eff.valore)) {
            stato.inventario.push(eff.valore);
            const nome = avventura.oggetti[eff.valore]?.nome || eff.valore;
            testi.push(`Hai preso: ${nome}.`);
          }
          break;
        case 'rimuovi_oggetto':
          stato.inventario = stato.inventario.filter(id => id !== eff.valore);
          break;
        case 'attiva_flag':
          stato.flags[eff.valore] = true;
          break;
        case 'disattiva_flag':
          stato.flags[eff.valore] = false;
          break;
        case 'sblocca_uscita': {
          const parts = (eff.valore || '').split(':');
          const dir = parts[0];
          const dest = parts[1];
          if (dir && dest && avventura.stanze[stato.stanzaCorrente]) {
            avventura.stanze[stato.stanzaCorrente].uscite[dir] = dest;
          }
          break;
        }
        case 'vai_a_stanza':
          if (avventura.stanze[eff.valore]) {
            entraNellaStanza(eff.valore, testi);
          }
          break;
        case 'vittoria':
          stato.finePartita = true;
          mostraFine('vittoria', avventura.meta.testo_vittoria || 'Hai vinto!');
          return testi;
        case 'sconfitta':
          stato.finePartita = true;
          mostraFine('sconfitta', avventura.meta.testo_sconfitta || 'Hai perso...');
          return testi;
      }
    }
    return testi;
  }

  // ─── Matching azione ───────────────────────────────────────

  function targetCorrisponde(azione, targetInput) {
    if (!targetInput) return !azione.target;
    const t = normalizza(targetInput);
    const candidati = [
      normalizza(azione.target || ''),
      ...(azione.sinonimi_target || []).map(normalizza),
    ];
    return candidati.some(c => c && t.includes(c) || (c && c.includes(t)));
  }

  function trovAzione(verbo, target) {
    const stanza = avventura.stanze[stato.stanzaCorrente];
    const azioniLocali = (stanza?.azioni || []).map(id => avventura.azioni[id]).filter(Boolean);
    const azioniGlobali = Object.values(avventura.azioni).filter(a => a.stanza === null);

    const candidate = [...azioniLocali, ...azioniGlobali]
      .filter(a => normalizza(a.verbo) === normalizza(verbo) && targetCorrisponde(a, target))
      .sort((a, b) => (b.priorita || 0) - (a.priorita || 0));

    return candidate.find(a => condizioniSoddisfatte(a.condizioni)) || null;
  }

  // ─── Movimento ─────────────────────────────────────────────

  function eseguiVai(direzione) {
    const stanza = avventura.stanze[stato.stanzaCorrente];
    if (!stanza) return ['Errore: stanza non trovata.'];

    // Prima controlla uscite condizionali con condizioni soddisfatte
    const uscitaCond = (stanza.uscite_condizionali || []).find(u =>
      u.direzione === direzione && condizioniSoddisfatte(u.condizioni)
    );
    const dest = uscitaCond ? uscitaCond.destinazione : stanza.uscite?.[direzione];

    if (!dest || !avventura.stanze[dest]) {
      return [`Non puoi andare a ${direzione}.`];
    }

    const testi = [];
    entraNellaStanza(dest, testi);
    return testi;
  }

  function entraNellaStanza(id, testiBuffer) {
    stato.stanzaCorrente = id;
    stato.visite[id] = (stato.visite[id] || 0) + 1;

    const stanza = avventura.stanze[id];
    if (!stanza) { testiBuffer.push('Errore: stanza non trovata.'); return; }

    const desc = stato.visite[id] > 1 && stanza.descrizione_ritorno
      ? stanza.descrizione_ritorno
      : stanza.descrizione;

    testiBuffer.push(`\n**${stanza.nome}**`);
    testiBuffer.push(desc || '');

    // Lista oggetti visibili
    const oggettiVisibili = (stanza.oggetti || [])
      .map(id => avventura.oggetti[id])
      .filter(o => o && o.visibile !== false);
    if (oggettiVisibili.length) {
      testiBuffer.push(`Qui vedi: ${oggettiVisibili.map(o => o.nome).join(', ')}.`);
    }

    // Lista personaggi
    const personaggi = (stanza.personaggi || [])
      .map(id => avventura.personaggi[id])
      .filter(Boolean);
    if (personaggi.length) {
      testiBuffer.push(`Presenti: ${personaggi.map(p => p.nome).join(', ')}.`);
    }

    // Uscite disponibili
    const usciteDisp = Object.entries(stanza.uscite || {})
      .filter(([, dest]) => dest && avventura.stanze[dest])
      .map(([dir]) => dir.toUpperCase());
    if (usciteDisp.length) {
      testiBuffer.push(`Uscite: ${usciteDisp.join(', ')}.`);
    }

    // Aggiorna immagine e nome stanza nella UI del gioco
    aggiornaImmagineUI(id);
  }

  // ─── Comandi di sistema ────────────────────────────────────

  function eseguiInventario() {
    if (!stato.inventario.length) return ['Il tuo inventario è vuoto.'];
    const nomi = stato.inventario.map(id => avventura.oggetti[id]?.nome || id);
    return [`Stai portando: ${nomi.join(', ')}.`];
  }

  function eseguiEsamina(target) {
    if (!target) {
      const testi = [];
      entraNellaStanza(stato.stanzaCorrente, testi);
      return testi;
    }

    const t = normalizza(target);
    const stanza = avventura.stanze[stato.stanzaCorrente];

    // Cerca tra oggetti nella stanza o in inventario
    const oggettoId = [
      ...(stanza?.oggetti || []),
      ...stato.inventario,
    ].find(id => {
      const o = avventura.oggetti[id];
      if (!o) return false;
      return normalizza(o.nome).includes(t) || (o.sinonimi || []).some(s => normalizza(s).includes(t));
    });

    if (oggettoId) return [avventura.oggetti[oggettoId].descrizione || 'Non noti nulla di speciale.'];

    // Cerca tra personaggi
    const persId = (stanza?.personaggi || []).find(id => {
      const p = avventura.personaggi[id];
      if (!p) return false;
      return normalizza(p.nome).includes(t) || (p.sinonimi || []).some(s => normalizza(s).includes(t));
    });
    if (persId) return [avventura.personaggi[persId].descrizione || 'Non noti nulla di speciale.'];

    return ['Non vedi nulla del genere qui.'];
  }

  function eseguiPrendi(target) {
    if (!target) return ['Cosa vuoi prendere?'];
    const t = normalizza(target);
    const stanza = avventura.stanze[stato.stanzaCorrente];

    const oggettoId = (stanza?.oggetti || []).find(id => {
      const o = avventura.oggetti[id];
      if (!o || o.visibile === false) return false;
      return normalizza(o.nome).includes(t) || (o.sinonimi || []).some(s => normalizza(s).includes(t));
    });

    if (!oggettoId) return ['Non vedi quell\'oggetto qui.'];

    const oggetto = avventura.oggetti[oggettoId];
    if (!oggetto.raccoglibile) return ['Non puoi prendere quello.'];
    if (stato.inventario.includes(oggettoId)) return ['Ce l\'hai già.'];

    stato.inventario.push(oggettoId);
    // Rimuovi dalla stanza
    stanza.oggetti = (stanza.oggetti || []).filter(id => id !== oggettoId);

    return [`Hai preso: ${oggetto.nome}.`];
  }

  function eseguiLascia(target) {
    if (!target) return ['Cosa vuoi lasciare?'];
    const t = normalizza(target);

    const oggettoId = stato.inventario.find(id => {
      const o = avventura.oggetti[id];
      if (!o) return false;
      return normalizza(o.nome).includes(t) || (o.sinonimi || []).some(s => normalizza(s).includes(t));
    });

    if (!oggettoId) return ['Non hai quell\'oggetto.'];

    stato.inventario = stato.inventario.filter(id => id !== oggettoId);
    const stanza = avventura.stanze[stato.stanzaCorrente];
    if (!stanza.oggetti) stanza.oggetti = [];
    stanza.oggetti.push(oggettoId);
    avventura.oggetti[oggettoId].visibile = true;

    return [`Hai lasciato: ${avventura.oggetti[oggettoId].nome}.`];
  }

  function eseguiParla(target) {
    if (!target) return ['Con chi vuoi parlare?'];
    const t = normalizza(target);
    const stanza = avventura.stanze[stato.stanzaCorrente];

    const persId = (stanza?.personaggi || []).find(id => {
      const p = avventura.personaggi[id];
      if (!p) return false;
      return normalizza(p.nome).includes(t) || (p.sinonimi || []).some(s => normalizza(s).includes(t));
    });

    if (!persId) return ['Non c\'è nessuno del genere qui.'];

    // Cerca azioni PARLA specifiche per questo personaggio
    const azioneParla = trovAzione('PARLA', target);
    if (azioneParla) {
      return eseguiEffetti(azioneParla.effetti);
    }

    return [avventura.personaggi[persId].dialogo_default || '...non risponde.'];
  }

  function eseguiAiuto() {
    return [
      'Comandi disponibili:',
      '  NORD / SUD / EST / OVEST (o N/S/E/O) — spostati',
      '  ESAMINA [cosa] — guarda un oggetto o personaggio',
      '  PRENDI [oggetto] — raccogli un oggetto',
      '  LASCIA [oggetto] — deposita un oggetto',
      '  PARLA CON [personaggio] — avvia un dialogo',
      '  INVENTARIO — mostra gli oggetti che porti',
      '  AIUTO — mostra questo messaggio',
    ];
  }

  // ─── Esegui comando ────────────────────────────────────────

  function eseguiComando(input) {
    if (stato.finePartita) return ['La partita è terminata.'];
    if (!input.trim()) return [''];

    const cmd = parseComando(input);
    if (!cmd) return ['Non ho capito.'];

    switch (cmd.tipo) {
      case 'vai':       return eseguiVai(cmd.direzione);
      case 'inventario':return eseguiInventario();
      case 'esamina':   return eseguiEsamina(cmd.target);
      case 'prendi':    return eseguiPrendi(cmd.target);
      case 'lascia':    return eseguiLascia(cmd.target);
      case 'parla':     return eseguiParla(cmd.target);
      case 'aiuto':     return eseguiAiuto();
      case 'azione': {
        const azione = trovAzione(cmd.verbo, cmd.target);
        if (!azione) return ['Non puoi farlo.'];
        return eseguiEffetti(azione.effetti);
      }
      default:
        return ['Non ho capito.'];
    }
  }

  // ─── UI del gioco ──────────────────────────────────────────

  let outputEl, inputEl, formEl;

  function mostraRighe(righe) {
    righe.forEach(riga => mostraRiga(riga));
    outputEl.scrollTop = outputEl.scrollHeight;
  }

  function mostraRiga(testo, classe) {
    if (testo === undefined || testo === null) return;
    const p = document.createElement('p');
    p.innerHTML = testo.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    p.className = classe || 'riga-output';
    outputEl.appendChild(p);
  }

  function mostraInput(testo) {
    const p = document.createElement('p');
    p.className = 'riga-input';
    p.textContent = '> ' + testo;
    outputEl.appendChild(p);
  }

  function mostraFine(tipo, testo) {
    const div = document.createElement('div');
    div.className = 'schermata-fine ' + tipo;
    div.innerHTML = `<p>${testo}</p>`;
    if (tipo === 'sconfitta') {
      const btn = document.createElement('button');
      btn.textContent = 'Riprova';
      btn.onclick = () => location.reload();
      div.appendChild(btn);
    }
    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
    if (inputEl) inputEl.disabled = true;
  }

  // ─── Immagine stanza ───────────────────────────────────────

  // ─── Aggiorna immagine e nome stanza nella UI ─────────────
  // Chiamata da entraNellaStanza ogni volta che si cambia stanza

  function aggiornaImmagineUI(stanzaId) {
    const stanza = avventura.stanze[stanzaId];
    const imgEl        = document.getElementById('immagine-stanza');
    const placeholder  = document.getElementById('placeholder-immagine');
    const nomeStanzaEl = document.getElementById('nome-stanza');

    if (nomeStanzaEl) nomeStanzaEl.textContent = stanza ? stanza.nome || '' : '';
    if (!imgEl || !placeholder) return;

    if (stanza && stanza.immagine) {
      imgEl.src = stanza.immagine;
      imgEl.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      imgEl.style.display = 'none';
      placeholder.style.display = 'flex';
    }
  }

  // ─── Schermata di benvenuto ────────────────────────────────

  function mostraSchermataIntro(meta, onAvvia) {
    const schermata = document.getElementById('schermata-benvenuto');
    const gioco     = document.getElementById('gioco');
    const btn       = document.getElementById('btn-inizia');

    document.getElementById('benv-titolo').textContent = meta.titolo || 'AVVENTURA';
    document.getElementById('benv-autore').textContent = meta.autore ? '— ' + meta.autore + ' —' : '';
    document.getElementById('benv-intro').textContent  = meta.intro  || '';

    function avvia() {
      schermata.style.display = 'none';
      gioco.style.display     = 'flex';
      onAvvia();
    }

    // Click sul pulsante — unico punto di ingresso
    btn.onclick = avvia;
  }

  // ─── Avvia gioco ───────────────────────────────────────────

  function avviaGioco(datiAvventura) {
    avventura = datiAvventura;

    stato.flags     = Object.assign({}, avventura.flags || {});
    stato.inventario = [];
    stato.visite    = {};
    stato.finePartita = false;

    outputEl = document.getElementById('output');
    inputEl  = document.getElementById('input');
    formEl   = document.getElementById('form-input');

    document.getElementById('nome-gioco').textContent = avventura.meta.titolo || '';

    formEl.addEventListener('submit', function(e) {
      e.preventDefault();
      var cmd = inputEl.value.trim();
      if (!cmd) return;
      mostraInput(cmd);
      inputEl.value = '';
      mostraRighe(eseguiComando(cmd));
    });

    function iniziaPartita() {
      var idInizio = avventura.meta.stanza_iniziale;
      if (idInizio && avventura.stanze[idInizio]) {
        var testi = [];
        entraNellaStanza(idInizio, testi);
        mostraRighe(testi);
      } else {
        mostraRiga('[Errore: nessuna stanza iniziale configurata]');
      }
      inputEl.focus();
    }

    mostraSchermataIntro(avventura.meta, iniziaPartita);
  }

  // Esponi al template
  window.avviaGioco = avviaGioco;

})();
