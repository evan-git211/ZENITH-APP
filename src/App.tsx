import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthForm } from './components/Auth';
import { HomePage } from './pages/HomePage';
import { ExamSetupWizard } from './components/ExamSetupWizard';
import { ExamSchedulePage } from './pages/ExamSchedulePage';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcuts';
import { ErrorBoundary } from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <KeyboardShortcutsProvider>
              <Routes>
                <Route path="/auth" element={<AuthForm />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <HomePage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/new"
                  element={
                    <ProtectedRoute>
                      <ExamSetupWizard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/exam/:examId"
                  element={
                    <ProtectedRoute>
                      <ExamSchedulePage />
                    </ProtectedRoute>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </KeyboardShortcutsProvider>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
