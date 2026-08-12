# Configuration Brevo SMTP — SCAIP-UL

Dans `.env.local` en développement et dans les variables d'environnement Netlify en production :

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<login SMTP fourni par Brevo>
SMTP_PASS=<clé SMTP fournie par Brevo>
MAIL_FROM="SCAIP-UL <adresse-expediteur-verifiee>"
```

Important : `SMTP_PASS` doit être la clé SMTP Brevo, pas le mot de passe du compte Brevo.
`MAIL_FROM` doit utiliser un expéditeur autorisé/vérifié dans Brevo.

Après modification des variables Netlify, relancer un déploiement afin que les fonctions serveur utilisent les nouvelles valeurs.

En cas d'échec, les logs serveur affichent maintenant `[SCAIP-UL SMTP] Échec de l’envoi` avec le code et la réponse SMTP, sans exposer la clé SMTP.
