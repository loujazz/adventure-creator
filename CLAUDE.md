# Adventure Editor — CLAUDE.md

Questo file contiene tutto il contesto di progetto necessario per sviluppare l'Adventure Editor.
Leggilo integralmente prima di iniziare qualsiasi sessione di lavoro.

---

## Cos'è questo progetto

Un **editor visuale per avventure testuali didattiche** in stile anni 80 (C64/Infocom), pensato per docenti che vogliono creare giochi educativi senza scrivere codice.

Il progetto è composto da due parti distinte:

1. **Editor** — interfaccia web per il docente che crea l'avventura
2. **Engine** — motore del gioco esportato, che gira nel browser degli studenti

Il docente usa l'editor per costruire l'avventura, esporta un file HTML standalone, e lo pubblica (es. Netlify/Vercel) o lo distribuisce direttamente agli studenti.

---

## Struttura del repository

```
adventure-editor/
├── CLAUDE.md                  ← questo file
├── README.md
├── editor/
│   ├── index.html             ← interfaccia editor (entry point)
│   ├── editor.js              ← logica editor
│   └── editor.css             ← stile editor
├── engine/
│   ├── engine.js              ← motore parser del gioco
│   └── template.html          ← template HTML per il gioco esportato
└── export/                    ← giochi generati (in .gitignore)
```

---

## Struttura dati dell'avventura (JSON)

Tutto ciò che il docente crea nell'editor viene serializzato in questo formato JSON.
Questo JSON è sia il **file di salvataggio** dell'editor che l'**input** per generare il gioco esportato.

```json
{
  "meta": {
    "titolo": "string",
    "autore": "string",
    "intro": "string (testo iniziale mostrato allo studente)",
    "stanza_iniziale": "string (ID stanza)",
    "testo_vittoria": "string",
    "testo_sconfitta": "string",
    "tema": "string (opzionale: classico | fantasy | storico)"
  },
  "stanze": {
    "stanza_id": {
      "id": "string",
      "nome": "string",
      "descrizione": "string (testo mostrato all'ingresso)",
      "descrizione_ritorno": "string (opzionale, visite successive)",
      "immagine": "string (path o base64, opzionale)",
      "uscite": {
        "nord": "stanza_id | null",
        "sud": "stanza_id | null",
        "est": "stanza_id | null",
        "ovest": "stanza_id | null"
      },
      "uscite_condizionali": [
        {
          "direzione": "nord | sud | est | ovest",
          "destinazione": "stanza_id",
          "condizioni": ["condizione_id"]
        }
      ],
      "oggetti": ["oggetto_id"],
      "personaggi": ["personaggio_id"],
      "azioni": ["azione_id"]
    }
  },
  "oggetti": {
    "oggetto_id": {
      "id": "string",
      "nome": "string",
      "sinonimi": ["string"],
      "descrizione": "string (risposta a ESAMINA oggetto)",
      "raccoglibile": "boolean",
      "visibile": "boolean"
    }
  },
  "personaggi": {
    "personaggio_id": {
      "id": "string",
      "nome": "string",
      "sinonimi": ["string"],
      "descrizione": "string (risposta a ESAMINA personaggio)",
      "dialogo_default": "string (risposta a PARLA CON senza condizioni)"
    }
  },
  "azioni": {
    "azione_id": {
      "id": "string",
      "verbo": "string",
      "target": "string",
      "sinonimi_target": ["string"],
      "stanza": "stanza_id | null (null = globale, valida ovunque)",
      "condizioni": [
        {
          "tipo": "ha_oggetto | non_ha_oggetto | flag_vero | flag_falso | prima_visita | visita_gte",
          "valore": "string | number"
        }
      ],
      "effetti": [
        {
          "tipo": "testo | aggiungi_oggetto | rimuovi_oggetto | attiva_flag | disattiva_flag | sblocca_uscita | vai_a_stanza | vittoria | sconfitta",
          "valore": "string (testo, oggetto_id, flag_nome, stanza_id...)"
        }
      ],
      "priorita": "number (ordine di valutazione, default 0)"
    }
  },
  "flags": {
    "flag_nome": "boolean | number (valore iniziale)"
  }
}
```

---

## Logica del parser (engine)

Il parser del gioco funziona così:

1. Lo studente scrive un comando (es. `PRENDI CHIAVE` o `PARLA CON MERCANTE`)
2. Il parser fa il parsing in `VERBO + TARGET` (ignora articoli, preposizioni comuni)
3. Cerca le azioni valide per quella stanza + globali, filtrando per verbo e target (inclusi sinonimi)
4. Tra le azioni candidate, valuta le condizioni nell'ordine di priorità
5. Esegue gli effetti della prima azione le cui condizioni sono tutte soddisfatte
6. Se nessuna azione corrisponde, mostra un messaggio generico ("Non puoi farlo.")

**Verbi di sistema** (built-in, non configurabili dall'editor):
- `VAI NORD / SUD / EST / OVEST` → muove tra stanze
- `N / S / E / O` → alias direzioni
- `INVENTARIO` / `INV` → mostra oggetti raccolti
- `ESAMINA / GUARDA [target]` → descrizione oggetto/personaggio/stanza
- `PRENDI [oggetto]` → raccoglie oggetto (se raccoglibile e presente)
- `LASCIA [oggetto]` → deposita oggetto nella stanza corrente
- `AIUTO` / `?` → mostra comandi disponibili

---

## Interfaccia editor — sezioni principali

### Navigazione laterale (sidebar)
- Impostazioni avventura
- Stanze (lista + aggiungi)
- Oggetti (catalogo globale)
- Personaggi (catalogo globale)
- Azioni globali
- Flags

### Pannello stanza
Campi:
- Nome, Descrizione, Descrizione ritorno, Immagine (upload)
- Uscite (N/S/E/O) → dropdown stanze disponibili
- Uscite condizionali → modale dedicata
- Oggetti presenti → multiselect dal catalogo
- Personaggi presenti → multiselect dal catalogo
- Azioni locali → lista con modale di configurazione

### Modale azione (il cuore dell'editor)
Il docente configura ogni azione come una regola SE → ALLORA:

```
COMANDO:
  Verbo: [dropdown: PRENDI, APRI, PARLA, ESAMINA, USA, DAI, RISPONDI, ...]
  Target: [testo libero]
  Sinonimi target: [tag input]

CONDIZIONI (opzionale, + Aggiungi condizione):
  Ogni condizione è un dropdown:
  - "Hai in inventario [oggetto]"
  - "Non hai in inventario [oggetto]"
  - "Flag [nome] è vero/falso"
  - "Prima visita alla stanza"
  - "Numero visite >= N"

EFFETTI (ordinati, + Aggiungi effetto):
  Ogni effetto è un dropdown:
  - "Mostra testo [textarea]"
  - "Aggiungi all'inventario [oggetto]"
  - "Rimuovi dall'inventario [oggetto]"
  - "Attiva flag [nome]"
  - "Disattiva flag [nome]"
  - "Sblocca uscita [direzione] verso [stanza]"
  - "Vai a stanza [stanza]"
  - "Vittoria"
  - "Sconfitta"
```

---

## Tipi di condizione

| Tipo | Controlla |
|------|-----------|
| `ha_oggetto` | Lo studente ha quell'oggetto in inventario |
| `non_ha_oggetto` | Lo studente NON ha quell'oggetto |
| `flag_vero` | Il flag specificato è true |
| `flag_falso` | Il flag specificato è false |
| `prima_visita` | È la prima volta che lo studente entra nella stanza |
| `visita_gte` | Il numero di visite alla stanza è >= N |

---

## Tipi di effetto

| Tipo | Effetto |
|------|---------|
| `testo` | Mostra testo a schermo |
| `aggiungi_oggetto` | Aggiunge oggetto all'inventario studente |
| `rimuovi_oggetto` | Rimuove oggetto dall'inventario |
| `attiva_flag` | Imposta flag = true |
| `disattiva_flag` | Imposta flag = false |
| `sblocca_uscita` | Apre un'uscita prima bloccata |
| `vai_a_stanza` | Sposta lo studente in un'altra stanza |
| `vittoria` | Mostra schermata finale di successo |
| `sconfitta` | Mostra schermata finale con opzione retry |

---

## Salvataggio e export

### Salvataggio editor
- Il JSON dell'avventura viene salvato in **localStorage** durante l'editing
- Il docente può esportare il JSON come file `.adventure.json` (backup/portabilità)
- Il docente può importare un JSON precedentemente salvato

### Export gioco
Il pulsante **"Esporta gioco"** genera un file `index.html` standalone che:
- Contiene il JSON dell'avventura inline
- Contiene il motore engine.js inline
- Non ha dipendenze esterne (funziona offline)
- Può essere pubblicato su Netlify/Vercel con drag & drop

---

## Stile visivo del gioco esportato

Il gioco esportato deve evocare l'estetica anni 80 / C64:
- Sfondo nero o molto scuro
- Font monospace (es. `Courier New`, `VT323` da Google Fonts, o `Share Tech Mono`)
- Testo verde o ambra su sfondo scuro
- Immagine della stanza in alto (se presente), in stile pixel art o B/N
- Area testo scorrevole con history dei comandi
- Input in basso con prompt `>`
- Nessuna dipendenza esterna nel file esportato (font caricati inline se necessario)

---

## Stile visivo dell'editor

L'editor è uno strumento per il docente, non per gli studenti.
Deve essere:
- Pulito e funzionale (non evocare l'estetica anni 80)
- UI moderna, chiara, con buon contrasto
- Sidebar + pannello principale (layout a due colonne)
- Modale per configurare azioni/condizioni/effetti
- Responsive non è prioritario (uso desktop)

---

## Decisioni tecniche

- **Nessun framework JS** per l'editor (vanilla JS + HTML + CSS) — zero dipendenze, zero build step
- **Nessun backend** — tutto client-side
- **localStorage** per il salvataggio in sessione
- **File download** per export JSON e HTML
- L'editor gira aprendo `editor/index.html` direttamente nel browser (o su Netlify)
- Il gioco esportato è un singolo `index.html` autocontenuto

---

## Priorità di sviluppo

### Fase 1 — MVP
1. Struttura file e scaffold
2. Editor: gestione stanze (CRUD + connessioni)
3. Editor: gestione oggetti e personaggi
4. Editor: modale azioni con condizioni ed effetti
5. Editor: salvataggio JSON in localStorage + export/import JSON
6. Engine: parser base con verbi di sistema
7. Engine: esecuzione azioni con condizioni ed effetti
8. Export: generazione HTML standalone

### Fase 2 — Miglioramenti
- Anteprima del gioco dentro l'editor
- Mappa visuale delle stanze (grafo)
- Gestione immagini (upload + embed base64)
- Validazione (stanze orfane, flags non definiti, ecc.)
- Import da PDF con AI (Claude API)

---

## Note importanti per Claude Code

- Prima di ogni sessione: leggi questo file e chiedi allo sviluppatore su cosa vuole lavorare
- Preferisci **riscritture complete dei file** rispetto a patch parziali
- Testa sempre il parsing JSON e la logica condizioni/effetti con casi edge
- I nomi delle variabili JS devono essere in italiano dove toccano concetti di dominio (stanza, azione, effetto, flag) per coerenza con il JSON
- Documenta le funzioni principali dell'engine con commenti chiari
- Quando aggiungi un nuovo tipo di condizione o effetto: aggiornalo in TUTTI e tre i posti (JSON schema in questo file, editor UI, engine)
