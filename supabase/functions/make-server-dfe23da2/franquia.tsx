import * as kv from "./kv_retry.tsx";

export async function franquia() {
  const cfg: any = await kv.get('system_config') || {};
  return cfg.franchise?.enabled ? cfg.franchise : null;
}
export async function acharUnidade(id: string | null | undefined) {
  if (!id) return null;
  const f = await franquia();
  for (const cidade of f?.cities || []) {
    const unidade = (cidade.units || []).find((u: any) => u.id === id);
    if (unidade) return { cidade, unidade };
  }
  return null;
}
export const unidadeExiste = async (id: string) => !!(await acharUnidade(id));
