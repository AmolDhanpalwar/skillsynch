import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Dashboard from '../components/Dashboard';
import Toast from '../components/form/Toast';

export default function DashboardPage() {
  const location = useLocation();
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  useEffect(() => {
    const state = location.state as { toast?: string } | null;
    if (state?.toast) {
      setToastMsg(state.toast);
      setToastVisible(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  return (
    <AppShell>
      <Dashboard />
      <Toast
        message={toastMsg}
        visible={toastVisible}
        onDismiss={() => setToastVisible(false)}
      />
    </AppShell>
  );
}
