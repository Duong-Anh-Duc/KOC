import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../config';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create default admin (always upsert - safe on every restart)
  const hashedPassword = await bcrypt.hash(config.defaultAdmin.password, 12);
  
  const admin = await prisma.user.upsert({
    where: { email: config.defaultAdmin.email },
    update: {},
    create: {
      email: config.defaultAdmin.email,
      password_hash: hashedPassword,
      full_name: 'System Admin',
      role: UserRole.ADMIN,
    },
  });

  console.log(`Admin created: ${admin.email}`);

  // Create demo admin (always upsert - safe on every restart)
  const demoAdminPassword = await bcrypt.hash('Admin@123456', 12);
  const demoAdmin = await prisma.user.upsert({
    where: { email: 'demoadmin@koc.vn' },
    update: {},
    create: {
      email: 'demoadmin@koc.vn',
      password_hash: demoAdminPassword,
      full_name: 'Demo Admin',
      role: UserRole.ADMIN,
    },
  });

  console.log(`Demo Admin created: ${demoAdmin.email}`);

  // Create default viewer account (read-only access)
  const viewerPassword = await bcrypt.hash('viewer123', 12);
  const viewer = await prisma.user.upsert({
    where: { email: 'viewer@koc.vn' },
    update: {},
    create: {
      email: 'viewer@koc.vn',
      password_hash: viewerPassword,
      full_name: 'Viewer Account',
      role: UserRole.VIEWER,
    },
  });

  console.log(`Viewer created: ${viewer.email}`);
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
