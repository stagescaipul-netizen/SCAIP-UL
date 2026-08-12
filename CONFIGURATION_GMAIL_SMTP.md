# Configuration Gmail SMTP sur Netlify

Ajoutez les variables suivantes dans Netlify :

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=votre-adresse@gmail.com
SMTP_PASS=votre-mot-de-passe-application-google
MAIL_FROM="SCAIP-UL <votre-adresse@gmail.com>"
```

Important :

- `SMTP_PASS` doit contenir le mot de passe d'application Google de 16 caractères, sans espaces.
- N'utilisez pas le mot de passe normal du compte Gmail.
- Ne placez jamais ces valeurs secrètes directement dans le code ou dans Git.
- Supprimez les anciennes variables `RESEND_API_KEY` et `RESEND_FROM_EMAIL` de Netlify.

Après modification des variables, déclenchez un nouveau déploiement Netlify.
