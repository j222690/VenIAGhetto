import type { Permission, UserRole } from "@/types";

// Modelo de permissões (equipe / staff — não confundir com clientes):
//   • owner   = criou a loja. Único que altera plano (`plan:change`) e, no
//               futuro, exclui a loja. Também gerencia equipe e clientes.
//   • manager = gerencia equipe/convites (`users:manage`), perfil da loja
//               (`store:manage`) e clientes — mas NÃO altera plano.
//   • seller  = usa o app (gerar, biblioteca, álbum) e atende clientes; não
//               gerencia equipe nem o perfil da loja.
// Clientes (CRM) não dependem de permissão de papel: qualquer membro da loja
// administra (isolamento é por loja via RLS) — ver ClientService.
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    "generate",
    "library:access",
    "users:manage",
    "store:manage",
    "catalog:manage",
    "tokens:view",
    "plan:change",
    "reports:view",
  ],
  manager: [
    "generate",
    "library:access",
    "users:manage",
    "store:manage",
    "catalog:manage",
    "tokens:view",
    "reports:view",
  ],
  seller: ["generate", "library:access"],
};

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Dono",
  manager: "Gerente",
  seller: "Vendedor",
};

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);
