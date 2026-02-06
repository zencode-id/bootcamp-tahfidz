import dotenv from "dotenv";
dotenv.config();

// Test ONLY the GAS query with email filter (no bcrypt, no token)
// This isolates whether the DB query itself is timing out

const GAS_URL = process.env.GAS_WEBHOOK_URL;
const GAS_KEY = process.env.GAS_API_KEY;

async function testDirectGASQuery() {
  console.log("Testing direct GAS query with email filter...");
  console.log("URL:", GAS_URL);
  console.log("---");

  const startTime = Date.now();

  try {
    const res = await fetch(GAS_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "read",
        table: "users",
        query: { email: "subkh4n@gmail.com" }, // Same filter as login
        limit: 1,
        apiKey: GAS_KEY
      })
    });

    const elapsed = Date.now() - startTime;
    const text = await res.text();

    console.log("Status:", res.status);
    console.log("Time:", elapsed + "ms");
    console.log("Response:", text.substring(0, 500));
  } catch (e) {
    const elapsed = Date.now() - startTime;
    console.error("Error after", elapsed + "ms:", e);
  }
}

testDirectGASQuery();
