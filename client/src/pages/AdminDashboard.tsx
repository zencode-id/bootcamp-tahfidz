import React from "react";
import { useAuthStore } from "../store/authStore";

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="page-container">
      <div className="glass-panel p-10 text-center">
        <h1 className="text-3xl font-bold text-gradient mb-4">Beranda Admin</h1>
        <p className="text-muted-foreground mb-6">Welcome, {user?.email}</p>
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg mb-6">
          <p className="text-red-300 text-sm">
            Restricted Area: System Configuration & User Management
          </p>
        </div>
        <button
          onClick={logout}
          className="btn-primary bg-linear-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700"
        >
          Logout Admin
        </button>
      </div>
    </div>
  );
};

export default AdminDashboard;
