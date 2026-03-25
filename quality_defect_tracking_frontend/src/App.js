import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import DefectList from "./pages/DefectList";
import DefectDetail from "./pages/DefectDetail";
import DefectForm from "./pages/DefectForm";
import "./App.css";

/**
 * PUBLIC_INTERFACE
 * Main application component with routing.
 */
function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/defects" element={<DefectList />} />
        <Route path="/defects/new" element={<DefectForm />} />
        <Route path="/defects/:defectId" element={<DefectDetail />} />
        <Route path="/defects/:defectId/edit" element={<DefectForm />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
