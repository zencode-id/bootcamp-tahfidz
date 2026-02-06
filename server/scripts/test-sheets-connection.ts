import { db } from "../src/lib/sheetsClient.js";

async function testConnection() {
  console.log("Testing Google Sheets API Connection...");
  console.log("---------------------------------------");

  try {
    const start = Date.now();
    console.log("Fetching users...");

    // Test findMany
    const users = await db.users.findMany({}, 5);

    const duration = Date.now() - start;

    console.log(`✅ Success! Fetched ${users.length} users in ${duration}ms`);

    if (users.length > 0) {
      console.log("Sample user:", JSON.stringify(users[0], null, 2));
    } else {
      console.log("⚠️ No users found in sheet.");
    }

  } catch (error: any) {
    console.error("❌ Connection Failed:", error.message);
    console.error(error);
  }
}

testConnection();
