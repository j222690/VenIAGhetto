import type { Permission, UserRole } from "@/types";

// Modelo de permissões (equipe / staff — não confundir com clientes):
//   • owner   = criou a loja. Único que muda o PERFIL DA LOJA (`store:manage`),
//               altera plano (`plan:change`) e exclui clientes (`clients:delete`).
//   • manager / seller (qualquer funcionário convidado) = acesso a quase tudo
//               que o dono tem — gerar, catálogo, equipe, tokens, relatórios —
//               menos essas 3 coisas acima. Os dois papéis têm a MESMA
//               permissão hoje; a distinção Gerente/Vendedor fica só como
//               rótulo/organização da equipe, não limita mais o acesso.
// Clientes (CRM): adicionar/editar não depende de papel (qualquer membro da
// loja administra — ver ClientService); EXCLUIR cliente é só do dono
// (`clients:delete`), gated em clients.tsx.
const EMPLOYEE_PERMISSIONS: Permission[] = [
  "generate",
  "library:access",
  "users:manage",
  "catalog:manage",
  "tokens:view",
  "reports:view",
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  owner: [
    ...EMPLOYEE_PERMISSIONS,
    "store:manage",
    "plan:change",
    "clients:delete",
  ],
  manager: EMPLOYEE_PERMISSIONS,
  seller: EMPLOYEE_PERMISSIONS,
};

export const ROLE_LABEL: Record<UserRole, string> = {
  owner: "Dono",
  manager: "Gerente",
  seller: "Vendedor",
};

export const hasPermission = (role: UserRole, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);
