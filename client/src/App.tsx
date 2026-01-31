import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import OTP from "./pages/OTP";
import ForgotPassword from "./pages/ForgotPassword";
import Home from "./pages/Home";
import DummyDashboard from "./pages/DummyDashboard";

import AdminDashboard from "./pages/AdminDashboard";
import TeacherDashboard from "./pages/TeacherDashboard";
import ParentDashboard from "./pages/ParentDashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/otp" element={<OTP />} />
        <Route path="/reset-password" element={<ForgotPassword />} />

        <Route path="/dashboard" element={<Home />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />
        <Route path="/parent/dashboard" element={<ParentDashboard />} />

        <Route path="/dummy" element={<DummyDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
