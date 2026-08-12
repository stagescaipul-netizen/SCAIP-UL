# Correction validation différée

Cette version applique un pipeline unique à toute validation : génération des PDF, stockage Supabase, mise à jour du statut et envoi de l'email.

La tâche Netlify planifiée appelle désormais `/api/cron/validation-differee`, qui sélectionne les demandes arrivées à échéance puis exécute `finaliserDemande()` pour chacune. L'ancienne RPC SQL qui changeait seulement le statut n'est plus utilisée par la tâche planifiée.

Variables Netlify obligatoires pour la validation différée :

- `CRON_SECRET` : valeur aléatoire longue, sans espaces.
- `NEXT_PUBLIC_APP_URL=https://stage-scaip-ul.netlify.app`

Netlify fournit normalement automatiquement `URL`. `NEXT_PUBLIC_APP_URL` reste nécessaire pour les QR codes.
