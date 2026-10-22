import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Navbar } from '@/components/Navbar';

// Mock Next.js routing
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/'),
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock framer-motion to avoid animation issues in tests
jest.mock('framer-motion', () => ({
  motion: {
    nav: ({ children, ...props }: any) => <nav {...props}>{children}</nav>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  useScroll: jest.fn(() => ({ scrollY: { get: () => 0 } })),
  useMotionValueEvent: jest.fn(),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock Auth Context
jest.mock('@/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));
import { useAuth } from '@/context/AuthContext';

describe('Navbar Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default window width to desktop
    window.innerWidth = 1200;
  });

  it('renders brand logo and all desktop navigation links with correct destinations', () => {
    jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
    render(<Navbar />);

    // Brand logo
    expect(screen.getByText('CodeSkill')).toBeInTheDocument();

    // 5 Core Navigation Links
    expect(screen.getByRole('link', { name: 'Problems', exact: true })).toHaveAttribute('href', '/problems');
    expect(screen.getByRole('link', { name: 'Assessments', exact: true })).toHaveAttribute('href', '/assessments');
    expect(screen.getByRole('link', { name: 'Contests', exact: true })).toHaveAttribute('href', '/contests');
    expect(screen.queryByRole('link', { name: 'Contests Leaderboard', exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Leaderboard', exact: true })).toHaveAttribute('href', '/leaderboard');
    expect(screen.getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('href', '/dashboard');
  });

  it('renders Get Started button for guests on desktop', () => {
    jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
    render(<Navbar />);

    expect(screen.queryByRole('link', { name: 'Log In' })).not.toBeInTheDocument();

    const getStartedLinks = screen.getAllByRole('link', { name: /Get Started/i });
    expect(getStartedLinks.length).toBe(1);
  });

  it('renders user profile and sign out for authenticated students', () => {
    const mockLogout = jest.fn();
    jest.mocked(useAuth).mockReturnValue({
      user: { _id: '123', name: 'Shadab Ansari', email: 'shadab@example.com', isAdmin: false },
      logout: mockLogout,
    } as any);

    render(<Navbar />);

    expect(screen.queryByRole('link', { name: 'Log In' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Shadab/i })).toHaveAttribute('href', '/profile');
    expect(screen.getByTitle('Sign Out')).toBeInTheDocument();
  });

  it('renders Admin Portal badge for admin users', () => {
    jest.mocked(useAuth).mockReturnValue({
      user: { _id: '456', name: 'Controller User', email: 'admin@cuchd.in', isAdmin: true },
      logout: jest.fn(),
    } as any);

    render(<Navbar />);

    expect(screen.getByRole('link', { name: /^Admin$/i })).toHaveAttribute('href', '/admin/dashboard');
  });

  it('toggles mobile menu when clicking hamburger button and auto-closes on link click', () => {
    jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
    render(<Navbar />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');

    // Click to open mobile menu
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // In open mobile menu, mobile drawer items are now visible
    expect(screen.getByText('Navigation')).toBeInTheDocument();

    // Clicking a link inside the mobile menu closes the drawer
    const mobileProblemsLink = screen.getAllByRole('link', { name: 'Problems' })[1];
    fireEvent.click(mobileProblemsLink);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes mobile menu when pressing Escape key', () => {
    jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
    render(<Navbar />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes mobile menu when viewport width expands to desktop (>= 1024px)', () => {
    jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
    render(<Navbar />);

    const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
    // Open on mobile width
    act(() => {
      window.innerWidth = 768;
    });
    fireEvent.click(toggleButton);
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true');

    // Resize to desktop width (e.g. 1024px)
    act(() => {
      window.innerWidth = 1024;
      window.dispatchEvent(new Event('resize'));
    });
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false');
  });

  describe('Responsive Viewport Verification (375px, 768px, 1024px, 1440px)', () => {
    it('verifies mobile layout at 375px: hamburger is available and desktop nav is hidden', () => {
      act(() => {
        window.innerWidth = 375;
      });
      jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
      render(<Navbar />);

      const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton.closest('.lg\\:hidden')).toBeInTheDocument();

      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toHaveClass('hidden');
      expect(desktopNav).toHaveClass('lg:flex');
    });

    it('verifies tablet layout at 768px: hamburger is available and desktop nav is hidden', () => {
      act(() => {
        window.innerWidth = 768;
      });
      jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
      render(<Navbar />);

      const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
      expect(toggleButton).toBeInTheDocument();
      expect(toggleButton.closest('.lg\\:hidden')).toBeInTheDocument();

      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toHaveClass('hidden');
      expect(desktopNav).toHaveClass('lg:flex');
    });

    it('verifies desktop breakpoint at 1024px: desktop navigation and auth controls are enabled, hamburger is hidden', () => {
      act(() => {
        window.innerWidth = 1024;
      });
      jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
      render(<Navbar />);

      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toHaveClass('lg:flex');

      // The toggle button's container has lg:hidden
      const toggleButton = screen.getByRole('button', { name: 'Toggle menu' });
      expect(toggleButton.closest('div')).toHaveClass('lg:hidden');

      // Desktop links are present
      expect(screen.getByRole('link', { name: 'Problems' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Assessments' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Contests' })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Contests Leaderboard' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Leaderboard' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('verifies wide desktop layout at 1440px: clean alignment and links visible', () => {
      act(() => {
        window.innerWidth = 1440;
      });
      jest.mocked(useAuth).mockReturnValue({ user: null, logout: jest.fn() } as ReturnType<typeof useAuth>);
      render(<Navbar />);

      const desktopNav = screen.getByRole('navigation');
      expect(desktopNav).toHaveClass('lg:flex');
      expect(screen.queryByRole('link', { name: 'Log In' })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: /Get Started/i })).toBeInTheDocument();
    });
  });
});
