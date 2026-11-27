import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/lib/toast-context';
import { TicketsPage } from './TicketsPage';

vi.mock('@/lib/api-client', () => ({
  apiRequest: vi.fn((path: string) => {
    if (path.startsWith('/tickets')) {
      return Promise.resolve({
        data: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            ticketNumber: 101,
            subject: 'Synthetic billing mismatch',
            descriptionPreview: 'Preview...',
            status: 'open',
            priority: 'high',
            queueId: 'q1',
            queueName: 'Billing & Payments',
            assignedAgentId: null,
            assignedAgentName: null,
            requesterName: 'Jordan Lee',
            requesterEmail: 'jordan@synthetic.example.com',
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            resolvedAt: null,
          },
        ],
        meta: { page: 1, pageSize: 25, totalCount: 1, totalPages: 1 },
      });
    }
    return Promise.resolve({ data: [] });
  }),
}));

describe('TicketsPage', () => {
  it('renders tickets returned from the API with exact count', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <ToastProvider>
          <MemoryRouter>
            <TicketsPage />
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText(/synthetic billing mismatch/i)).toBeInTheDocument();
    expect(screen.getByText(/1 matching tickets/i)).toBeInTheDocument();
  });
});
