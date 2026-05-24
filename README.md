# Lingua Isla

En statisk PWA for GitHub Pages som oversatter mellan svenska, filipinska och Bisaya/Cebuano med rostinmatning.

## Funktioner

- Web Speech API for mikrofonstyrd inmatning.
- Text-till-tal via `speechSynthesis`.
- PWA med manifest och service worker.
- Google Cloud Translation som huvudspår for Bisaya/Cebuano.
- LibreTranslate-kompatibelt fallback-lage for sprak som inte kraver Cebuano.

## Publicera pa GitHub Pages

1. Skapa ett repo och ladda upp filerna i denna mapp.
2. Pusha till `main`. Workflow-filen i `.github/workflows/deploy-pages.yml` publicerar sedan appen till GitHub Pages.
3. Om du vill använda Google Cloud:
   - Skapa en API-nyckel for Cloud Translation.
   - Begransa nyckeln till din framtida GitHub Pages-domän.
   - Klistra in nyckeln i appens installningar pa din egen enhet.

## Viktigt om Bisaya

Bisaya/Cebuano ar den svaraste delen att fa att fungera fran en ren statisk klient. Därfor har appen byggts sa att Google Cloud Translation ar det primara valet nar Bisaya behovs.
