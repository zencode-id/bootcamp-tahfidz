import React, { useState, useEffect } from "react";
import { X, Check } from "lucide-react";
import type { ClassData } from "../../store/classStore";
import type { UserData } from "../../store/userStore";

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<ClassData, "id" | "createdAt">) => Promise<boolean>;
  classData?: ClassData | null;
  teachers: UserData[];
  students: UserData[];
  isLoading?: boolean;
}

const ClassModal: React.FC<ClassModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  classData,
  teachers,
  students,
  isLoading,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    schedule: "",
    teacherId: "",
    studentIds: [] as string[],
  });

  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    if (classData) {
      setFormData({
        name: classData.name || "",
        schedule: classData.schedule || "",
        teacherId: classData.teacherId || "",
        studentIds: classData.studentIds || [],
      });
    } else {
      setFormData({
        name: "",
        schedule: "",
        teacherId: "",
        studentIds: [],
      });
    }
    setStudentSearch("");
  }, [classData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onSubmit(formData);
    if (success) {
      onClose();
    }
  };

  const toggleStudent = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
  };

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(studentSearch.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative glass-panel w-full max-w-2xl mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">
            {classData ? "Edit Class" : "Create New Class"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Class Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Class Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g., Tahfidz Level 1"
              required
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Schedule
            </label>
            <input
              type="text"
              value={formData.schedule}
              onChange={(e) =>
                setFormData({ ...formData, schedule: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="e.g., Mon-Fri 08:00-10:00"
            />
          </div>

          {/* Teacher Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Teacher
            </label>
            <select
              value={formData.teacherId}
              onChange={(e) =>
                setFormData({ ...formData, teacherId: e.target.value })
              }
              className="w-full px-4 py-2.5 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="">-- Select Teacher --</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name} ({teacher.email})
                </option>
              ))}
            </select>
          </div>

          {/* Student Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Students ({formData.studentIds.length} selected)
            </label>
            <input
              type="text"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full px-4 py-2 mb-2 bg-slate-900/50 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors text-sm"
              placeholder="Search students..."
            />
            <div className="max-h-48 overflow-y-auto border border-white/10 rounded-lg bg-slate-900/30">
              {filteredStudents.length === 0 ? (
                <div className="p-3 text-center text-slate-500 text-sm">
                  No students found
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors ${
                      formData.studentIds.includes(student.id)
                        ? "bg-indigo-500/10"
                        : ""
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        formData.studentIds.includes(student.id)
                          ? "bg-indigo-500 border-indigo-500"
                          : "border-white/20"
                      }`}
                    >
                      {formData.studentIds.includes(student.id) && (
                        <Check size={14} className="text-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">
                        {student.name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {student.email}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
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
              {isLoading
                ? "Saving..."
                : classData
                ? "Update Class"
                : "Create Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ClassModal;
