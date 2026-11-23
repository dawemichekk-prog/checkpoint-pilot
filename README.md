# Checkpoint Pilot ✈️

Jednoduchá 2D arkádová hra do prohlížeče postavená v HTML5 Canvas a čistém JavaScriptu (ES moduly) bez externích závislostí a bez buildu.

Pilotuješ letadlo, prolétáváš kruhovými branami (checkpointy) a doplňuješ tak palivo, abys doletěl co nejdál.

## Ovládání

| Akce | Klávesnice | Mobil / dotyk |
| :--- | :--- | :--- |
| Stoupat (nos nahoru) | `↑` / `W` / `Mezerník` | Držet prst na ploše |
| Klesat (nos dolů) | `↓` / `S` | Pustit prst (plachtění) |
| Turbo (3× spotřeba paliva) | `Shift` | Tlačítko **TURBO** vpravo dole |
| Pauza | `P` / `Esc` | Tlačítko pauzy vpravo nahoře |

## Herní mechaniky

- **Checkpointy a palivo:** Průlet bránou přidá **+100 bodů** a doplní palivo. Průlet středem (vnitřní přerušovaný kruh) je **PERFECT** za **+250 bodů** a větší dávku paliva.
- **Combo násobič:** Série úspěšných průletů zvyšuje násobič **×1 → ×2 → ×3 → ×5**. Minutí brány combo vynuluje.
- **Překážky a životy:** Začínáš se **3 životy**. Náraz do ptáků nebo horkovzdušných balonů (od 3. úrovně) ubere 1 život. Náraz do horského terénu nebo bouřkového mraku (nebo pád po vyčerpání paliva) let ukončí.
- **Power-upy:**
  - 🛡️ **Štít** — pohltí jeden náraz
  - ⛽ **Kanystr** — doplní nádrž na 100 %
  - 🧲 **Magnet** — na 8 sekund přitahuje letadlo ke středu další brány
- **Úrovně a denní doba:** Každých 10 bran zvedne úroveň (vyšší rychlost, menší brány, hustší překážky) a střídá denní dobu (**Den → Západ slunce → Noc**).
- **Nejlepší skóre a zvuk:** Rekord i nastavení ztlumení se ukládají do `localStorage`. Zvuky i vrnění motoru generuje Web Audio API.

## Spuštění lokálně

Protože hra používá nativní ES moduly (`<script type="module">`), spusť ji přes jakýkoli lokální HTTP server (prohlížeče blokují ES moduly přes `file://`):

```bash
python3 -m http.server 8000
```

Poté otevři v prohlížeči `http://localhost:8000`.

## Testy

Unit testy herní logiky (fyzika, skóre, palivo, combo, kolize, generování světa) nevyžadují žádné externí balíčky:

```bash
npm test
# nebo přímo
node --test tests/*.test.js
```

## Nasazení (GitHub Pages)

Součástí repozitáře je workflow `.github/workflows/pages.yml`, které po mergnutí do `main` spustí testy a automaticky nasadí hru na GitHub Pages (stačí v *Settings → Pages → Source* vybrat **GitHub Actions**).
