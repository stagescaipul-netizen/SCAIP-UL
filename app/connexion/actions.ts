'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type LoginState = {
  error?: string;
};

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get('email') as string;
  const motDePasse = formData.get('mot_de_passe') as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: motDePasse,
  });

  if (error) {
    return { error: 'Identifiants incorrects.' };
  }

  redirect('/agent/demandes');
}
