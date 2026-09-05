# Håndballdagbok – separat GitHub Pages-utgave

Dette er en statisk Vite/React-utgave av STHK 2015 Sesongdagbok. Den er klargjort for GitHub Pages og et eget Supabase-prosjekt. Den deler verken database, innlogging eller kode med Treningsdagbok-2.0 eller Medvirk.

## Status

- Frontend er flyttet ut av ChatGPT Sites og bygger som statiske filer.
- Alle eksisterende visninger og arbeidsflater er bevart.
- Innlogging går direkte til Supabase Auth med en publishable key.
- Lesing og skriving går gjennom rollefiltrerte RPC-funksjoner. Datatabellene er ikke direkte tilgjengelige fra nettleseren.
- Alle 253 rader fra de 12 eksisterende Sites-tabellene er eksportert og gjort om til en reproducerbar SQL-import.
- Den eksisterende Sites-versjonen er ikke endret eller publisert på nytt.
- Eget Supabase-prosjekt er opprettet på Free-plan og dataene er importert.
- Repositoryet er separat fra både Treningsdagbok-2.0 og Medvirk, og GitHub Pages publiseres fra `main`.

## Lokal kontroll

```bash
npm ci
npm run build
npm run dev
```

## Kontrollert aktivering

1. Ivan og Espen velger nye passord fra innloggingssiden. Godkjenningsradene kobles automatisk til ny Auth-ID ved første innlogging.
2. Test administrator, forelder og kampregistrator mot Pages-adressen.
3. Kontroller radantall, kampresultater, klokke, bytter, kort, redninger, treninger, oppmøte og tilgangsregler.
4. Behold Sites-utgaven som sikkerhetskopi til kontrollen er godkjent.

## Sikkerhetsmodell

Alle tabeller har RLS aktivert, og `anon`/`authenticated` har ingen direkte tabelltilgang. `season_snapshot()` filtrerer innhold etter rollen `admin`, `parent` eller `match_registrar`. `season_action(payload)` validerer rolle, kamptildeling og låsestatus før endringer utføres. Bare disse RPC-funksjonene er åpnet for innloggede brukere; service-role-nøkkel brukes ikke i frontend.

Produksjonseksporten og dataimporten med personopplysninger er bevisst utelatt fra det offentlige repositoryet.
