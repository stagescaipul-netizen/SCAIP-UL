import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Génère les deux références d'un dossier — même numéro de séquence,
 * suffixé A (Autorisation) et R (Recommandation), format
 * 00001/SCAIP-UL/A/2026. Utilise dossier_reference_seq (migration 0001).
 */
export async function generateReferences(
  service: SupabaseClient,
): Promise<{ referenceA: string; referenceR: string }> {
  const { data, error } = await service.rpc('nextval_dossier_reference');
  if (error || data === null) {
    throw new Error("Impossible de générer le numéro de dossier.");
  }
  const numero = String(data).padStart(5, '0');
  const annee = new Date().getFullYear();
  return {
    referenceA: `${numero}/SCAIP-UL/A/${annee}`,
    referenceR: `${numero}/SCAIP-UL/R/${annee}`,
  };
}
