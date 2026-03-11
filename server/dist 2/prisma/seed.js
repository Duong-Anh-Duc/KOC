"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const config_1 = require("../config");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Seeding database...');
    // Create default admin (always upsert - safe on every restart)
    const hashedPassword = await bcryptjs_1.default.hash(config_1.config.defaultAdmin.password, 12);
    const admin = await prisma.user.upsert({
        where: { email: config_1.config.defaultAdmin.email },
        update: {},
        create: {
            email: config_1.config.defaultAdmin.email,
            password_hash: hashedPassword,
            full_name: 'System Admin',
            role: client_1.UserRole.ADMIN,
        },
    });
    console.log(`✅ Admin created: ${admin.email}`);
    // Create demo admin (always upsert - safe on every restart)
    const demoAdminPassword = await bcryptjs_1.default.hash('Admin@123456', 12);
    const demoAdmin = await prisma.user.upsert({
        where: { email: 'demoadmin@koc.vn' },
        update: {},
        create: {
            email: 'demoadmin@koc.vn',
            password_hash: demoAdminPassword,
            full_name: 'Demo Admin',
            role: client_1.UserRole.ADMIN,
        },
    });
    console.log(`✅ Demo Admin created: ${demoAdmin.email}`);
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
//# sourceMappingURL=seed.js.map