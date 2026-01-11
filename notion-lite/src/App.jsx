import React from "react";

import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
} from "react-router-dom";
import CoursePage from "./pages/CoursePage";
import FlashcardsHomePage from "./pages/FlashcardsHomePage";
import DeckPage from "./pages/DeckPage";
import { LandingPage } from "./pages/LandingPage";
import { UserDashboard } from "./pages/Dashboard";



export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/project/:projectId" element={<CoursePage />} />
                <Route path="/project/:projectId/flashcards" element={<FlashcardsHomePage />} />
                <Route path="/project/:projectId/flashcards/:deckId" element={<DeckPage />} />
            </Routes>
        </Router>
    );
}
