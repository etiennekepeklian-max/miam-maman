# Publication de Miam Maman

Le dépôt public `etiennekepeklian-max/miam-maman` a été recréé le 28 octobre 2026. Il contient les sources, les tests, les fichiers Google Apps Script et le workflow GitHub Pages.

## Architecture

GitHub Pages héberge une page d’entrée installable sur téléphone. Son bouton ouvre l’application exécutée par Google Apps Script, qui écrit dans le Google Sheet. Les écritures partagées nécessitent Internet. L’icône installée ouvre la page d’entrée, puis le bouton ouvre le stock Google.

Sans URL Google, `npm run build` produit un aperçu local explicitement signalé. Le workflow de publication exige l’URL et refuse de publier cet aperçu comme un stock partagé.

## Activation restante

1. Ouvrir le classeur familial indiqué dans le README, puis **Extensions → Apps Script** pour retrouver le projet lié.
2. Vérifier les quatre fichiers de `google-apps-script/` et enregistrer. Le propriétaire examine et approuve les autorisations Google nécessaires.
3. Recharger le classeur et choisir **Miam Maman ! → Configurer les deux comptes**. Choisir deux codes différents d’au moins six caractères. Ne jamais les mettre dans le dépôt.
4. Déployer une **Application Web**, exécutée par le propriétaire. Le manifeste conservé limite actuellement l’entrée à ce propriétaire (`MYSELF`). L’accès de la famille doit être configuré avec l’accord explicite du propriétaire ; le serveur vérifie ensuite les deux comptes pour toutes les données.
5. Copier l’URL définitive terminée par `/exec`, puis vérifier la connexion et une vraie écriture/lecture dans le classeur. Aucun emplacement n’est créé par défaut.
6. Dans le dépôt GitHub, **Settings → Secrets and variables → Actions → Variables**, créer `MIAM_GOOGLE_WEBAPP_URL` avec cette URL. Ne pas y mettre de code d’accès.
7. Dans **Settings → Pages**, choisir **GitHub Actions** comme source.
8. Lancer **Actions → Publier Miam Maman → Run workflow**. Les mises à jour de `main` relanceront ensuite le déploiement.
9. Vérifier le succès du workflow, ouvrir l’URL Pages retournée et toucher **Ouvrir le stock familial**. Tester depuis deux appareils avant de déclarer la synchronisation opérationnelle.

## Validation

Les 14 tests locaux passent. Ils vérifient les droits, les quantités, les emplacements, l’annulation, les sessions et les doubles envois. La publication GitHub du code ne suffit pas à activer les autorisations Google ni le partage familial.
