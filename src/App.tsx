import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PreferencesProvider } from './contexts/PreferencesContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

const AuthForm = lazy(() => import('./components/Auth').then(m => ({ default: m.AuthForm })));
const HomePage = lazy(() => import('./pages/HomePage').then(m => ({ default: m.HomePage })));
const ExamSetupWizard = lazy(() => import('./components/ExamSetupWizard').then(m => ({ default: m.ExamSetupWizard })));
const ExamSchedulePage = lazy(() => import('./pages/ExamSchedulePage').then(m => ({ default: m.ExamSchedulePage })));
const KeyboardShortcutsProvider = lazy(() => import('./components/KeyboardShortcuts').then(m => ({ default: m.KeyboardShortcutsProvider })));

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
    <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <PreferencesProvider>
          <AuthProvider>
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
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
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
