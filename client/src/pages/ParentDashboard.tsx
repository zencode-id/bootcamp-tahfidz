import React from "react";
import { useAuthStore } from "../store/authStore";

const ParentDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="page-container">
      <div className="glass-panel p-10 text-center">
        <h1 className="text-3xl font-bold text-gradient mb-4">
          Beranda Parent
        </h1>
        <p className="text-muted-foreground mb-6">Welcome, {user?.name}</p>
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mb-6">
          <p className="text-emerald-300 text-sm">Student Progress & Reports</p>
        </div>
        <button
          onClick={logout}
          className="btn-primary bg-linear-to-r from-emerald-600 to-emerald-800 hover:from-emerald-500 hover:to-emerald-700"
        >
          Logout Parent
        </button>
      </div>
    </div>
  );
};

export default ParentDashboard;
