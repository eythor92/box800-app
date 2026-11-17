# BOX800 app

Bókanir, biðlisti, æfingar dagsins, mæting, þjálfarasýn og stjórnborð eiganda.
Ein vefsíða sem virkar líka sem app í símanum (PWA: „Bæta við heimaskjá“).

## Uppbygging
- `src/` – appið (React + Vite). Iðkendur `/`, þjálfarar `/#/thjalfari`, eigandi `/#/stjorn`.
- `supabase/migrations/` – gagnagrunnur og allar reglur (bókanir, biðlisti, réttindi).
  - `005_results.sql` skor, hreyfingar, saga og stigatafla
  - `001_init.sql` töflur, reglur og föll · `002_seed.sql` námskeið og föst tímatafla · `003_cron.sql` sjálfvirk verk
- `supabase/test/test.mjs` – prófar reglurnar (`node supabase/test/test.mjs`).
- Án Supabase-stillinga keyrir appið í **prófunarútgáfu** sem keyrir sama SQL í vafranum.

## Uppsetning (einu sinni)
1. Supabase → SQL Editor: keyra `001_init.sql`, svo `002_seed.sql`. (Database → Extensions: kveikja á `pg_cron`, keyra `003_cron.sql`.)
2. Supabase → Authentication → URL Configuration: Site URL = slóð appsins.
3. Supabase-slóð og opinber (publishable) lykill eru í `.env.production` – þau mega vera opinber, aðgangsreglurnar eru í gagnagrunninum.
4. GitHub → Settings → Pages → Source: **GitHub Actions**.
5. Eigandi skráir sig inn í appið og keyrir svo í SQL Editor:
   `update profiles set role = 'owner' where email = '<netfang eiganda>';`
   Þjálfarar: `update profiles set role = 'coach' where email = '...';`

## Þróun
```
npm install
npm run dev        # prófunarútgáfa ef .env.local vantar
node supabase/test/test.mjs
```

## Stöðvarskjár
- `#/kiosk` opnar stöðvarskjáinn: veldu sniðmát (Innskráning, Æfing, eða bæði hlið við hlið). Tækið man valið.
- Beinar slóðir: `#/kiosk?t=innskraning` (innskráningartölva), `#/kiosk?t=aefing` (sjónvarp), `#/kiosk?t=baedi`.
- Hver gluggi hefur stærðarsleða, og hægt er að draga skilrúmið á milli glugga.
- Þarf innskráðan þjálfara eða eiganda. Ef 001 var keyrt áður en kiosk kom: keyra `004_kiosk.sql`.
