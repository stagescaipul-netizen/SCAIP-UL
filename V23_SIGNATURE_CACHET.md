# V23 — Signature et cachet

## À faire avant le déploiement

1. Ouvrir Supabase > SQL Editor.
2. Exécuter `database/migrations/0024_authentification_documents.sql`.
3. Déployer ensuite cette version du projet.
4. Dans `Agent > Identité institutionnelle`, choisir :
   - **Signature + Cachet** : téléverser les deux images séparément ; ou
   - **Image combinée** : téléverser une seule image contenant les deux.

La génération des nouveaux PDF est bloquée avec un message clair si les images requises par le mode sélectionné sont absentes.

Les anciens PDF ne sont jamais modifiés.
