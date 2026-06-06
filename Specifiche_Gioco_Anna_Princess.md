# 👑 Game Development Specifications: "The Princess Journey"

**Target Audience:** A personalized gift for the developer's girlfriend (Anna).
**Target Device:** Mobile-first (iPhone 17 / Safari), Desktop-compatible.
**Development Approach:** AI-assisted development ("vibecoding") via VSCode + GitHub Copilot / OpenRouter.

---

## 1. Architettura e Tech Stack

*   **Game Engine:** **Kaplay** (precedentemente Kaboom.js). Scelto per la sua sintassi verbosa, semplicità di gestione delle collisioni e ridotto tasso di allucinazioni per le AI.
*   **Linguaggio:** HTML5, CSS3, JavaScript (ES6+). Niente bundler complessi se possibile (o Vite se strettamente necessario per l'AI).
*   **Hosting:** Vercel o Netlify (Static Web App).
*   **Persistenza Dati:** `localStorage` per salvare il livello corrente. Nessun backend o database.
*   **Audio Policy:** L'audio musicale deve partire *solo* dopo la prima interazione dell'utente (click/tap sul pulsante "Start" o selezione del personaggio) per aggirare le policy di Safari su iOS.

## 2. Controlli e Responsive Design

*   **Desktop:** Frecce direzionali (Sx/Dx) per il movimento, Barra Spaziatrice o Freccia Su per il salto.
*   **Mobile (UI in sovrimpressione):** 
    *   Pad virtuale in basso a sinistra (pulsanti freccia Sinistra e Destra).
    *   Pulsante "Salto" in basso a destra.
    *   *Nota per l'AI:* I pulsanti touch devono avere un'area di hit (padding) generosa per facilitare l'uso su schermo touch e sfruttare eventi `touchstart` / `touchend`.
*   **Scaling:** Il canvas di Kaplay deve adattarsi proporzionalmente allo schermo, mantenendo un aspect ratio ottimizzato per orientamento landscape (orizzontale).

## 3. Gestione Personaggio e Skin (Sprite System)

La meccanica principale prevede la sovrapposizione di "livelli" (layer) di abbigliamento sullo sprite di base man mano che si superano i livelli.
Per facilitare il rendering in Kaplay, si consiglia di usare sprite con le stesse identiche dimensioni (es. 32x32 o 64x64) con sfondo trasparente, renderizzandoli nello stesso punto.

**Schermata di Selezione Personaggio (Start Screen):**
Tre opzioni iniziali:
1.  **"Anna" (La Protagonista):** Basata sulle reference fotografiche. Capelli castani mossi di media lunghezza, giubbotto piumino color carta da zucchero (azzurro/lilla), jeans blu scuro, sneakers bianche, piccola borsa a tracolla blu scuro.
2.  **"La Sognatrice":** Stile paesana (ispirata a Belle/Ariel umana).
3.  **"L'Avventuriera":** Stile nomade/viaggiatrice (ispirata a Jasmine/Mulan).

**Progressione Skin (Uguale per tutte):**
*   *Inizio:* Abito casual (scelto in Start Screen).
*   *Dopo Livello 1:* Aggiunta layer **Gonna Reale**.
*   *Dopo Livello 2:* Aggiunta layer **Corpetto Elegante**.
*   *Dopo Livello 3:* Aggiunta layer **Gioielli (Collana)**.
*   *Dopo Livello 4:* Aggiunta layer **Corona Reale**.

## 4. Game Design e Livelli (Progressione)

Il gioco non prevede "Game Over" o vite finite. Se il personaggio cade in un burrone o tocca un nemico, il livello si riavvia dall'inizio (le monete raccolte vengono mantenute o ripristinate, ma si riparte dal punto di spawn del livello). Difficoltà: Facile/Casual.

| Livello | Tema / Vibe | Ostacoli e Nemici | Collezionabili | Premio Fine Livello |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Foresta Incantata** (Bosco magico, verde scuro, alberi alti) | Rovi spinosi a terra, fiumi da saltare. | Mele d'oro | Gonna Reale |
| **2** | **Abissi di Corallo** (Sottomarino, bolle, blu e corallo) | Granchi in pattuglia, ricci di mare. | Perle luccicanti | Corpetto Elegante |
| **3** | **Tetti d'Oriente** (Città araba al tramonto, tetti a cupola) | Pappagalli in volo, buchi tra i tetti. | Lampade magiche | Gioielli (Collana) |
| **4** | **Cime Innevate** (Montagna di ghiaccio, azzurro e bianco) | Stalattiti che cadono, pupazzi/palle di neve. | Cristalli di ghiaccio| Corona |

### Il Gran Finale (Livello 5 - Scena non giocabile)
*   **Vibe:** Sala da ballo maestosa, lampadari di cristallo, tappeto rosso.
*   **Azione:** Il personaggio (Anna) appare al centro, con tutte le skin sbloccate (la "Principessa Perfetta"). Nessun nemico.
*   **Effetti:** Musica romantica/trionfale. Una pergamena a schermo con un messaggio personalizzato di vittoria.

---