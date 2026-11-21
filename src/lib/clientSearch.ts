import type { Client } from "@/types";

// Busca de cliente por NOME ou TELEFONE, usada no seletor do Provador e na
// tela Clientes. Ignora acento e maiúscula ("joao" acha "João") e, no
// telefone, compara só os dígitos ("99 9123" acha "(49) 99912-3456").
function normaliza(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function matchesClient(client: Client, query: string): boolean {
  const q = normaliza(query);
  if (!q) return true;
  if (normaliza(client.name).includes(q)) return true;
  const digitos = q.replace(/\D/g, "");
  if (digitos.length >= 2 && client.phone) {
    return client.phone.replace(/\D/g, "").includes(digitos);
  }
  return false;
}
