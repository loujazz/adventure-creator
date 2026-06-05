# Adventure Creator

Editor visuale per avventure testuali didattiche in stile anni 80 (C64/Infocom).

## Struttura

```
adventure-creator/
├── editor/
│   ├── index.html       ← apri nel browser per usare l'editor
│   ├── editor.js
│   └── editor.css
├── engine/
│   ├── engine.js        ← motore del gioco
│   └── template.html    ← template per l'export
└── export/              ← giochi generati (gitignored)
```

## Uso

1. Apri `editor/index.html` nel browser
2. Crea la tua avventura (stanze, oggetti, personaggi, azioni)
3. Clicca **Esporta gioco** per generare un `index.html` standalone
4. Pubblica il file su Netlify / Vercel o distribuiscilo direttamente

## Formato salvataggio

L'avventura viene salvata in `localStorage` durante l'editing.
Puoi esportare/importare il progetto come file `.adventure.json`.
