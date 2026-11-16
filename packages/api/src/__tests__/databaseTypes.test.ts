import { describe, expectTypeOf, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database, Enums, Rpc, Tables, TablesInsert } from '../database.types';

/*
 * Teste de TIPO: quem valida é o `tsc` (npm run typecheck). Se o
 * gerador sair do formato que o supabase-js espera, o cliente tipado
 * deixa de inferir as colunas e este arquivo para de compilar.
 */
describe('database.types.ts', () => {
  it('é aceito pelo cliente tipado do supabase-js', () => {
    const sb = createClient<Database>('https://exemplo.supabase.co', 'anon');
    const consulta = () => sb.from('perfis').select('id, papel').single();
    type Linha = NonNullable<Awaited<ReturnType<typeof consulta>>['data']>;
    expectTypeOf<Linha['papel']>().toEqualTypeOf<Enums<'papel_usuario'>>();
    expectTypeOf<Linha['id']>().toEqualTypeOf<string>();
  });

  it('insert exige só o que não tem padrão', () => {
    expectTypeOf<TablesInsert<'perfis'>['id']>().toEqualTypeOf<string>();
    expectTypeOf<TablesInsert<'perfis'>>().toHaveProperty('criado_em');
    expectTypeOf<Tables<'perfis'>['data_nascimento']>().toEqualTypeOf<string | null>();
  });

  it('funções (RPC) com argumentos opcionais quando têm DEFAULT', () => {
    expectTypeOf<Rpc<'vincular_por_codigo'>['Args']>().toEqualTypeOf<{
      p_codigo: string;
      p_parentesco?: string;
    }>();
  });
});
