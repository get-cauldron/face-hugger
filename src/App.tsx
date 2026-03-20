import { useState, useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { checkExistingToken, validateToken } from './commands/auth';
import LoginScreen from './components/auth/LoginScreen';
import SplashScreen from './components/auth/SplashScreen';
import AppShell from './components/shell/AppShell';

function App() {
  const { isAuthenticated, setAuth } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkExistingToken()
      .then(async (token) => {
        if (token) {
          try {
            const userInfo = await validateToken(token);
            setAuth(token, userInfo);
          } catch {
            // Token exists but invalid — show login
          }
        }
      })
      .finally(() => setChecking(false));
  }, [setAuth]);

  if (checking) return <SplashScreen />;
  return isAuthenticated ? <AppShell /> : <LoginScreen />;
}

export default App;
