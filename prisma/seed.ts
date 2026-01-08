import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.user_roles.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, role_name: 'USER', is_active: true },
  });
}
main().then(() => console.log('Seed berhasil'));