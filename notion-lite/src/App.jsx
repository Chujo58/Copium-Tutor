import React from "react";

import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import { UserDashboard, LandingPage } from "./components/Page";
import CoursePage from "./pages/CoursePage";


export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/project/:projectId" element={<CoursePage />} />
            </Routes>
        </Router>
    );
}
