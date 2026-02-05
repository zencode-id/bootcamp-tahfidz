import React, { useEffect, useState } from "react";
import { Search, Plus, Trash2, Edit, Users, RefreshCw } from "lucide-react";
import AdminLayout from "../components/layouts/AdminLayout";
import { useClassStore, type ClassData } from "../store/classStore";
import { useUserStore } from "../store/userStore";
import ClassModal from "../components/modals/ClassModal";

const ClassesPage: React.FC = () => {
  const { classes, isLoading, fetchClasses, createClass, updateClass, deleteClass, cleanupInactiveStudents } = useClassStore();
  const { users, fetchUsers } = useUserStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchClasses();
    fetchUsers();
  }, [fetchClasses, fetchUsers]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const teachers = users.filter((u) => u.role?.toLowerCase() === "teacher");
  const students = users.filter((u) => u.role?.toLowerCase() === "student");

  const filteredClasses = classes.filter((c) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredClasses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedClasses = filteredClasses.slice(startIndex, startIndex + itemsPerPage);

  const handleAddClass = () => {
    setSelectedClass(null);
    setIsModalOpen(true);
  };

  const handleEditClass = (classData: ClassData) => {
    setSelectedClass(classData);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: Omit<ClassData, "id" | "createdAt">) => {
    if (selectedClass) {
      return await updateClass(selectedClass.id, data);
    } else {
      return await createClass(data);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this class?")) {
      await deleteClass(id);
    }
  };

  const handleCleanupInactive = async () => {
    if (confirm("This will remove all inactive students from all classes. Continue?")) {
      const removed = await cleanupInactiveStudents();
      alert(`Removed ${removed} inactive students from classes.`);
    }
  };

  // Helper to get teacher name by ID
  const getTeacherName = (teacherId?: string) => {
    if (!teacherId) return "-";
    const teacher = users.find((u) => u.id === teacherId);
    return teacher ? teacher.name : "-";
  };

  return (
    <AdminLayout title="Class Management">
      {/* Actions Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search classes..."
            className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white focus:outline-none focus:border-indigo-500 transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCleanupInactive}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg border border-orange-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            Cleanup Inactive
          </button>
          <button
            onClick={handleAddClass}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={18} />
            Add New Class
          </button>
        </div>
      </div>

      {/* Classes Table */}
      <div className="glass-panel overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-medium">Class Name</th>
                <th className="p-4 font-medium">Teacher</th>
                <th className="p-4 font-medium">Schedule</th>
                <th className="p-4 font-medium">Students</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    Loading classes...
                  </td>
                </tr>
              ) : filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No classes found. Click "Add New Class" to create one.
                  </td>
                </tr>
              ) : (
                paginatedClasses.map((classItem) => (
                  <tr key={classItem.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-white font-medium">{classItem.name}</td>
                    <td className="p-4 text-slate-300">{getTeacherName(classItem.teacherId)}</td>
                    <td className="p-4 text-slate-400">{classItem.schedule || "-"}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Users size={16} className="text-indigo-400" />
                        <span>{classItem.studentIds?.length || 0}</span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEditClass(classItem)}
                          className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(classItem.id)}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {!isLoading && filteredClasses.length > itemsPerPage && (
        <div className="flex justify-between items-center text-sm text-slate-400">
          <div>
            Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredClasses.length)} of {filteredClasses.length} classes
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1 rounded transition-colors ${
                  currentPage === page
                    ? "bg-indigo-500 text-white"
                    : "bg-white/5 hover:bg-white/10"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Class Modal */}
      <ClassModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        classData={selectedClass}
        teachers={teachers}
        students={students}
        isLoading={isLoading}
      />
    </AdminLayout>
  );
};

export default ClassesPage;
