import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

const mockLogin = vi.fn();

vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    login: mockLogin,
    user: null,
    isLoading: false,
    logout: vi.fn(),
    hasPermission: () => false,
  }),
}));

describe('LoginPage', () => {
  it('displays validation errors when submitted empty', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/valid email is required/i)).toBeInTheDocument();
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('submits valid credentials', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/email address/i), 'agent1@queuedesk.local');
    await user.type(screen.getByLabelText(/password/i), 'QueueDesk!Agent2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockLogin).toHaveBeenCalledWith({
      email: 'agent1@queuedesk.local',
      password: 'QueueDesk!Agent2026',
    });
  });
});
