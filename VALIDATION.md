# Validation — version 3

- 21 tests réussis : mêmes droits pour MLK/GK/EK, stock, emplacements personnalisés, seuils individuels, dictée, historique, corrections, écritures sans doublons, sessions temporaires et suggestions avec lecture EK.
- Version 3 déployée sur l’URL Google existante. Accès « Tout le monde » activé avec l’accord explicite du propriétaire ; manifeste ANYONE_ANONYMOUS vérifié dans Google. Le classeur reste privé.
- Interface Google vérifiée avec GK : ajout et gestion des emplacements accessibles ; cinq animations et message Bon appétit ; suggestions et aide disponibles.
- Deux GIF d’aide à quatre étapes (17,6 secondes chacun), lisibles et arrêtables ; instructions numérotées pour débutants et accès direct depuis Mes plats. Lecture du GIF vérifiée dans Google.
- Aucun emplacement, plat ou suggestion fictif ajouté aux données réelles.
- 32 fichiers synchronisés sur GitHub ; publication GitHub Actions réussie avant la dernière mise à jour documentaire et du manifeste.
- Page d’installation vérifiée : https://etiennekepeklian-max.github.io/miam-maman/

## Mise à jour légumes non cuisinés

- 33 tests réussis : pièces, grammes, kilos, précision des retraits et annulations, rejet des unités invalides, compatibilité avec les anciens plats, projection Google Sheet et mêmes droits pour tous.
- Essai navigateur isolé : ajout de 1,5 kg de carottes, seuil à 0,5 kg, retrait de 0,25 kg puis annulation (retour à 1,5 kg). Aucun essai dans le stock partagé.
- Version 4 Google publiée, sans changement de classeur ni de droits. Interface complète publiée sur GitHub ; connexion EK au stock réel vérifiée, avec conservation de la préparation existante.

- 36 illustrations de plats et 18 de légumes : toutes acceptées par les règles serveur.
- Dictée : nom sans quantité, parts, pièces, kilos décimaux et seuils en grammes ; états intermédiaires, erreur dans le formulaire et secours avec micro du clavier. Événements du moteur testés avec simulation ; capture audio réelle à essayer sur le téléphone.
- Connexion GitHub → Google testée sur les identifiants de page, l’origine et la source des réponses ; HTML Google de connexion valide.

- Dans le formulaire publié (sans enregistrement réel) : 18 illustrations de légumes, phrase « 1,5 kilos de carottes, alerte à 500 grammes » reprise en kg avec seuil 0,5. La vraie capture audio n’a pas pu être exercée depuis le navigateur de vérification.

## Mise à jour niveaux, fiches, Canva et hors connexion

- 41 tests : niveaux, compatibilité des anciennes fiches, champs complets, quantité concurrente, viande, lots distincts, conservation des auteurs hors ligne, reprise après redémarrage, retour perdu sans doublon et conflits sans stock négatif.
- Parcours navigateur isolé avec vrai IndexedDB : deux niveaux créés manuellement, ajout hors connexion de 3 paquets de lardons avec personnes/commentaires, rechargement, retrait de 1 paquet, nouveau rechargement, retour simulé du réseau, confirmation « Stock partagé à jour » et stock de 2 paquets.
- Modification dans la copie de test : nom, illustration, niveau et quantité ; formulaire de réapprovisionnement prérempli, quantité nouvelle à 1 et date propre. 25 illustrations Canva inspectées à l’écran.
- Aucun essai dans le classeur réel. La coupure réseau du téléphone en cave et la vraie capture audio restent à essayer sur l’appareil.

- Service Google version 6 publié sur le déploiement existant le 30 octobre 2026, accès et URL inchangés.
