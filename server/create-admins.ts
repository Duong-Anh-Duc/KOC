import { PrismaClient } from "@prisma/client";
import bcryptjs from "bcryptjs";

const prisma = new PrismaClient();

async function createAdmins() {
  try {
    console.log("Creating 2 admin accounts...");

    // Admin 1
    const admin1Email = "admin1@koc.vn";
    const admin1Password = "Admin@123456";
    const admin1Name = "System Admin 1";

    // Admin 2
    const admin2Email = "admin2@koc.vn";
    const admin2Password = "Admin@654321";
    const admin2Name = "System Admin 2";

    // Hash passwords
    const hashedPassword1 = await bcryptjs.hash(admin1Password, 10);
    const hashedPassword2 = await bcryptjs.hash(admin2Password, 10);

    // Create Admin 1
    const user1 = await prisma.user.create({
      data: {
        email: admin1Email,
        password_hash: hashedPassword1,
        full_name: admin1Name,
        role: "ADMIN",
        is_active: true,
      },
    });
    console.log(`✓ Created Admin 1:`);
    console.log(`  Email: ${admin1Email}`);
    console.log(`  Password: ${admin1Password}`);
    console.log(`  Name: ${admin1Name}`);

    // Create Admin 2
    const user2 = await prisma.user.create({
      data: {
        email: admin2Email,
        password_hash: hashedPassword2,
        full_name: admin2Name,
        role: "ADMIN",
        is_active: true,
      },
    });
    console.log(`\n✓ Created Admin 2:`);
    console.log(`  Email: ${admin2Email}`);
    console.log(`  Password: ${admin2Password}`);
    console.log(`  Name: ${admin2Name}`);

    console.log("\n✓ Successfully created 2 admin accounts!");
  } catch (error) {
    console.error("Error creating admins:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmins();
