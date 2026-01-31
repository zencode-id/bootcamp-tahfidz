import React from "react";
import { useAuthStore } from "../store/authStore";

const TeacherDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <div className="page-container">
      <div className="glass-panel p-10 text-center">
        <h1 className="text-3xl font-bold text-gradient mb-4">
          Beranda Teacher
        </h1>
        <p className="text-muted-foreground mb-6">
          Welcome, Ustadz/Ustadzah {user?.name}
        </p>
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-6">
          <p className="text-blue-300 text-sm">
            Classroom Management & Grading Portal
          </p>
        </div>
        <button
          onClick={logout}
          className="btn-primary bg-linear-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700"
        >
          Logout Teacher
        </button>
      </div>
    </div>
  );
};

export default TeacherDashboard;
