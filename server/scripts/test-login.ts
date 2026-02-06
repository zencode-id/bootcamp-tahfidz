import dotenv from "dotenv";
dotenv.config();

const SERVER_URL = "https://bootcamp-tahfidz.vercel.app";

async function testLogin() {
  console.log("Testing login to:", SERVER_URL);
  console.log("---");

  const startTime = Date.now();

  try {
    const res = await fetch(`${SERVER_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: "subkh4n@gmail.com", // admin email from GAS
        password: "admin123" // Ganti dengan password yang benar
      })
    });

    const elapsed = Date.now() - startTime;
    const text = await res.text();

    console.log("Status:", res.status);
    console.log("Time:", elapsed + "ms");
    console.log("Response:", text);
  } catch (e) {
    const elapsed = Date.now() - startTime;
    console.error("Error after", elapsed + "ms:", e);
  }
}

testLogin();
