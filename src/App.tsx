import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
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
        <PreferencesProvider>
          <AuthProvider>
            <BrowserRouter>
              <KeyboardShortcutsProvider>
                <Toaster
                  position="top-right"
                  toastOptions={{
                    style: {
                      background: '#1e293b',
                      color: '#f1f5f9',
                      border: '1px solid #334155',
                      borderRadius: '10px',
                      fontSize: '14px',
                    },
                    success: { iconTheme: { primary: '#f59e0b', secondary: '#1e293b' } },
                    error: { iconTheme: { primary: '#ef4444', secondary: '#1e293b' } },
                  }}
                />
                <Routes>
                  <Route path="/auth" element={<AuthForm />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <ErrorBoundary>
                          <HomePage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/new"
                    element={
                      <ProtectedRoute>
                        <ErrorBoundary>
                          <ExamSetupWizard />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/exam/:examId"
                    element={
                      <ProtectedRoute>
                        <ErrorBoundary>
                          <ExamSchedulePage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </KeyboardShortcutsProvider>
            </BrowserRouter>
          </AuthProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
