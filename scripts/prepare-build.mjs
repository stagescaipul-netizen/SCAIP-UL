import { mkdir, writeFile } from 'node:fs/promises';

const compatibilityFile = `// Generated before each build to prevent stale Netlify Drop files.\nexport {\n  envoyerEmailDocumentsPrets,\n  envoyerEmailRefus,\n} from './send';\n`;

await mkdir('lib/email', { recursive: true });
await writeFile('lib/email/send-documents.ts', compatibilityFile, 'utf8');
console.log('[StagePermit] SMTP transport: Brevo-compatible Nodemailer configuration.');
console.log('[StagePermit] lib/email/send-documents.ts overwritten with Nodemailer compatibility export.');
