import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ReviewPage from './pages/ReviewPage';
import SourcesPage from './pages/SourcesPage';
import QuizPage from './pages/QuizPage';
import CardsPage from './pages/CardsPage';
import SettingsPage from './pages/SettingsPage';
import { useStore } from './hooks/useStore';

function App() {
  const apiKey = useStore((state) => state.apiKey);

  // If no API key is set, redirect to settings
  if (!apiKey) {
    return (
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/review" replace />} />
        <Route path="/review" element={<ReviewPage />} />
        <Route path="/sources" element={<SourcesPage />} />
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}

export default App;
