import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.userRoles.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, roleName: 'USER', isActive: true },
  });
}
main().then(() => console.log('Seed berhasil'));