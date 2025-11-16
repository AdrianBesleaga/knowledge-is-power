import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './contexts/ThemeContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { GraphViewPage } from './pages/GraphViewPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { KnowledgeGraphPage } from './pages/KnowledgeGraphPage';
import { PredictionPage } from './pages/PredictionPage';
import { BuyCreditsPage } from './pages/BuyCreditsPage';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="min-h-screen flex flex-col bg-gray-900 transition-colors duration-300">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/graph/:slug" element={<GraphViewPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
                <Route path="/predictions" element={<PredictionPage />} />
                <Route path="/predictions/:slug" element={<PredictionPage />} />
                <Route path="/buy-credits" element={<BuyCreditsPage />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
