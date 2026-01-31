import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";

const ForgotPassword: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock logic
    setSent(true);
    setTimeout(() => navigate("/login"), 3000);
  };

  return (
    <div className="page-container">
      <div className="glass-panel auth-card">
        <Link
          to="/login"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: "var(--text-muted)",
            marginBottom: "1.5rem",
            textDecoration: "none",
            fontSize: "0.9rem",
          }}
        >
          <ArrowLeft size={16} /> Back
        </Link>

        <h2 className="text-gradient" style={{ marginBottom: "0.5rem" }}>
          Forgot Password
        </h2>

        {!sent ? (
          <>
            <p
              style={{
                color: "var(--text-muted)",
                marginBottom: "1.5rem",
                fontSize: "0.9rem",
              }}
            >
              Enter your email to receive password reset instructions.
            </p>
            <form onSubmit={handleSubmit}>
              <div style={{ position: "relative" }}>
                <Mail
                  size={18}
                  style={{
                    position: "absolute",
                    top: "14px",
                    left: "12px",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  className="input-field"
                  style={{ paddingLeft: "2.5rem" }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className="btn-primary"
                style={{ width: "100%" }}
              >
                Reset Password
              </button>
            </form>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "1rem" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📧</div>
            <h3 style={{ color: "var(--text-color)" }}>Check your inbox</h3>
            <p style={{ color: "var(--text-muted)" }}>
              We have sent instructions to {email}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
