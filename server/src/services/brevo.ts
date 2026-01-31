import SibApiV3Sdk from "sib-api-v3-sdk";

const defaultClient = SibApiV3Sdk.ApiClient.instance;
const apiKey = defaultClient.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY || "";

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

export const sendOtpEmail = async (
  email: string,
  otp: string,
  name: string,
) => {
  // If no API key, log to console for dev
  if (!process.env.BREVO_API_KEY) {
    console.warn(`[DEV] Mock sending OTP to ${email}: ${otp}`);
    return;
  }

  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.to = [{ email, name }];
  sendSmtpEmail.sender = {
    email: process.env.SENDER_EMAIL || "no-reply@tahfidz.com",
    name: "Tahfidz App",
  };
  sendSmtpEmail.subject = "Your Login OTP Code";
  sendSmtpEmail.htmlContent = `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
      <h2 style="color: #4f46e5;">Tahfidz App Login</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your Single-Use Login Code is:</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 5px; text-align: center; margin: 20px 0;">
        ${otp}
      </div>
      <p>This code is valid for 5 minutes.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
    </div>
  `;

  try {
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`OTP email sent to ${email}`);
  } catch (error) {
    console.error("Error sending OTP email:", error);
    // throw new Error("Failed to send OTP email"); // Don't crash auth flow entirely if email fails?
    // Provide explicit error so frontend knows
    throw error;
  }
};
