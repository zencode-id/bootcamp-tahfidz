import React, { useEffect, useState } from "react";
import { Users, BookOpen, UserCheck, Activity } from "lucide-react";
import AdminLayout from "../components/layouts/AdminLayout";
import { useUserStore } from "../store/userStore";

const AdminDashboard: React.FC = () => {
  const { users, fetchUsers, isLoading } = useUserStore();
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalClasses: 0, // Placeholder
    activeTeachers: 0,
  });

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (users.length > 0) {
      setStats({
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive).length,
        totalClasses: 5, // Dummy for now
        activeTeachers: users.filter(u => u.role === 'teacher').length
      });
    }
  }, [users]);

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="glass-panel p-6 flex items-center justify-between hover:bg-white/5 transition-colors">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-2xl font-bold text-white">{isLoading ? "..." : value}</h3>
      </div>
      <div className={`w-12 h-12 rounded-lg ${color} flex items-center justify-center`}>
        <Icon size={24} className="text-white" />
      </div>
    </div>
  );

  return (
    <AdminLayout title="Overview">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="bg-blue-500/20 text-blue-500 border border-blue-500/30"
        />
        <StatCard
          title="Active Users"
          value={stats.activeUsers}
          icon={UserCheck}
          color="bg-emerald-500/20 text-emerald-500 border border-emerald-500/30"
        />
        <StatCard
          title="Active Teachers"
          value={stats.activeTeachers}
          icon={BookOpen}
          color="bg-purple-500/20 text-purple-500 border border-purple-500/30"
        />
        <StatCard
          title="System Status"
          value="Online"
          icon={Activity}
          color="bg-amber-500/20 text-amber-500 border border-amber-500/30"
        />
      </div>

      {/* Recent Activity Section */}
      <div className="glass-panel p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="flex gap-4">
           {/* Placeholder actions */}
           <button className="btn-primary text-sm px-4 py-2">Add New User</button>
           <button className="px-4 py-2 rounded-lg border border-white/10 text-slate-300 hover:bg-white/5 text-sm cursor-pointer">View Reports</button>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
