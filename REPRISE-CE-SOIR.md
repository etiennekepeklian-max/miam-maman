# Publication et activation

Le dépôt public contient l’intégralité des sources, la distribution, les tests et le workflow GitHub Pages. La version utilise trois profils sans mot de passe, avec les mêmes possibilités : MLK, GK et EK.

## Mettre à jour

1. Exécuter les tests et le build avec la variable `MIAM_GOOGLE_WEBAPP_URL` du déploiement existant.
2. Mettre à jour les fichiers `Code.gs`, `Core.gs`, `Index.html` et `appsscript.json` du projet Google lié au classeur familial.
3. Modifier le déploiement Google existant, choisir **Nouvelle version**, puis déployer. Conserver son URL `/exec` et son exécution par le propriétaire.
4. L’accès Google conservé est initialement **Moi uniquement**. Avant le passage à **Tout le monde**, obtenir l’accord explicite du propriétaire : toute personne disposant du lien pourra choisir un profil, lire et modifier le stock selon ce profil. Aucun mot de passe ne protège les profils.
5. Envoyer les sources sur GitHub. Le workflow utilise `MIAM_GOOGLE_WEBAPP_URL` et publie la page d’entrée sur GitHub Pages.
6. Vérifier les trois profils et les seuils d’alerte. Ne créer aucun emplacement réel à la place de la famille.

## État des données

Le journal existant est conservé. Les nouvelles opérations indiquent MLK, GK ou EK. Les anciens événements sans profil restent lisibles. L’onglet Comptes est actualisé avec les trois noms à la première sélection d’un profil. Il ne contient aucun mot de passe.
