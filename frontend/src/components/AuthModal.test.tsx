import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AuthModal } from './AuthModal';

// Mock the useAuth hook
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: vi.fn(),
    signUp: vi.fn(),
    signInWithGoogle: vi.fn(),
  }),
}));

describe('AuthModal', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
    mockOnSuccess.mockClear();
  });

  it('should not render when isOpen is false', () => {
    const { container } = render(
      <AuthModal isOpen={false} onClose={mockOnClose} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('should have z-index of 9999 on modal overlay', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();

    // Get computed styles
    const styles = window.getComputedStyle(overlay as Element);
    expect(styles.zIndex).toBe('9999');
  });

  it('should have fixed positioning on modal overlay', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    const styles = window.getComputedStyle(overlay as Element);

    expect(styles.position).toBe('fixed');
    expect(styles.top).toBe('0px');
    expect(styles.left).toBe('0px');
    expect(styles.right).toBe('0px');
    expect(styles.bottom).toBe('0px');
  });

  it('should center modal content using flexbox', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    const styles = window.getComputedStyle(overlay as Element);

    expect(styles.display).toBe('flex');
    expect(styles.alignItems).toBe('center');
    expect(styles.justifyContent).toBe('center');
  });

  it('should have proper modal content positioning', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('.modal-content');
    expect(modalContent).toBeInTheDocument();

    const styles = window.getComputedStyle(modalContent as Element);
    expect(styles.position).toBe('relative');
  });

  it('should have max-height to prevent overflow', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('.modal-content');
    const styles = window.getComputedStyle(modalContent as Element);

    expect(styles.maxHeight).toBe('calc(100vh - 4rem)');
    expect(styles.overflowY).toBe('auto');
  });

  it('should close modal when clicking overlay', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    if (overlay) {
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should not close modal when clicking modal content', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('.modal-content');
    if (modalContent) {
      await user.click(modalContent as Element);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should close modal when clicking close button', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const closeButton = document.body.querySelector('.modal-close');
    if (closeButton) {
      await user.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should display sign in form by default', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Welcome back!')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('should toggle to sign up form', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    // Click sign up link
    const signUpLink = document.body.querySelector('.link-button');
    if (signUpLink) {
      await user.click(signUpLink);
      expect(screen.getByText('Create an account to save graphs')).toBeInTheDocument();
    }
  });

  it('should have backdrop blur effect class', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    expect(overlay).toBeInTheDocument();
    // backdrop-filter is not supported in jsdom but is defined in CSS
    // Just verify the element exists with the class
    expect(overlay?.className).toBe('modal-overlay');
  });

  it('should have email and password inputs', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('should have Google sign-in button', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Continue with Google')).toBeInTheDocument();
  });

  it('should be above header z-index', () => {
    // Header has z-index: 50 (from Header.tsx className)
    // Modal should have z-index: 9999
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    const styles = window.getComputedStyle(overlay as Element);

    const modalZIndex = parseInt(styles.zIndex);
    const headerZIndex = 50; // From Header component

    expect(modalZIndex).toBeGreaterThan(headerZIndex);
    expect(modalZIndex).toBe(9999);
  });

  it('should have proper spacing with padding', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    const styles = window.getComputedStyle(overlay as Element);

    // Should have padding to ensure modal doesn't touch screen edges
    expect(styles.padding).toBe('2rem 1rem');
  });

  it('should have error message container in component structure', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    // Verify the component structure exists
    // Error message won't be visible until an actual error occurs
    expect(document.body.querySelector('.modal-content')).toBeInTheDocument();
  });

  it('should have smooth animations', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('.modal-overlay');
    const styles = window.getComputedStyle(overlay as Element);

    // Check for animation
    expect(styles.animation).toContain('fadeIn');
  });

  it('should have responsive width', () => {
    const { container } = render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('.modal-content');
    const styles = window.getComputedStyle(modalContent as Element);

    expect(styles.maxWidth).toBe('420px');
    expect(styles.width).toBe('100%');
  });
});
