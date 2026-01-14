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
import QuizzesHomePage from "./pages/QuizzesHomePage";
import QuizPage from "./pages/QuizPage";
import AllFlashcardsPage from "./pages/AllFlashcardsPage";
import AllQuizzesPage from "./pages/AllQuizzesPage";
import AllChatsPage from "./pages/AllChatsPage";
import { LandingPage } from "./pages/LandingPage";
import { UserDashboard } from "./pages/Dashboard";
import CourseChatPage from "./pages/CourseChatPage";
import FeaturesPage from "./pages/FeaturesPage";
import BackboardThanksPage from "./pages/BackboardThanksPage";



export default function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/flashcards" element={<AllFlashcardsPage />} />
                <Route path="/quizzes" element={<AllQuizzesPage />} />
                <Route path="/chats" element={<AllChatsPage />} />
                <Route path="/features" element={<FeaturesPage />} />
                <Route path="/backboard" element={<BackboardThanksPage />} />
                <Route path="/project/:projectid" element={<CoursePage />} />
                <Route path="/project/:projectid/flashcards" element={<FlashcardsHomePage />} />
                <Route path="/project/:projectid/flashcards/:deckId" element={<DeckPage />} />
                <Route path="/project/:projectid/chat/:chatid" element={<CourseChatPage />} />
                <Route path="/project/:projectid/quizzes" element={<QuizzesHomePage />} />
                <Route path="/project/:projectid/quizzes/:quizId" element={<QuizPage />} />
            </Routes>
        </Router>
    );
}
