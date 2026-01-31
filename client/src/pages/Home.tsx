import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [role, setRole] = useState<string>("guest");

  useEffect(() => {
    // Check session
    const storedAuth = localStorage.getItem("auth_session");
    if (!storedAuth) {
      navigate("/login");
      return;
    }

    const { role, expiry } = JSON.parse(storedAuth);
    if (new Date().getTime() > expiry) {
      localStorage.removeItem("auth_session");
      navigate("/login");
      return;
    }
    setRole(role);
  }, [navigate]);

  const getRoleText = () => {
    switch (role) {
      case "admin":
        return "beranda admin";
      case "teacher":
        return "beranda teacher";
      case "parent":
        return "beranda parent";
      default:
        return "beranda";
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_session");
    navigate("/login");
  };

  return (
    <div className="page-container">
      <div
        className="glass-panel"
        style={{ padding: "3rem", textAlign: "center" }}
      >
        <h1 className="text-gradient mb-4">{getRoleText()}</h1>
        <p className="mb-4" style={{ color: "var(--text-muted)" }}>
          Welcome back, {role}
        </p>
        <button
          onClick={handleLogout}
          className="btn-primary"
          style={{ background: "#ef4444" }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default Home;
