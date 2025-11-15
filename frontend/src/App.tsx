import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { GraphViewPage } from './pages/GraphViewPage';
import { ProfilePage } from './pages/ProfilePage';
import { SearchPage } from './pages/SearchPage';
import { PredictionPage } from './pages/PredictionPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <Header />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/graph/:slug" element={<GraphViewPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/timeline" element={<PredictionPage />} />
            <Route path="/timeline/:slug" element={<PredictionPage />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

