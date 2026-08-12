import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { finaliserDemande } from '@/lib/documents/finalize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const authorization = request.headers.get('authorization');
  return authorization === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const service = createServiceRoleClient();
  const { data: settings, error: settingsError } = await service
    .from('settings')
    .select('mode_generation, generation_differee_delai_minutes, delivrance_suspendue')
    .single();

  if (settingsError || !settings) {
    console.error('Validation différée: paramètres introuvables', settingsError);
    return NextResponse.json({ error: 'Paramètres introuvables.' }, { status: 500 });
  }

  if (settings.delivrance_suspendue || settings.mode_generation !== 'differe') {
    return NextResponse.json({ success: true, processed: 0, reason: 'Mode différé inactif ou délivrance suspendue.' });
  }

  const delayMinutes = Number(settings.generation_differee_delai_minutes);
  if (!Number.isFinite(delayMinutes) || delayMinutes <= 0) {
    return NextResponse.json({ error: 'Délai différé invalide.' }, { status: 500 });
  }

  const threshold = new Date(Date.now() - delayMinutes * 60_000).toISOString();
  const { data: requests, error: requestsError } = await service
    .from('internship_request')
    .select('id')
    .eq('statut', 'en_attente')
    .lt('date_soumission', threshold)
    .order('date_soumission', { ascending: true })
    .limit(25);

  if (requestsError) {
    console.error('Validation différée: lecture des demandes impossible', requestsError);
    return NextResponse.json({ error: 'Lecture des demandes impossible.' }, { status: 500 });
  }

  const results: Array<{ id: string; success: boolean; error?: string; warning?: string }> = [];
  for (const item of requests ?? []) {
    const result = await finaliserDemande(item.id, null);
    results.push({ id: item.id, success: Boolean(result.success), error: result.error, warning: result.warning });
  }

  const failures = results.filter((item) => !item.success);
  const warnings = results.filter((item) => item.warning);

  console.info('Validation différée terminée', {
    selected: results.length,
    succeeded: results.length - failures.length,
    failed: failures.length,
    warnings: warnings.length,
    results,
  });

  return NextResponse.json({
    success: failures.length === 0,
    processed: results.length,
    succeeded: results.length - failures.length,
    failed: failures.length,
    warnings: warnings.length,
    results,
  }, { status: failures.length === 0 ? 200 : 207 });
}
