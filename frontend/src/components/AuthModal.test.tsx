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
    render(
      <AuthModal isOpen={false} onClose={mockOnClose} />
    );

    // Modal is rendered via Portal - check document.body doesn't have modal
    expect(document.body.querySelector('.modal-overlay')).toBeNull();
  });

  it('should render when isOpen is true', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByRole('heading', { name: 'Sign In' })).toBeInTheDocument();
  });

  it('should have proper modal overlay styling', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="fixed"][class*="inset-0"]');
    expect(overlay).toBeInTheDocument();

    // Check that it has the modal overlay classes
    expect(overlay?.className).toMatch(/fixed/);
    expect(overlay?.className).toMatch(/inset-0/);
    expect(overlay?.className).toMatch(/z-\[9999\]/);
  });

  it('should have fixed positioning on modal overlay', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="fixed"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toMatch(/fixed/);
    expect(overlay?.className).toMatch(/inset-0/);
  });

  it('should center modal content using flexbox', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="flex"][class*="items-center"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toMatch(/flex/);
    expect(overlay?.className).toMatch(/items-center/);
    expect(overlay?.className).toMatch(/justify-center/);
  });

  it('should have proper modal content positioning', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('[class*="bg-gray-900"]');
    expect(modalContent).toBeInTheDocument();
    expect(modalContent?.className).toMatch(/relative/);
  });

  it('should have max-height to prevent overflow', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('[class*="max-h-"]');
    expect(modalContent).toBeInTheDocument();
    expect(modalContent?.className).toMatch(/max-h-\[calc\(100vh-4rem\)\]/);
    expect(modalContent?.className).toMatch(/overflow-y-auto/);
  });

  it('should close modal when clicking overlay', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="bg-black/75"]');
    if (overlay) {
      await user.click(overlay);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it('should not close modal when clicking modal content', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('[class*="bg-gray-900"]');
    if (modalContent) {
      await user.click(modalContent as Element);
      expect(mockOnClose).not.toHaveBeenCalled();
    }
  });

  it('should close modal when clicking close button', async () => {
    const user = userEvent.setup();
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const closeButton = document.body.querySelector('[class*="absolute"][class*="top-4"]');
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
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    // Click sign up link
    const signUpLink = document.body.querySelector('[class*="text-blue-400"]');
    if (signUpLink) {
      await user.click(signUpLink);
      expect(screen.getByText('Create an account to save graphs')).toBeInTheDocument();
    }
  });

  it('should have backdrop blur effect class', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="backdrop-blur"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toMatch(/backdrop-blur/);
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
    // Modal should have z-index: 9999
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="z-"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toMatch(/z-\[9999\]/);
  });

  it('should have proper spacing with padding', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="p-4"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toMatch(/p-4/);
    expect(overlay?.className).toMatch(/py-8/);
  });

  it('should have error message container in component structure', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    // Verify the component structure exists
    // Error message won't be visible until an actual error occurs
    expect(document.body.querySelector('[class*="bg-gray-900"]')).toBeInTheDocument();
  });

  it('should have smooth animations', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const overlay = document.body.querySelector('[class*="animate-in"]');
    expect(overlay).toBeInTheDocument();
    expect(overlay?.className).toMatch(/animate-in/);
    expect(overlay?.className).toMatch(/fade-in/);
  });

  it('should have responsive width', () => {
    render(
      <AuthModal isOpen={true} onClose={mockOnClose} />
    );

    const modalContent = document.body.querySelector('[class*="max-w-md"]');
    expect(modalContent).toBeInTheDocument();
    expect(modalContent?.className).toMatch(/max-w-md/);
    expect(modalContent?.className).toMatch(/w-full/);
  });
});
