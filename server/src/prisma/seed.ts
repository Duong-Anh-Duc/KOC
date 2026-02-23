import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../config';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default admin
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

  console.log(`✅ Admin created: ${admin.email}`);

  // Create demo admin
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

  console.log(`✅ Demo Admin created: ${demoAdmin.email}`);

  // Create sample KOCs
  const kocs = await Promise.all([
    prisma.kOC.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        full_name: 'Nguyễn Văn A',
        channel_name: 'Channel A',
        youtube_channel_id: 'UC_SAMPLE_CHANNEL_A',
        email: 'koca@example.com',
        phone: '0901234567',
        bank_account_number: '1234567890',
        bank_name: 'Vietcombank',
        tax_code: '0123456789',
        base_rate: 0.8,
      },
    }),
    prisma.kOC.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        full_name: 'Trần Thị B',
        channel_name: 'Channel B',
        youtube_channel_id: 'UC_SAMPLE_CHANNEL_B',
        email: 'kocb@example.com',
        phone: '0909876543',
        bank_account_number: '9876543210',
        bank_name: 'Techcombank',
        tax_code: '9876543210',
        base_rate: 0.8,
      },
    }),
  ]);

  console.log(`✅ KOCs created: ${kocs.length}`);

  // Create a sample revenue cycle
  const cycle = await prisma.revenueCycle.upsert({
    where: { month: '01/2026' },
    update: {},
    create: {
      month: '01/2026',
      exchange_rate: 25400,
    },
  });

  console.log(`✅ Revenue cycle created: ${cycle.month}`);
  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
