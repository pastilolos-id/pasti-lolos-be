import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roles = [
  { id: 1, roleName: 'STUDENT', description: 'Siswa' },
  { id: 2, roleName: 'TEACHER', description: 'Guru atau kontributor' },
  { id: 3, roleName: 'ADMIN', description: 'Administrator' },
];

async function main(): Promise<void> {
  for (const role of roles) {
    await prisma.userRoles.upsert({
      where: { id: role.id },
      update: {
        roleName: role.roleName,
        description: role.description,
        isActive: true,
      },
      create: {
        ...role,
        isActive: true,
      },
    });
  }

  console.log('Seed user role berhasil');
}

void main()
  .catch((error: unknown) => {
    console.error('Seed user role gagal:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
