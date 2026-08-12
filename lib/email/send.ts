import nodemailer from 'nodemailer';

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} est absente des variables d’environnement.`);
  return value;
}

function getSmtpConfig() {
  // Configuration SMTP explicite. Aucun fallback Gmail : une configuration
  // incomplète doit être visible immédiatement dans les logs du serveur.
  const host = requireEnv('SMTP_HOST');
  const portRaw = requireEnv('SMTP_PORT');
  const secureRaw = requireEnv('SMTP_SECURE').toLowerCase();
  const user = requireEnv('SMTP_USER');
  const pass = requireEnv('SMTP_PASS');
  const port = Number(portRaw);

  if (!Number.isInteger(port) || port <= 0) throw new Error(`SMTP_PORT est invalide : ${portRaw}`);
  if (!['true', 'false'].includes(secureRaw)) throw new Error('SMTP_SECURE doit être true ou false.');

  return { host, port, secure: secureRaw === 'true', user, pass };
}

function getTransporter() {
  const config = getSmtpConfig();
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 20_000,
    greetingTimeout: 20_000,
    socketTimeout: 45_000,
    tls: { servername: config.host },
  });
}

function getFromEmail() {
  const configured = process.env.MAIL_FROM?.trim().replace(/^['"]|['"]$/g, '');
  if (!configured) {
    throw new Error('MAIL_FROM est absente. Utilisez une adresse expéditeur vérifiée dans Brevo.');
  }
  return configured;
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function smtpError(error: unknown) {
  if (!(error instanceof Error)) return error;
  const e = error as Error & { code?: string; response?: string; responseCode?: number; command?: string };
  return { message: e.message, code: e.code, responseCode: e.responseCode, response: e.response, command: e.command };
}

async function sendMail(options: Parameters<ReturnType<typeof getTransporter>['sendMail']>[0]) {
  const config = getSmtpConfig();
  console.info('[SCAIP-UL SMTP] Tentative d’envoi', { host: config.host, port: config.port, secure: config.secure });
  try {
    return await getTransporter().sendMail(options);
  } catch (error) {
    console.error('[SCAIP-UL SMTP] Échec de l’envoi', smtpError(error));
    throw error;
  }
}

export async function envoyerEmailDocumentsPrets(params: {
  destinataire: string;
  dureeValiditeMois: number;
  documentsStageBuffer: Buffer;
}) {
  const destinataire = params.destinataire?.trim();
  if (!destinataire) throw new Error("L'adresse email du destinataire est vide.");

  const html = `
    <p>Bonjour,</p>
    <p>Votre demande de documents de stage a été validée. Vous trouverez ci-joint un seul fichier PDF de deux pages : Autorisation de stage puis Lettre de recommandation.</p>
    <p>Ces documents sont valables ${params.dureeValiditeMois} mois à compter de leur date d'émission. Ils sont vérifiables à tout moment en scannant le QR code qu'ils contiennent.</p>
    <p>Les informations qu'ils contiennent engagent votre responsabilité. Toute utilisation frauduleuse expose son auteur à des poursuites judiciaires.</p>
    <p>Service Conseil et Aide à l'Insertion Professionnelle<br>Université de Labé</p>
  `;

  const info = await sendMail({
    from: getFromEmail(),
    to: destinataire,
    subject: 'Vos documents de stage sont prêts',
    html,
    attachments: [{ filename: 'documents-stage.pdf', content: params.documentsStageBuffer, contentType: 'application/pdf' }],
  });

  console.info('[SCAIP-UL SMTP] Email de validation envoyé', { destinataire, messageId: info.messageId, accepted: info.accepted });
  return info;
}

export async function envoyerEmailRefus(params: { destinataire: string; motif: string }) {
  const destinataire = params.destinataire?.trim();
  if (!destinataire) throw new Error("L'adresse email du destinataire est vide.");

  const html = `
    <p>Bonjour,</p>
    <p>Votre demande de documents de stage n'a pas pu être validée, pour la raison suivante :</p>
    <p><strong>${escapeHtml(params.motif)}</strong></p>
    <p>Vous pouvez soumettre une nouvelle demande en corrigeant ce point. Une demande refusée ne vous empêche pas de redéposer immédiatement.</p>
    <p>Pour toute question, contactez le SCAIP-UL directement.</p>
  `;

  const info = await sendMail({ from: getFromEmail(), to: destinataire, subject: 'Votre demande de documents de stage', html });
  console.info('[SCAIP-UL SMTP] Email de refus envoyé', { destinataire, messageId: info.messageId, accepted: info.accepted });
  return info;
}
