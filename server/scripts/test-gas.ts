import dotenv from "dotenv";
dotenv.config();

const URL = process.env.GAS_WEBHOOK_URL;
const KEY = process.env.GAS_API_KEY;

console.log("Testing Connection to:", URL);
console.log("Using Key:", KEY);

async function test() {
  try {
    const res = await fetch(URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
         // "X-API-Key": KEY // Try without header first to see if it reaches logic
      },
      body: JSON.stringify({
        action: "read",
        table: "users",
        limit: 1,
        apiKey: KEY // Pass in body
      })
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Raw Response:", text);
  } catch (e) {
    console.error("Error:", e);
  }
}

test();
