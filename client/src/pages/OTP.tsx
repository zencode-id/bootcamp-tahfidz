import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { useAuthStore } from "../store/authStore";

const OTP: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [otp, setOtp] = useState("");
  const [role] = useState(
    (location.state as { role?: string })?.role || "guest",
  );
  const [email] = useState((location.state as { email?: string })?.email || "");

  const { verifyOtp } = useAuthStore();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !otp) return;

    // Call store action
    const success = await verifyOtp(email, otp);

    if (success) {
      // Redirect based on role
      if (role === "admin") navigate("/admin/dashboard");
      else if (role === "teacher") navigate("/teacher/dashboard");
      else if (role === "parent") navigate("/parent/dashboard");
      else navigate("/dashboard"); // Fallback
    } else {
      alert("Invalid OTP or expired");
    }
  };

  return (
    <div className="page-container">
      <div className="glass-panel auth-card">
        <div className="w-[60px] h-[60px] rounded-full flex items-center justify-center mx-auto mb-6 bg-indigo-500/20">
          <KeyRound size={32} className="text-indigo-400" />
        </div>
        <h2 className="text-gradient text-2xl font-bold mb-2">Verify OTP</h2>
        <p className="text-muted text-sm mb-8">
          We've sent a code to {email || "your email"}.
        </p>

        <form onSubmit={handleVerify}>
          <input
            type="text"
            placeholder="0000"
            className="input-field text-center tracking-[0.5rem] text-xl font-mono"
            maxLength={4}
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />

          <button type="submit" className="btn-primary w-full">
            Verify Code
          </button>
        </form>

        <button
          onClick={() => navigate("/login")}
          className="mt-6 bg-transparent border-0 text-muted text-sm cursor-pointer hover:text-white transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default OTP;
