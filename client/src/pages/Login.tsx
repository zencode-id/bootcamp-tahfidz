import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, Lock } from "lucide-react";
import { useAuthStore } from "../store/authStore";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState("parent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { loginWithPassword, isLoading, error, setError } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter both email and password");
      return;
    }

    const success = await loginWithPassword(email, password);
    if (success) {
      // Navigate to dashboard
      // TODO: Handle routing based on role (e.g. /teacher/dashboard, /student/dashboard)
      if (role === 'admin') {
         navigate("/admin/dashboard");
      } else {
         // Fallback or specific routes
         navigate("/admin/dashboard"); // reusing admin layout for now or as placeholder
      }
    }
  };

  return (
    <div className="page-container">
      <div className="glass-panel auth-card">
        <h2 className="text-gradient" style={{ marginBottom: "1.5rem" }}>
          Welcome Back
        </h2>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginBottom: "1.5rem",
            justifyContent: "center",
          }}
        >
          {["admin", "teacher", "parent"].map((r) => (
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

        <form onSubmit={handleLogin}>
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
              name="email"
              id="email"
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
              name="password"
              id="password"
              placeholder="Password"
              className="input-field"
              style={{ paddingLeft: "2.5rem" }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: "1.5rem",
            }}
          >
            <Link to="/reset-password" className="link">
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", opacity: isLoading ? 0.7 : 1 }}
            disabled={isLoading}
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </button>
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 text-red-200 text-sm rounded-lg">
              {error}
            </div>
          )}
        </form>

        <div style={{ marginTop: "1.5rem" }}>
          <span style={{ color: "var(--text-muted)" }}>
            Don't have an account?{" "}
          </span>
          <Link to="/signup" className="link">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
