import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock, User } from "lucide-react";

const Signup: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState("parent");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock signup - redirect to login
    navigate("/login");
  };

  return (
    <div className="page-container">
      <div className="glass-panel auth-card">
        <h2 className="text-gradient" style={{ marginBottom: "1.5rem" }}>
          Create Account
        </h2>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1.5rem",
            justifyContent: "center",
          }}
        >
          {["teacher", "parent"].map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`role-badge ${r}`}
              style={{
                border:
                  role === r ? "2px solid white" : "2px solid transparent",
                cursor: "pointer",
                opacity: role === r ? 1 : 0.5,
              }}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleSignup}>
          <div style={{ position: "relative" }}>
            <User
              size={18}
              style={{
                position: "absolute",
                top: "14px",
                left: "12px",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="text"
              placeholder="Full Name"
              className="input-field"
              style={{ paddingLeft: "2.5rem" }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

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

          <div style={{ position: "relative" }}>
            <Lock
              size={18}
              style={{
                position: "absolute",
                top: "14px",
                left: "12px",
                color: "var(--text-muted)",
              }}
            />
            <input
              type="password"
              placeholder="Password"
              className="input-field"
              style={{ paddingLeft: "2.5rem" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%" }}
          >
            Sign Up
          </button>
        </form>

        <div style={{ marginTop: "1.5rem" }}>
          <span style={{ color: "var(--text-muted)" }}>
            Already have an account?{" "}
          </span>
          <Link to="/login" className="link">
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
