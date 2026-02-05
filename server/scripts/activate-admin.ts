// Script to activate admin user
import "dotenv/config";

const GAS_URL = process.env.GAS_WEBHOOK_URL;

async function activateAdmin() {
  console.log("Activating admin user...");
  console.log("GAS URL:", GAS_URL);

  // First, let's read the admin user
  const readRes = await fetch(GAS_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "read",
      table: "users",
      query: { email: "admin@tahfidz.com" }
    }),
    redirect: "follow"
  });

  const readData = await readRes.json();
  console.log("Current admin data:", JSON.stringify(readData, null, 2));

  if (readData.success && readData.data && readData.data.length > 0) {
    const admin = readData.data[0];
    console.log("Found admin user with ID:", admin.id);
    console.log("Current isActive:", admin.isActive);

    // Update isActive to true
    const updateRes = await fetch(GAS_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          action: "update",
          table: "users",
          data: {
            id: admin.id,
            isActive: true
          }
        }],
        source: "activate-admin-script"
      }),
      redirect: "follow"
    });

    const updateData = await updateRes.json();
    console.log("Update result:", JSON.stringify(updateData, null, 2));
  } else {
    console.log("Admin user not found. Creating new admin...");

    // Use bcrypt to hash password
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash("admin123", 12);

    const createRes = await fetch(GAS_URL!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{
          action: "create",
          table: "users",
          data: {
            id: crypto.randomUUID(),
            name: "Administrator",
            email: "admin@tahfidz.com",
            password: hashedPassword,
            role: "admin",
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }],
        source: "activate-admin-script"
      }),
      redirect: "follow"
    });

    const createData = await createRes.json();
    console.log("Create result:", JSON.stringify(createData, null, 2));
  }
}

activateAdmin().catch(console.error);
