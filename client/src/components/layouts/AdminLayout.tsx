import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  User as UserIcon
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { path: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
    { path: "/admin/users", label: "User Management", icon: Users },
    { path: "/admin/classes", label: "Classes", icon: BookOpen },
    { path: "/admin/reports", label: "Reports", icon: FileText },
    { path: "/admin/settings", label: "Settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_left,var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-slate-950 flex text-white font-sans">

      {/* Mobile Menu Button */}
      <button
        className="fixed top-4 right-4 z-50 p-2 bg-slate-800/50 backdrop-blur rounded-lg md:hidden border border-white/10"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-slate-900/80 backdrop-blur-xl border-r border-white/10 z-40 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        flex flex-col
      `}>
        {/* Logo Area */}
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-linear-to-br from-indigo-500 to-pink-500 flex items-center justify-center font-bold">
               BT
             </div>
             <span className="text-lg font-bold tracking-wide">Tahfidz Admin</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2 px-2 mt-4 text-left">Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group no-underline
                  ${isActive
                    ? "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"}
                `}
                onClick={() => setIsSidebarOpen(false)}
              >
                <Icon size={18} className={isActive ? "text-indigo-400" : "group-hover:text-white"} />
                <span className="font-medium text-sm">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Profile & Logout */}
        <div className="p-4 border-t border-white/5 bg-slate-950/30">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center border border-white/10">
              <UserIcon size={14} className="text-slate-300" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium truncate">{user?.name || "Admin"}</p>
              <p className="text-xs text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer border-0 bg-transparent text-sm"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-64 min-h-screen flex flex-col pt-16 md:pt-0">
        <div className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
            {/* Header / Breadcrumb */}
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">{title}</h1>
                <p className="text-slate-400 text-sm">Welcome back to dashboard panel.</p>
              </div>
              <div className="hidden md:block">
                 <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
                    Live System
                 </span>
              </div>
            </div>

            {/* Content Slot */}
            <div className="animate-fade-in-up">
              {children}
            </div>
        </div>
      </main>

    </div>
  );
};

export default AdminLayout;
