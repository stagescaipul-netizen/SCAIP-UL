# Faire tourner le projet pour de vrai — guide minimal

Ce document liste uniquement ce qui est nécessaire pour passer du code au
premier test réel dans un navigateur. Rien d'autre.

## 1. Créer le projet Supabase (10-15 minutes)

1. Aller sur supabase.com, créer un compte gratuit.
2. Créer un nouveau projet.
3. Dans l'éditeur SQL du projet, exécuter les 7 fichiers du dossier
   `database/migrations/`, **dans l'ordre numérique** (0001 à 0007) —
   copier-coller le contenu de chaque fichier, un par un.
4. Dans Storage, créer deux buckets : `justificatifs` et `documents`.
5. Dans Project Settings → API, récupérer :
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_ROLE_KEY`

## 2. Créer un agent de test

Dans Authentication → Users, créer un utilisateur (email + mot de passe).
Puis dans l'éditeur SQL :

```sql
insert into teacher (nom_complet, email_professionnel, auth_user_id, est_admin, est_admin_principal)
values ('Dr Amara KEITA', 'VOTRE_EMAIL_DE_TEST', 'ID_DE_L_UTILISATEUR_CREE', true, true);
```

L'ID de l'utilisateur se trouve dans la liste Authentication → Users.

## 3. Créer un minimum de données de référence

```sql
insert into program (nom, departement) values ('Génie Logiciel', 'Informatique');
insert into level (libelle, ordre) values ('L1',1), ('L2',2), ('L3',3), ('M1',4), ('M2',5), ('Doctorat',6);
insert into academic_year (libelle, date_debut, date_fin) values ('2025-2026','2025-09-01','2026-07-31');
```

## 4. Lancer le projet en local

Il faut Node.js installé (version 20 ou plus récente).

```bash
npm install
cp .env.example .env.local
# remplir .env.local avec les 3 valeurs Supabase de l'étape 1
# laisser HCAPTCHA_SECRET_KEY vide pour l'instant — le formulaire
# fonctionnera quand même, la vérification est ignorée si la clé est absente
npm run dev
```

Ouvrir http://localhost:3000/demande pour tester le formulaire étudiant,
http://localhost:3000/connexion pour se connecter en tant qu'agent créé à
l'étape 2, puis http://localhost:3000/agent/demandes pour voir et traiter
les demandes.

## Ce qui ne sera pas encore fonctionnel à ce stade

- Le dépôt du justificatif pointe vers le bucket `justificatifs` — le
  fichier sera bien déposé, mais rien ne le lit ou ne l'affiche encore
  côté agent au-delà d'un lien.
- hCaptcha reste désactivé tant que les clés ne sont pas ajoutées — à
  faire avant une mise en production réelle, pas juste pour tester.
- Aucun email n'est envoyé à l'étudiant — ce lot n'a pas encore été
  construit.
