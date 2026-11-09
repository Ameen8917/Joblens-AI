import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AnalyzePage from './pages/Analyze';

// One layout route, so an in-progress analysis survives moving between pages.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AnalyzePage />}>
          <Route path="/" />
          <Route path="/analyze" />
          <Route path="/history" />
          <Route path="/settings" />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
