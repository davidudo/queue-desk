import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createTicketSchema,
  TICKET_PRIORITIES,
  type AgentDTO,
  type CreateTicketInput,
  type QueueDTO,
  type TicketDetailDTO,
} from '@queuedesk/shared';
import { Button, Dialog, Input, Select, Textarea } from '@/components/ui/primitives';
import { apiRequest } from '@/lib/api-client';
import { useToast } from '@/lib/toast-context';

export function CreateTicketDialog({
  open,
  onClose,
  queues,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  queues: QueueDTO[];
  agents: AgentDTO[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<CreateTicketInput>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      subject: '',
      description: '',
      priority: 'medium',
      queueId: queues[0]?.id ?? '',
      assignedAgentId: null,
      requesterName: '',
      requesterEmail: '',
      tagIds: [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: CreateTicketInput) => {
      const payload = {
        ...values,
        assignedAgentId: values.assignedAgentId || null,
      };
      const res = await apiRequest<TicketDetailDTO>('/tickets', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return res.data;
    },
    onSuccess: (created) => {
      toast(`Ticket #${created.ticketNumber} created`);
      void queryClient.invalidateQueries({ queryKey: ['tickets'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      reset();
      onClose();
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : 'Failed to create ticket', 'error');
    },
  });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create Support Ticket"
      description="Log a new customer issue and route it to the appropriate queue."
    >
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="create-subject" className="text-sm font-medium">
            Subject
          </label>
          <Input
            id="create-subject"
            placeholder="Brief summary of the issue"
            {...register('subject')}
          />
          {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="create-queue" className="text-sm font-medium">
              Queue
            </label>
            <Select
              id="create-queue"
              aria-label="Queue"
              value={watch('queueId')}
              placeholder="Select queue"
              onValueChange={(val) => setValue('queueId', val, { shouldValidate: true })}
              options={queues.map((q) => ({ value: q.id, label: q.name }))}
            />
            {errors.queueId && <p className="text-xs text-destructive">{errors.queueId.message}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="create-priority" className="text-sm font-medium">
              Priority
            </label>
            <Select
              id="create-priority"
              aria-label="Priority"
              value={watch('priority')}
              onValueChange={(val) =>
                setValue('priority', val as CreateTicketInput['priority'], {
                  shouldValidate: true,
                })
              }
              options={TICKET_PRIORITIES.map((p) => ({ value: p, label: p.toUpperCase() }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="create-req-name" className="text-sm font-medium">
              Requester Name
            </label>
            <Input id="create-req-name" placeholder="Jordan Lee" {...register('requesterName')} />
            {errors.requesterName && (
              <p className="text-xs text-destructive">{errors.requesterName.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="create-req-email" className="text-sm font-medium">
              Requester Email
            </label>
            <Input
              id="create-req-email"
              type="email"
              placeholder="jordan@example.com"
              {...register('requesterEmail')}
            />
            {errors.requesterEmail && (
              <p className="text-xs text-destructive">{errors.requesterEmail.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="create-assignee" className="text-sm font-medium">
            Assign Agent (Optional)
          </label>
          <Select
            id="create-assignee"
            aria-label="Assign Agent (Optional)"
            value={watch('assignedAgentId') ?? ''}
            onValueChange={(val) =>
              setValue('assignedAgentId', val || null, { shouldValidate: true })
            }
            options={[
              { value: '', label: 'Unassigned' },
              ...agents.map((a) => ({
                value: a.id,
                label: a.fullName,
                description: a.department,
              })),
            ]}
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="create-description" className="text-sm font-medium">
            Description
          </label>
          <Textarea
            id="create-description"
            placeholder="Detailed reproduction steps, error messages, and customer impact..."
            {...register('description')}
          />
          {errors.description && (
            <p className="text-xs text-destructive">{errors.description.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating...' : 'Create Ticket'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
