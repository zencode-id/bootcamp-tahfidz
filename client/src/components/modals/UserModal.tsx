import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import type { UserData } from "../../store/userStore";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean>;
  user?: UserData | null; // If provided, we are in Edit mode
  isLoading: boolean;
}

const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  user,
  isLoading,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as "admin" | "teacher" | "parent" | "student",
    isActive: true,
    phone: "",
    nip: "",
    specialization: "",
    startDate: "",
    totalHafalan: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        password: "", // Don't fill password on edit
        role: user.role,
        isActive: user.isActive,
        phone: user.phone || "",
        nip: user.nip || "",
        specialization: user.specialization || "",
        startDate: user.startDate || "",
        totalHafalan: user.totalHafalan ? String(user.totalHafalan) : "",
      });
    } else {
      setFormData({
        name: "",
        email: "",
        password: "",
        role: "student",
        isActive: true,
        phone: "",
        nip: "",
        specialization: "",
        startDate: "",
        totalHafalan: "",
      });
    }
  }, [user, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md p-6 relative animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-6">
          {user ? "Edit User" : "Add New User"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              className="input-field w-full"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g. Ahmad Fulan"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              className="input-field w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Password {user && <span className="text-[10px] text-slate-500">(Leave blank to keep current)</span>}
            </label>
            <input
              type="password"
              required={!user} // Required only for new users
              className="input-field w-full"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder={user ? "••••••••" : "Enter secure password"}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Role
              </label>
              <select
                className="input-field w-full"
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as any })
                }
              >
                <option value="student">Student</option>
                <option value="parent">Parent</option>
                <option value="teacher">Teacher</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Status
              </label>
              <select
                className="input-field w-full"
                value={formData.isActive ? "active" : "inactive"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    isActive: e.target.value === "active",
                  })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
             <label className="block text-xs font-medium text-slate-400 mb-1">
               Phone Number
             </label>
             <input
               type="text"
               className="input-field w-full"
               value={formData.phone}
               onChange={(e) =>
                 setFormData({ ...formData, phone: e.target.value })
               }
               placeholder="e.g. 08123456789"
             />
           </div>

           {(formData.role === "teacher" || formData.role === "admin") && (
             <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      NIP (Nomor Induk Pegawai)
                    </label>
                    <input
                      type="text"
                      className="input-field w-full"
                      value={formData.nip}
                      onChange={(e) =>
                        setFormData({ ...formData, nip: e.target.value })
                      }
                      placeholder="e.g. 19800101..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Specialization
                    </label>
                    <input
                      type="text"
                      className="input-field w-full"
                      value={formData.specialization}
                      onChange={(e) =>
                        setFormData({ ...formData, specialization: e.target.value })
                      }
                      placeholder="e.g. Tahsin, Tajwid"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Start Teaching Date
                    </label>
                    <input
                      type="date"
                      className="input-field w-full"
                      value={formData.startDate}
                      onChange={(e) =>
                        setFormData({ ...formData, startDate: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">
                      Total Juz Memorized
                    </label>
                    <input
                      type="number"
                      className="input-field w-full"
                      value={formData.totalHafalan}
                      onChange={(e) =>
                        setFormData({ ...formData, totalHafalan: e.target.value })
                      }
                      placeholder="e.g. 30"
                    />
                  </div>
                </div>
             </>
           )}

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary px-6 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Saving..." : user ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserModal;
