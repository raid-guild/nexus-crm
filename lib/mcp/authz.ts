import { prismadb } from "@/lib/prisma";
import { mapLegacyRole, type AuthzUser } from "@/lib/authz";

export async function getMcpAuthzUser(userId: string): Promise<AuthzUser> {
  const user = await prismadb.users.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) throw new Error("Unauthorized");

  return { id: user.id, role: mapLegacyRole(user.role) };
}
