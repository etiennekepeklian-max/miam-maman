# Miam Maman !

Une petite application familiale pour enregistrer les plats préparés par Maman, leurs portions, leur date et leur emplacement, puis déclarer les portions prises pour les repas.

## État de livraison

Le dépôt a été recréé le 28 octobre 2026 pour recevoir l’intégralité des sources, des tests et du déploiement GitHub Pages. L’interface et le service Google Apps Script sont implémentés ; les 14 tests locaux passent.

GitHub Pages doit héberger la page d’entrée installable, qui ouvre ensuite le stock servi par Google Apps Script. Le workflow refuse de publier tant que la variable `MIAM_GOOGLE_WEBAPP_URL` ne contient pas une URL Google `/exec`. Sans cette configuration, le build manuel produit un aperçu local explicitement signalé.

Le Google Sheet a été créé : https://docs.google.com/spreadsheets/d/1_yC0fdQKQWo84xmK01QVIOPFqHTZF5Ve0mXycFqk3_A

Le déploiement Google Apps Script et la configuration des codes des comptes nécessitent encore la connexion du propriétaire à Google. Le stock partagé et les connexions réelles ne sont pas activés tant que ces étapes ne sont pas terminées.

## Utilisation

- **Maman** ajoute les préparations, leurs quantités et leurs emplacements, choisit un seuil d’alerte, déplace les plats et gère les emplacements.
- **Famille** consulte le même stock, déclare les portions prises et peut annuler une prise pendant 24 heures.
- **Aucun emplacement prédéfini**. Ils sont créés par la famille depuis le compte Maman. La suppression est refusée si des portions y sont encore rangées. Les anciens noms restent dans l’historique.
- Saisie écrite ou dictée française. La dictée remplit le formulaire, sans enregistrement automatique. Elle dépend du navigateur et de son service de reconnaissance. Le micro du clavier constitue une alternative.
- Une préparation correspond à un lot avec sa date et son emplacement. Deux lots du même plat peuvent être rangés à deux endroits différents.
- Les alertes sont visibles dans l’application. Aucune notification en dehors de l’application n’est annoncée.

## Activation du stock partagé Google Sheets

1. Ouvrir le Google Sheet ci-dessus, puis **Extensions → Apps Script**.
2. Copier les fichiers de `google-apps-script/` dans le projet lié à ce classeur : `Code.gs`, `Core.gs`, `Index.html` et `appsscript.json` (activer l’affichage du manifeste dans les paramètres du projet).
3. Enregistrer puis recharger le Google Sheet. Choisir **Miam Maman ! → Configurer les deux comptes**. Le propriétaire choisit lui-même deux codes différents d’au moins six caractères. Aucun code par défaut n’est fourni.
4. Déployer une **Application Web**, exécutée par le propriétaire. L’accès au point d’entrée doit permettre aux membres de la famille d’ouvrir l’URL ; chaque opération sur les données exige ensuite une session Maman ou Famille valide.
5. Partager l’URL du déploiement et le code **Famille** avec les proches. Le code **Maman** reste destiné à la personne qui gère les préparations.
6. Tester la connexion des deux comptes, créer un emplacement choisi par la famille, enregistrer un plat puis retirer une portion depuis un autre appareil. Tant que ce test n’a pas été effectué, la synchronisation réelle n’est pas vérifiée.

Le propriétaire doit approuver lui-même les autorisations Google du script. Aucun compte Google ni document existant n’est rendu public ; seuls les plats de cette application sont exposés derrière ses deux accès.

## Architecture

Le client utilise `google.script.run` lorsqu’il est servi par Apps Script. L’aperçu statique utilise un adaptateur local distinct et clairement signalé. Il ne permet pas d’atteindre le Google Sheet.

Le journal du Google Sheet est la source des données. Les onglets Stock et Emplacements sont des vues reconstruites à partir du journal. Ils ne doivent pas être modifiés manuellement pour changer le stock. Les données sont lisibles et les textes sont protégés contre l’injection de formules. La colonne technique du journal conserve l’événement complet pour reconstruire l’état.

Les autorisations sont validées côté serveur. Les codes sont protégés par HMAC avec un secret distinct conservé dans les propriétés privées du script. Les sessions sont temporaires et les tentatives de connexion sont limitées. Aucun code ni jeton n’est inclus dans le dépôt ou le client. Les écritures sont protégées par un verrou de script et un identifiant d’opération pour éviter les retraits en double.

Limites : petit usage familial, journal limité à 20 000 événements, synchronisation toutes les 30 secondes lorsque l’application est visible. Pas de mode hors connexion pour les écritures partagées. Le comportement réel de la dictée sur les téléphones et dans le cadre Apps Script reste à vérifier après activation.

## Développement

Node.js suffit, sans dépendances :

```sh
npm test
npm run build
```

`src/` contient le HTML, les styles, le client et les règles communes. Le build produit `dist/index.html` et les fichiers intégrés pour Apps Script. `tests/` vérifie les droits, les quantités, la suppression et le déplacement d’emplacements, l’annulation, la limitation de connexion et la protection contre les doubles envois.

Les quatre fichiers directement importables dans Apps Script sont dans `google-apps-script/`. La procédure de mise en ligne est dans [REPRISE-CE-SOIR.md](REPRISE-CE-SOIR.md).

Mascotte originale créée pour ce projet avec l’outil de génération d’images, à partir de la maquette validée. Palette : crème, corail, sauge et vert profond.

Documentation technique consultée :
- https://developers.google.com/apps-script/reference/lock/lock-service
- https://developers.google.com/apps-script/guides/html/reference/run
- https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
