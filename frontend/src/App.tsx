import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AnalyzePage from './pages/Analyze';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"        element={<AnalyzePage />} />
        <Route path="/analyze" element={<AnalyzePage />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}