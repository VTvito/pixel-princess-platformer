# ✨ Polishing & Meta-Game Specifications (Ultracode Phase)

**Context:** The core platformer game (Kaplay/Kaboom.js) is complete and functional. This phase focuses on adding "juiciness", quality of life (QoL) features, and the custom "Insert Coin" meta-game without breaking the existing core logic.

---

## 1. Il Sistema "Insert Coin" (Meta-Game)

* **Meccanica Base:** Non esistono vite o "Game Over". Quando il giocatore fallisce, accumula "debiti".
* **Gestione Dati:** Utilizzare `localStorage.getItem('totaleCoccoline')`. Inizializzare a `0` al primo avvio.
* **Flusso di Morte (Respawn Loop):**
    * Quando l'avatar tocca un ostacolo letale o cade fuori dal canvas, il gioco (la scena corrente di Kaplay) va in pausa.
    * Appare un overlay DOM HTML (non un elemento Kaplay) sovrapposto al canvas.
    * **Testo Overlay:** "Ops! Hai sbagliato. Inserisci 500 Coccoline per continuare."
    * **Pulsante:** `[ Inserisci Coin ]`.
    * **Azione:** Al click, aggiungere 500 al `localStorage`, nascondere l'overlay e riavviare la scena Kaplay corrente dall'inizio (mantenendo lo stato globale della skin).

## 2. Il Payoff Finale (Scontrino WhatsApp)

* **Dove:** Nella Scena Finale (Livello 5 - Sala da Ballo).
* **Elemento UI:** Alla fine della pergamena di vittoria, mostrare un div HTML (Scontrino) con il resoconto.
* **Testo Scontrino:** "Costo totale dell'operazione: [X] Coccoline." (dove X è il valore finale nel `localStorage`).
* **Integrazione WhatsApp (Zero-Data-Leak):**
    * Aggiungere un pulsante HTML "Paga il Debito!".
    * Al click, aprire in un nuovo tab il seguente URL dinamico:
    * `https://api.whatsapp.com/send?text=Ho%20finito%20il%20gioco%20e%20sono%20la%20Principessa%20Perfetta!%20%E2%9D%A4%EF%B8%8F%20Preparati,%20ti%20devo%20[X]%20coccoline!`
    * *Nota per l'AI:* Sostituire `[X]` nel link con il valore letto dal `localStorage`. Non inserire numeri di telefono fissi.

## 3. "Juiciness" e Game Feel (Impatto Visivo)

L'obiettivo è rendere il gioco "croccante" usando le funzioni built-in di Kaplay.
* **Squash & Stretch (Salto):** Quando l'avatar salta, scalare leggermente l'asse Y (più alto) e rimpicciolire la X. All'atterraggio, scalare leggermente la X (più largo) e rimpicciolire la Y per un breve istante.
* **Particellari (Confetti):** Quando si raccoglie un oggetto (mela, perla, ecc.), far generare ("esplodere") piccoli poligoni colorati (funzione particellare di base) che svaniscono.
* **Parallasse Base:** Aggiungere un background a 2 o 3 livelli nella scena di gioco che si muove a una velocità inferiore (es. 0.5x o 0.2x) rispetto alla telecamera che segue il giocatore, per dare profondità.

## 4. Transizioni e UI (Quality of Life)

* **Transizioni Scena (Fade):** Implementare un effetto di "fade out" (sfumo verso il nero) quando si finisce un livello, e "fade in" quando si inizia il successivo.
* **Feedback Touch Mobile:** I pulsanti DOM per il mobile (D-Pad e Salto) devono cambiare stato visivo (es. opacità, colore di sfondo o piccola riduzione di scala tramite CSS `transform`) istantaneamente sugli eventi `touchstart`, tornando normali su `touchend`.
* **Audio Toggle:** Aggiungere un piccolo pulsante HTML `[ 🔊 / 🔇 ]` nell'angolo superiore destro dello schermo per permettere di disattivare e riattivare la musica di sottofondo (`bgm`) globalmente.

---
## Prompt Suggestions for Multi-Agent Workflow

*Agli Agenti: Isolate le implementazioni UI/HTML nel file `index.html` o nei moduli UI preposti, in modo da non interferire con la logica collisioni all'interno di `game.js`. Usate le API native del browser per le transizioni dove appropriato.*
