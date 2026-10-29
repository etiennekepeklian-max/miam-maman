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

Cinq animations sont proposées dans **La maison** : Coucou !, La danse du chef, Cuisiné avec amour, La cuillère magique et À table !. Chaque appareil peut choisir une animation pour l’ouverture, un ajout et une prise. Une prise souhaite toujours « Bon appétit ». Les préférences de réduction des mouvements sont respectées.

La section **Vos idées** permet aux trois profils de déposer une suggestion et de consulter les idées. Le texte complet des nouvelles suggestions apparaît dans une fenêtre du profil EK, à l’ouverture ou pendant son utilisation (actualisation toutes les 30 secondes). Pas de mail ni de notification lorsque l’application est fermée. Les suggestions sont conservées dans le journal et l’onglet Suggestions du classeur.

## Aide

La section **Aide** explique l’ajout et la prise en quatre étapes chacun, avec deux GIF illustrés déclenchés volontairement et arrêtables. Les explications écrites restent disponibles sans animation. Les exemples sont fictifs et ne créent aucune donnée dans le stock. Les GIF sont intégrés au client Google, sans hébergeur d’images externe.

## Hébergement et installation

GitHub Pages héberge la page d’entrée installable : https://etiennekepeklian-max.github.io/miam-maman/

Le bouton **Ouvrir le stock familial** ouvre l’application exécutée par Google Apps Script. Les plats sont enregistrés dans le classeur Google familial. Une connexion Internet est nécessaire. Les fichiers du service Google sont dans `google-apps-script/`.

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
