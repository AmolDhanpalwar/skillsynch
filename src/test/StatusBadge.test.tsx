import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/form/StatusBadge';
import type { FormStatus } from '../types';

describe('StatusBadge', () => {
  const statuses: FormStatus[] = ['draft', 'pending_review', 'returned', 'approved'];

  it('renders without crashing for each status', () => {
    statuses.forEach(status => {
      const { unmount } = render(<StatusBadge status={status} />);
      unmount();
    });
  });

  it('shows "Draft" label for draft status', () => {
    render(<StatusBadge status="draft" />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('shows "Pending Review" label for pending_review status', () => {
    render(<StatusBadge status="pending_review" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();
  });

  it('shows "Returned" label for returned status', () => {
    render(<StatusBadge status="returned" />);
    expect(screen.getByText('Returned')).toBeInTheDocument();
  });

  it('shows "Approved" label for approved status', () => {
    render(<StatusBadge status="approved" />);
    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders as an inline span element', () => {
    render(<StatusBadge status="draft" />);
    const el = screen.getByText('Draft').closest('span');
    expect(el?.tagName).toBe('SPAN');
  });

  it('applies different class for approved vs draft (smoke test for styling)', () => {
    const { container: c1, unmount: u1 } = render(<StatusBadge status="approved" />);
    const approvedClass = c1.querySelector('span')?.className ?? '';
    u1();
    const { container: c2 } = render(<StatusBadge status="draft" />);
    const draftClass = c2.querySelector('span')?.className ?? '';
    expect(approvedClass).not.toBe(draftClass);
  });

  it('contains a dot indicator element inside the badge', () => {
    const { container } = render(<StatusBadge status="approved" />);
    const badge = container.querySelector('span');
    const dot = badge?.querySelector('span');
    expect(dot).toBeInTheDocument();
  });
});
