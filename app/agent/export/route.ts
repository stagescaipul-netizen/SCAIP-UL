import { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/auth/current-user';
import { createServiceRoleClient } from '@/lib/supabase/service';
import * as XLSX from 'xlsx';
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import React from 'react';

const COLONNES = ['Étudiant', 'Numéro INE', 'Contact', 'Département', 'Filière', 'Niveau', 'Statut', 'Statut du document', 'Réf. Autorisation', 'Réf. Recommandation', 'Soumise le', 'Émise le', 'Valide jusqu\'au'] as const;

function ligneVers(row: Record<string, unknown>): string[] {
  return [
    String(row.nom_etudiant ?? ''),
    String(row.numero_ine ?? ''),
    String(row.contact ?? ''),
    String(row.departement ?? ''),
    String(row.filiere ?? ''),
    String(row.niveau ?? ''),
    String(row.statut ?? ''),
    String(
      row.statut_document === 'invalide_manuellement'
        ? `Invalidé par ${row.invalide_par ?? 'un administrateur'}`
        : (row.statut_document ?? ''),
    ),
    String(row.reference_autorisation ?? ''),
    String(row.reference_recommandation ?? ''),
    row.date_soumission ? new Date(row.date_soumission as string).toISOString().slice(0, 10) : '',
    row.date_emission ? String(row.date_emission) : '',
    row.date_expiration ? String(row.date_expiration) : '',
  ];
}

const pdfStyles = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: 'Helvetica' },
  title: { fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#1F3B4D' },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ccc', paddingVertical: 3 },
  headerRow: { flexDirection: 'row', backgroundColor: '#E9EEF1', paddingVertical: 4, fontWeight: 700 },
  cell: { flex: 1, paddingHorizontal: 2 },
});

async function genererPdf(lignes: string[][]): Promise<Buffer> {
  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A3', orientation: 'landscape', style: pdfStyles.page },
      React.createElement(Text, { style: pdfStyles.title }, 'Liste complète des demandes — SCAIP-UL'),
      React.createElement(
        View,
        { style: pdfStyles.headerRow },
        ...COLONNES.map((c, i) => React.createElement(Text, { key: i, style: pdfStyles.cell }, c)),
      ),
      ...lignes.map((ligne, r) =>
        React.createElement(
          View,
          { style: pdfStyles.row, key: r },
          ...ligne.map((val, i) => React.createElement(Text, { key: i, style: pdfStyles.cell }, val)),
        ),
      ),
    ),
  );
  return renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
}

function genererExcel(lignes: string[][]): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([[...COLONNES], ...lignes]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Demandes');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (user.role !== 'agent') {
    return new Response('Non autorisé', { status: 401 });
  }

  const format = request.nextUrl.searchParams.get('format');
  if (format !== 'pdf' && format !== 'xlsx') {
    return new Response("Format invalide, utilisez ?format=pdf ou ?format=xlsx", { status: 400 });
  }

  const service = createServiceRoleClient();
  const statutFiltre = request.nextUrl.searchParams.get('statut');

  let requete = service.from('journal_demandes').select('*').order('date_soumission', { ascending: false });

  if (statutFiltre === 'invalidee') {
    requete = requete.eq('statut_document', 'invalide_manuellement');
  } else if (statutFiltre && ['en_attente', 'validee', 'refusee', 'annulee'].includes(statutFiltre)) {
    requete = requete.eq('statut', statutFiltre).neq('statut_document', 'invalide_manuellement');
  }

  const { data: rows } = await requete;

  const lignes = (rows ?? []).map(ligneVers);

  if (format === 'xlsx') {
    const buffer = genererExcel(lignes);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="demandes-scaip-ul.xlsx"',
      },
    });
  }

  const buffer = await genererPdf(lignes);
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="demandes-scaip-ul.pdf"',
    },
  });
}
