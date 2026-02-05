import { db } from "../src/lib/gasClient";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

async function createAdmin() {
  console.log("Creating admin user...");

  const email = "admin@tahfidz.com";
  const password = "admin123";

  // Check if admin already exists
  const existing = await db.users.findFirst({ email });
  if (existing) {
    console.log("Admin user already exists:", existing);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const newUser = await db.users.create({
    name: "Admin",
    email,
    password: hashedPassword,
    role: "admin",
    isActive: true,
    phone: "081234567890",
    address: "Tahfidz HQ"
  });

  console.log("✅ Admin user created successfully!");
  console.log("Email:", email);
  console.log("Password:", password);
  console.log("ID:", newUser.id);
}

createAdmin().catch(console.error);
