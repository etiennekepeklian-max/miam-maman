# Miam Maman !

Le stock des petits plats de la maison : leurs portions, leur date, leur emplacement et leur seuil d’alerte.

## Trois profils, sans mot de passe

- **MLK**, **GK** et **EK** ont exactement les mêmes possibilités : ajouter des plats, prendre des portions, modifier les seuils et gérer les emplacements.
- Le profil choisi est mémorisé sur l’appareil et apparaît dans l’historique. Les initiales indiquent l’auteur de chaque action ; elles ne changent pas les droits.

Ces profils ne sont pas une authentification. Lorsque le déploiement Google est accessible à tout le monde, toute personne qui possède le lien peut choisir n’importe lequel des trois profils, consulter le stock et utiliser ses fonctions. Aucun mot de passe ni compte Google n’est alors nécessaire pour les visiteurs. Le classeur Google lui-même reste privé.

## Les plats et les emplacements

Aucun emplacement ni plat n’est créé par défaut. Chaque profil crée les emplacements depuis **La maison** et peut les supprimer lorsqu’ils sont vides. Pour supprimer un emplacement occupé, déplacer d’abord les préparations vers un autre emplacement. Les anciens noms sont conservés dans l’historique.

Chaque préparation possède un **stock d’alerte en portions**, choisi à l’ajout puis modifiable depuis le bouton **⋯** de sa fiche. Le seuil est toujours affiché. Le plat apparaît dans **Bientôt fini** lorsque le nombre de portions restantes est inférieur ou égal au seuil ; les plats à zéro figurent dans **Terminés**. Il s’agit d’une alerte visible dans l’application, sans notification externe.

La saisie fonctionne au clavier et par dictée française. Exemple : « Six portions de lasagnes dans [votre emplacement], alerte à deux portions ». La dictée remplit le formulaire ; vérifier avant d’enregistrer. Le micro du clavier du téléphone est disponible en alternative si le navigateur ne propose pas la reconnaissance vocale.

Tout le monde peut corriger une prise pendant 24 heures ; l’historique indique le profil qui l’a prise et celui qui l’a annulée. Les écritures sont sérialisées et un identifiant d’opération évite de retirer deux fois une portion après un incident réseau.

## La cocotte et les suggestions

Cinq animations sont proposées dans **La maison** : Coucou !, La danse du chef, Cuisiné avec amour, La cuillère magique et À table !. Chaque appareil peut choisir une animation pour l’ouverture, un ajout et une prise. Une prise de plat souhaite « Bon appétit » ; une prise de légumes souhaite « Bonne cuisine ». Les préférences de réduction des mouvements sont respectées.

La section **Vos idées** permet aux trois profils de déposer une suggestion et de consulter les idées. Le texte complet des nouvelles suggestions apparaît dans une fenêtre du profil EK, à l’ouverture ou pendant son utilisation (actualisation toutes les 30 secondes). Pas de mail ni de notification lorsque l’application est fermée. Les suggestions sont conservées dans le journal et l’onglet Suggestions du classeur.

## Aide

La section **Aide** explique l’ajout et la prise en quatre étapes chacun, avec deux GIF illustrés déclenchés volontairement et arrêtables. Les explications écrites restent disponibles sans animation. Les exemples sont fictifs et ne créent aucune donnée dans le stock. Les GIF sont intégrés au client Google, sans hébergeur d’images externe.

## Illustrations et dictée

25 illustrations génériques créées avec Canva, communes aux plats, légumes et viandes, avec libellés accessibles. Les anciens choix restent compatibles. La dictée française montre les résultats intermédiaires, remplit aussi le nom sans quantité et accepte les parts, pièces et poids décimaux. Les erreurs et le délai sans réponse sont visibles dans le formulaire. Le champ **Votre phrase dictée ou écrite** permet d’utiliser le micro du clavier du téléphone ; **Remplir les champs avec cette phrase** reprend le texte sans enregistrer le stock automatiquement. Les tests simulent les événements du moteur ; une vérification de la vraie capture audio sur le téléphone reste nécessaire.

## Légumes non cuisinés

Tous les profils peuvent toucher **Ajouter des légumes**, choisir un comptage en pièces, grammes ou kilos (jusqu’à trois décimales), puis indiquer quantité, date de rangement, emplacement et seuil d’alerte dans la même unité. Le filtre **Légumes non cuisinés** les retrouve. **Je me sers** retire une quantité et souhaite bonne cuisine ; l’annulation et l’historique gardent l’unité. Les plats déjà enregistrés restent en portions. Un ajout représente un nouveau lot ; le transfert automatique de légumes vers un plat cuisiné n’est pas effectué.

## Hébergement et installation

GitHub Pages héberge l’interface complète installable : https://etiennekepeklian-max.github.io/miam-maman/

L’interface GitHub communique avec Google Apps Script par une fenêtre intégrée de connexion au stock. La page principale peut utiliser la reconnaissance vocale du navigateur ; la page Google directe ne délègue pas le microphone. La connexion accepte uniquement l’origine GitHub de la famille, un identifiant de page et les opérations prévues, puis applique les règles de stock sur le serveur. Les plats et légumes sont enregistrés dans le même classeur Google familial. Une première ouverture avec Internet permet de conserver le stock sur le téléphone. Les fichiers du service Google sont dans `google-apps-script/`.

Le workflow **Publier Miam Maman** construit et publie `dist/`. Il exige une variable de dépôt `MIAM_GOOGLE_WEBAPP_URL` contenant l’URL Google définitive terminée par `/exec`. Sans cette variable, il refuse de publier un aperçu local comme stock partagé.

Le propriétaire configure le déploiement Google **exécuté en tant que propriétaire**. L’ouverture aux visiteurs sans compte Google utilise l’option **Tout le monde**, uniquement avec son accord explicite sur l’accès sans mot de passe décrit plus haut. Une mise à jour du code nécessite de modifier le déploiement Google existant et de sélectionner **Nouvelle version**.

Les instructions d’installation Android et iPhone sont dans [INSTALLATION.md](INSTALLATION.md).

## Développement

Node.js suffit, sans dépendances :

```sh
npm test
npm run build
```

`src/` contient le client, les styles et les règles communes. Le build produit `dist/` et les fichiers intégrés pour Apps Script. Sans URL Google, le build manuel produit un aperçu local clairement identifié. Le journal du Google Sheet est la source des données ; Stock et Emplacements sont ses vues reconstruites. Ne pas modifier ces onglets manuellement pour ajuster les portions.

Limites : petit usage familial, journal limité à 20 000 événements, actualisation toutes les 30 secondes lorsque l’application est visible. Les sessions techniques temporaires conservent le profil choisi, sans en vérifier l’identité.

## Niveaux, modifications et réapprovisionnement

Les emplacements ont un niveau facultatif : rez-de-chaussée, sous-sol ou nom libre. Le choix d’un rangement se fait en deux étapes : niveau puis emplacement. Les anciens rangements restent sous « Niveau à préciser ». Aucun emplacement n’est ajouté automatiquement. La maison permet de renommer et reclasser un rangement, et de le supprimer lorsqu’il est vide.

Toutes les fiches permettent de modifier nom, illustration, date, quantité, unité compatible, emplacement, repère, seuil, nombre de personnes facultatif et commentaires. Une correction de quantité vérifie le stock attendu pour éviter d’écraser une prise concurrente. « + Ajouter du stock » reprend les informations dans un nouveau lot avec sa propre date ; l’ancien lot est conservé, y compris avant la rupture.

La catégorie Viande accepte les pièces, paquets, grammes et kilos pour la viande, le jambon et les lardons.

## Hors connexion

Après une première ouverture avec Internet et connexion au stock partagé, l’application GitHub conserve son interface dans le service worker et le dernier stock dans IndexedDB. Les actions sont écrites durablement avant l’envoi, avec leur auteur et leur identifiant stable. Elles survivent au rechargement et sont envoyées dans l’ordre au retour du réseau, lorsque l’application est ouverte ou à sa prochaine ouverture. Le serveur Google valide chaque opération et reste la source du stock partagé.

Un retour perdu n’entraîne pas de double retrait. Un conflit (stock insuffisant, correction concurrente, emplacement occupé) bloque la suite et s’affiche explicitement. Les envois rejetés peuvent être réessayés ou retirés après vérification. Un envoi sans réponse ne peut pas être supprimé arbitrairement, car il peut avoir déjà été reçu. Le stock hors ligne est le dernier connu de cet appareil, pas un stock partagé en temps réel. Ne pas effacer les données du navigateur avant synchronisation. La dictée peut nécessiter Internet ; le clavier reste disponible. La page Google de secours nécessite Internet.
