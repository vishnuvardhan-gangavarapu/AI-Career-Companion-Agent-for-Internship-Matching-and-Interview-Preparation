import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/Landing";
import Register from "./pages/Register";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";

import Resume from "./pages/Resume";

import DefaultDashboard from "./pages/DefaultDashboard";
import DefaultProfile from "./pages/DefaultProfile";

import UserDashboard from "./pages/UserDashboard";

import Profile from "./pages/Profile";
import Settings from "./pages/Settings";

import SavedInternships from "./pages/SavedInternships";

import Internships from "./pages/Internships";
import InternshipDetails from "./pages/InternshipDetails";

import CreateCoverLetter from "./pages/CreateCoverLetter";

import SkillGap from "./pages/SkillGap";

import Application from "./pages/Application";

import PreparationAgent from "./pages/PreparationAgent";
import PreparationChat from "./pages/PreparationChat";

import Layout from "./components/layout/Layout";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/register" element={<Register />} />

      <Route path="/login" element={<Login />} />

      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route element={<Layout />}>
        <Route path="/defaultDashboard" element={<DefaultDashboard />} />

        <Route path="/defaultProfile" element={<DefaultProfile />} />

        <Route path="/userDashboard" element={<UserDashboard />} />

        <Route path="/profile" element={<Profile />} />

        <Route path="/settings" element={<Settings />} />

        <Route path="/resume" element={<Resume />} />

        <Route path="/internships" element={<Internships />} />

        <Route
          path="/internships/:internshipId"
          element={<InternshipDetails />}
        />

        <Route path="/saved-internships" element={<SavedInternships />} />

        <Route path="/cover-letters/create" element={<CreateCoverLetter />} />

        <Route path="/skill-gap" element={<SkillGap />} />

        <Route path="/applications" element={<Application />} />

        <Route path="/preparation-agent" element={<PreparationAgent />} />
        <Route path="/preparation-chat" element={<PreparationChat />} />

        <Route
          path="/dashboard"
          element={<Navigate to="/defaultDashboard" replace />}
        />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
