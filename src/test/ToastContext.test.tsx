import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../context/ToastContext';

// ─── Helper consumer ──────────────────────────────────────────────────────────

function ToastConsumer() {
  const ctx = useToast();
  return (
    <div>
      <button onClick={() => ctx.success('Saved successfully')}>Success</button>
      <button onClick={() => ctx.error('Something went wrong')}>Error</button>
      <button onClick={() => ctx.info('Did you know?')}>Info</button>
      <button onClick={() => ctx.warning('Be careful')}>Warning</button>
      <button onClick={() => ctx.toast('Custom message', 'info')}>Custom</button>
    </div>
  );
}

function renderToasts() {
  return render(
    <ToastProvider>
      <ToastConsumer />
    </ToastProvider>
  );
}

describe('ToastContext — rendering', () => {
  it('renders no toast text on initial mount', () => {
    renderToasts();
    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });

  it('shows a success toast when success() is called', async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByText('Success'));
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('shows an error toast when error() is called', async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByText('Error'));
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows an info toast when info() is called', async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByText('Info'));
    expect(screen.getByText('Did you know?')).toBeInTheDocument();
  });

  it('shows a warning toast when warning() is called', async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByText('Warning'));
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('shows a toast with custom message via toast()', async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByText('Custom'));
    expect(screen.getByText('Custom message')).toBeInTheDocument();
  });

  it('multiple toasts can be visible at the same time', async () => {
    const user = userEvent.setup();
    renderToasts();
    await user.click(screen.getByText('Success'));
    await user.click(screen.getByText('Error'));
    await user.click(screen.getByText('Info'));
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Did you know?')).toBeInTheDocument();
  });
});

describe('ToastContext — auto-dismiss with fake timers', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('toast is removed from DOM after 3500ms + 300ms animation', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );

    // Trigger toast — use act so state update is flushed
    await act(async () => {
      screen.getByText('Success').click();
    });

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();

    // Advance past auto-dismiss (3500ms) then flush the removal animation (300ms)
    await act(async () => { vi.advanceTimersByTime(3500); });
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });

  it('dismiss button removes toast before auto-dismiss', async () => {
    render(
      <ToastProvider>
        <ToastConsumer />
      </ToastProvider>
    );

    await act(async () => {
      screen.getByText('Success').click();
    });

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();

    // Find the X dismiss button (not one of the labelled trigger buttons)
    const buttons = screen.getAllByRole('button');
    const dismissBtn = buttons.find(
      btn => !['Success','Error','Info','Warning','Custom'].includes(btn.textContent?.trim() ?? '')
    );
    expect(dismissBtn).toBeDefined();

    await act(async () => {
      dismissBtn!.click();
    });

    // Advance past the removal animation
    await act(async () => { vi.advanceTimersByTime(400); });

    expect(screen.queryByText('Saved successfully')).not.toBeInTheDocument();
  });
});

describe('ToastContext — max toast limit', () => {
  it('keeps at most 5 toasts visible (slice(-4) + 1 new = 5 max)', async () => {
    function ManyToasts() {
      const { toast } = useToast();
      return (
        <button onClick={() => {
          for (let i = 1; i <= 7; i++) toast(`Toast ${i}`, 'info');
        }}>
          Spam
        </button>
      );
    }

    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ManyToasts />
      </ToastProvider>
    );

    await user.click(screen.getByText('Spam'));

    // Toast 1 and 2 should be evicted; Toast 3-7 visible
    expect(screen.queryByText('Toast 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Toast 2')).not.toBeInTheDocument();
    expect(screen.getByText('Toast 7')).toBeInTheDocument();
  });
});

describe('ToastContext — error guard', () => {
  it('throws when useToast is called outside ToastProvider', () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    const consoleError = console.error;
    console.error = () => {};
    expect(() => render(<BadConsumer />)).toThrow('useToast must be used within ToastProvider');
    console.error = consoleError;
  });
});

describe('ToastContext — aria-live region', () => {
  it('renders an aria-live="polite" region for accessibility', () => {
    render(
      <ToastProvider>
        <div />
      </ToastProvider>
    );
    const region = document.querySelector('[aria-live="polite"]');
    expect(region).toBeInTheDocument();
  });
});
