# Lingua Isla

En statisk PWA for GitHub Pages som oversatter mellan svenska, filipinska och Bisaya/Cebuano med rostinmatning.

## Funktioner

- Web Speech API for mikrofonstyrd inmatning.
- OpenAI som huvudprovider for oversattning.
- OpenAI text-till-tal for upplasning, med fallback till browserrost.
- PWA med manifest och service worker.
- Lokal lagring av API-nyckel per enhet for `bring your own key`.
- LibreTranslate-kompatibelt fallback-lage for sprak som inte kraver Cebuano.

## Publicera pa GitHub Pages

1. Skapa ett repo och ladda upp filerna i denna mapp.
2. Pusha till `main`. Workflow-filen i `.github/workflows/deploy-pages.yml` publicerar sedan appen till GitHub Pages.
3. Om du vill använda OpenAI:
   - Skapa en API-nyckel i OpenAI Platform.
   - Klistra in nyckeln i appens installningar pa den enhet som ska anvanda appen.
   - Varje anvandare anger sin egen nyckel lokalt pa sin egen enhet.

## Viktigt om OpenAI

OpenAI rekommenderar att vanliga API-nycklar inte exponeras i klientkod. Den har appen ar darfor byggd for personligt bruk eller `bring your own key`, dar varje anvandare lagrar sin egen nyckel lokalt pa sin enhet.
