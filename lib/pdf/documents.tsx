/* eslint-disable jsx-a11y/alt-text */
import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { readFileSync } from 'fs';
import path from 'path';

const NAVY = '#1F3B4D';
const RED = '#C0392B';
const GREY = '#555555';

const styles = StyleSheet.create({
  page: { paddingTop: 30, paddingHorizontal: 34, paddingBottom: 60, fontSize: 10.5, fontFamily: 'Helvetica', color: '#1A2530' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 8, marginBottom: 4 },
  logo: { width: 120, height: 32 },
  headRight: { alignItems: 'flex-end' },
  hBold: { fontSize: 9, fontWeight: 700, color: NAVY, marginBottom: 1 },
  hSmall: { fontSize: 8, color: GREY, marginBottom: 1 },
  ref: { textAlign: 'right', fontSize: 10, fontWeight: 700, color: GREY, marginTop: 6 },
  title: { textAlign: 'center', fontSize: 15, fontWeight: 700, color: NAVY, marginTop: 30, marginBottom: 16 },
  body: { fontSize: 10.5, lineHeight: 1.5, textAlign: 'justify', marginBottom: 10 },
  fieldsBox: { marginVertical: 8, borderWidth: 1, borderColor: '#999' },
  fieldRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#999', paddingVertical: 5, paddingHorizontal: 6 },
  fieldRowLast: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 6 },
  fieldLabel: { width: 200, fontWeight: 700, fontSize: 10.5 },
  fieldValue: { flex: 1, fontSize: 10.5 },
  faitA: { fontSize: 10.5, marginTop: 14, marginBottom: 20 },
  signBox: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#999', width: 220, height: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  authVisual: { position: 'relative', width: 220, height: 78, marginBottom: 6 },
  stampImage: { position: 'absolute', left: 22, top: 0, width: 100, height: 76, objectFit: 'contain' },
  signatureOverlay: { position: 'absolute', left: 48, top: 18, width: 150, height: 52, objectFit: 'contain' },
  combinedImage: { width: 180, height: 72, marginBottom: 6, objectFit: 'contain' },
  signBoxText: { fontSize: 8, color: '#999', fontStyle: 'italic' },
  signatureBlock: { width: 220, alignItems: 'center', alignSelf: 'flex-start', marginLeft: 0 },
  signName: { width: 220, fontSize: 10, fontWeight: 700, textAlign: 'left', marginTop: 2, marginLeft: 18 },
  signFunction: { width: 220, fontSize: 8, fontWeight: 600, textAlign: 'left', lineHeight: 1.15, marginTop: 3, marginLeft: 0 },
  verifRow: { position: 'absolute', bottom: 46, left: 34, right: 34, flexDirection: 'row', borderWidth: 1, borderColor: RED, padding: 10, alignItems: 'center' },
  verifText: { flex: 1, paddingRight: 10 },
  verifItalic: { fontSize: 8, fontStyle: 'italic', color: '#333', marginBottom: 4 },
  verifBold: { fontSize: 8, fontStyle: 'italic', fontWeight: 700, color: '#333' },
  qr: { width: 55, height: 55 },
  footer: { position: 'absolute', bottom: 20, left: 34, right: 34, textAlign: 'center', fontSize: 8, color: '#777', borderTopWidth: 1, borderTopColor: '#ccc', paddingTop: 6 },
});

export type DocumentFieldData = {
  nom: string;
  ine: string;
  departement: string;
  filiere: string;
  niveau: string;
  annee: string;
  contact: string;
};

export type IdentiteInstitutionnelle = {
  etablissement: string;
  service: string;
  signataire: string;
  fonction: string;
  emailProfessionnel: string;
  telephone: string;
  authenticationMode: 'separate' | 'combined';
  signatureImageBuffer?: Buffer;
  cachetImageBuffer?: Buffer;
  combinedImageBuffer?: Buffer;
};

const LOGO_PATH = path.join(process.cwd(), 'public/logo/universite-labe.png');

function Header({ identite }: { identite: IdentiteInstitutionnelle }) {
  const logo = readFileSync(LOGO_PATH);
  return (
    <View style={styles.headerRow}>
      <Image src={logo} style={styles.logo} />
      <View style={styles.headRight}>
        <Text style={styles.hBold}>SCAIP-UL</Text>
        <Text style={styles.hSmall}>{identite.service}</Text>
        <Text style={styles.hSmall}>BP : 210, CR Hafia, Labé</Text>
        <Text style={styles.hSmall}>{identite.emailProfessionnel}</Text>
        <Text style={styles.hSmall}>Tel : {identite.telephone}</Text>
      </View>
    </View>
  );
}

function SignatureBlock({ identite }: { identite: IdentiteInstitutionnelle }) {
  const completeSeparate = identite.signatureImageBuffer && identite.cachetImageBuffer;
  const completeCombined = identite.combinedImageBuffer;
  const fonctionAffichee = identite.fonction.includes(' et Aide')
    ? identite.fonction.replace(' et Aide', '\net Aide')
    : identite.fonction;

  return (
    <View style={styles.signatureBlock}>
      {identite.authenticationMode === 'separate' && completeSeparate ? (
        <View style={styles.authVisual}>
          <Image src={identite.cachetImageBuffer!} style={styles.stampImage} />
          <Image src={identite.signatureImageBuffer!} style={styles.signatureOverlay} />
        </View>
      ) : identite.authenticationMode === 'combined' && completeCombined ? (
        <Image src={identite.combinedImageBuffer!} style={styles.combinedImage} />
      ) : (
        <View style={styles.signBox}><Text style={styles.signBoxText}>Signature et cachet non configurés</Text></View>
      )}
      <Text style={styles.signName}>{identite.signataire}</Text>
      <Text style={styles.signFunction}>{fonctionAffichee}</Text>
    </View>
  );
}

function VerifAndFooter({
  qrDataUrl,
  dureeValiditeMois,
  identite,
}: {
  qrDataUrl: string;
  dureeValiditeMois: number;
  identite: IdentiteInstitutionnelle;
}) {
  const dureeTexte = dureeValiditeMois === 1 ? 'un (1) mois' : `${dureeValiditeMois === 3 ? 'trois (3)' : dureeValiditeMois === 6 ? 'six (6)' : dureeValiditeMois} mois`;
  return (
    <>
      <View style={styles.verifRow}>
        <View style={styles.verifText}>
          <Text style={styles.verifItalic}>
            Ce document a été généré par le système automatisé de délivrance du {identite.service} (SCAIP-UL). Pour en vérifier l&apos;authenticité, vous pouvez scanner le QR Code.
          </Text>
          <Text style={styles.verifBold}>
            Le présent document est valable {dureeTexte} à compter de sa date d&apos;émission.
          </Text>
        </View>
        <Image src={qrDataUrl} style={styles.qr} />
      </View>
      <Text style={styles.footer}>
        BP 210, CR Hafia, Labé · {identite.emailProfessionnel} · {identite.telephone}
      </Text>
    </>
  );
}

function Field({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={last ? styles.fieldRowLast : styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function AutorisationPage({
  d,
  reference,
  qrDataUrl,
  dureeValiditeMois,
  dateEmissionTexte,
  identite,
}: {
  d: DocumentFieldData;
  reference: string;
  qrDataUrl: string;
  dureeValiditeMois: number;
  dateEmissionTexte: string;
  identite: IdentiteInstitutionnelle;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Header identite={identite} />
      <Text style={styles.ref}>Réf. N° : {reference}</Text>
      <Text style={styles.title}>AUTORISATION DE STAGE</Text>
      <Text style={styles.body}>
        Je soussigné, {identite.signataire}, {identite.fonction} de l&apos;{identite.etablissement}, certifie que l&apos;étudiant(e) identifié(e) ci-dessous est régulièrement inscrit(e) au sein de l&apos;{identite.etablissement}.
      </Text>
      <Text style={styles.body}>
        La présente autorisation atteste que l&apos;étudiant(e) est habilité(e) à effectuer un stage pratique en milieu professionnel, conformément aux exigences de son parcours académique et aux règles applicables à son programme de formation.
      </Text>
      <View style={styles.fieldsBox}>
        <Field label="Nom et prénom" value={d.nom} />
        <Field label="Numéro INE de l'étudiant" value={d.ine} />
        <Field label="Département" value={d.departement} />
        <Field label="Filière / Programme" value={d.filiere} />
        <Field label="Niveau" value={d.niveau} />
        <Field label="Année universitaire" value={d.annee} />
        <Field label="Contact" value={d.contact} last />
      </View>
      <Text style={styles.body}>
        Ce stage s&apos;inscrit dans une démarche de consolidation des acquis académiques, de développement des compétences professionnelles et d&apos;adaptation progressive aux réalités du monde du travail.
      </Text>
      <Text style={styles.body}>
        L&apos;{identite.etablissement} assure le suivi académique du stage et demeure l&apos;interlocuteur institutionnel pour toute vérification ou coordination administrative relative à la situation de l&apos;étudiant(e).
      </Text>
      <Text style={styles.faitA}>Fait à Labé, le {dateEmissionTexte}</Text>
      <SignatureBlock identite={identite} />
      <VerifAndFooter qrDataUrl={qrDataUrl} dureeValiditeMois={dureeValiditeMois} identite={identite} />
    </Page>
  );
}

function RecommandationPage({
  d,
  reference,
  qrDataUrl,
  dureeValiditeMois,
  dateEmissionTexte,
  identite,
}: {
  d: DocumentFieldData;
  reference: string;
  qrDataUrl: string;
  dureeValiditeMois: number;
  dateEmissionTexte: string;
  identite: IdentiteInstitutionnelle;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Header identite={identite} />
      <Text style={styles.ref}>Réf. N° : {reference}</Text>
      <Text style={styles.title}>LETTRE DE RECOMMANDATION</Text>
      <Text style={styles.body}>
        Par la présente, j&apos;ai l&apos;honneur de recommander {d.nom}, étudiant(e) régulièrement inscrit(e) à l&apos;{identite.etablissement}, dans le cadre de sa recherche de stage en entreprise.
      </Text>
      <Text style={styles.body}>
        Au cours de son parcours universitaire, l&apos;intéressé(e) a suivi avec assiduité une formation conforme aux exigences de son programme académique et poursuit un cursus destiné à développer les connaissances, les compétences techniques et les aptitudes professionnelles requises dans son domaine de spécialisation.
      </Text>
      <Text style={styles.body}>
        Nous sommes convaincus que cette immersion en milieu professionnel constituera une étape déterminante dans son développement et lui permettra de mettre en pratique les acquis de sa formation tout en développant son sens des responsabilités, son esprit d&apos;initiative et sa capacité d&apos;adaptation aux exigences du monde professionnel.
      </Text>
      <Text style={styles.body}>
        Nous vous remercions de l&apos;attention que vous voudrez bien accorder à sa candidature et demeurons à votre disposition pour toute information complémentaire.
      </Text>
      <Text style={styles.faitA}>Fait à Labé, le {dateEmissionTexte}</Text>
      <SignatureBlock identite={identite} />
      <VerifAndFooter qrDataUrl={qrDataUrl} dureeValiditeMois={dureeValiditeMois} identite={identite} />
    </Page>
  );
}

async function makeQr(reference: string): Promise<string> {
  // Ordre de repli : réglage manuel d'abord, puis l'URL que Netlify
  // fournit lui-même automatiquement à la construction (pas besoin de
  // configuration côté utilisateur), localhost en tout dernier recours.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'http://localhost:3000';
  const url = `${baseUrl}/verification/${reference}`;
  return QRCode.toDataURL(url, { width: 300, margin: 1 });
}

/**
 * Génère les deux PDF (Autorisation + Recommandation) pour une demande.
 * Les deux références partagent le même numéro de séquence, suffixé A/R —
 * voir dossier_reference_seq et generateReferences() dans lib/pdf/reference.ts.
 *
 * L'identité institutionnelle (signataire, fonction, coordonnées) est
 * lue au moment de la génération — un changement futur n'affecte jamais
 * les documents déjà émis, seulement les suivants.
 */
export async function generateDocumentPdfs(params: {
  fields: DocumentFieldData;
  referenceA: string;
  referenceR: string;
  dureeValiditeMois: number;
  dateEmission: Date;
  identite: IdentiteInstitutionnelle;
}) {
  const { fields, referenceA, referenceR, dureeValiditeMois, dateEmission, identite } = params;
  const dateEmissionTexte = `${String(dateEmission.getDate()).padStart(2, '0')}/${String(dateEmission.getMonth() + 1).padStart(2, '0')}/${dateEmission.getFullYear()}`;

  const [qrA, qrR] = await Promise.all([
    makeQr(referenceA),
    makeQr(referenceR),
  ]);

  const autorisationBuffer = await renderToBuffer(
    <Document>
      <AutorisationPage d={fields} reference={referenceA} qrDataUrl={qrA} dureeValiditeMois={dureeValiditeMois} dateEmissionTexte={dateEmissionTexte} identite={identite} />
    </Document>,
  );

  const recommandationBuffer = await renderToBuffer(
    <Document>
      <RecommandationPage d={fields} reference={referenceR} qrDataUrl={qrR} dureeValiditeMois={dureeValiditeMois} dateEmissionTexte={dateEmissionTexte} identite={identite} />
    </Document>,
  );

  // Version étudiante : un seul PDF de deux pages. Chaque page conserve
  // sa propre référence et son propre QR Code afin que les deux documents
  // restent vérifiables indépendamment.
  const documentsStageBuffer = await renderToBuffer(
    <Document>
      <AutorisationPage d={fields} reference={referenceA} qrDataUrl={qrA} dureeValiditeMois={dureeValiditeMois} dateEmissionTexte={dateEmissionTexte} identite={identite} />
      <RecommandationPage d={fields} reference={referenceR} qrDataUrl={qrR} dureeValiditeMois={dureeValiditeMois} dateEmissionTexte={dateEmissionTexte} identite={identite} />
    </Document>,
  );

  return { autorisationBuffer, recommandationBuffer, documentsStageBuffer };
}
