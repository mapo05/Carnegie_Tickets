import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';

const jsonResponse = (body: unknown) =>
  ({ ok: true, json: async () => body }) as Response;

const mockFetchResponses = (...responses: unknown[]) => {
  const queue = [...responses];
  Object.defineProperty(global, 'fetch', {
    configurable: true,
    value: jest.fn(async () => jsonResponse(queue.shift())),
  });
};

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(global, 'fetch');
});

describe('Story 1: Prove I am a student', () => {
  it('shows the verification form and blocks event details before verification', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { name: /verify your student status/i }),
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/student id number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/student id photo/i)).toBeInTheDocument();

    expect(screen.getByText(/events are only shown to verified students/i)).toBeInTheDocument();
  });

  it('rejects a mismatched name or student ID and shows a plain-English error', async () => {
    const user = userEvent.setup();
    mockFetchResponses({
      status: 'retry',
      message: 'Name and student ID did not match the photo. Please try again.',
      attemptsRemaining: 2,
      flowId: 'flow-1',
    });
    render(<Home />);

    await user.type(screen.getByLabelText(/full name/i), 'Alice Smith');
    await user.type(screen.getByLabelText(/student id number/i), 'A1234567');
    await user.type(screen.getByLabelText(/email address/i), 'alice@test.edu');

    const fileInput = screen.getByLabelText(/student id photo/i) as HTMLInputElement;
    const file = new File(['id-photo'], 'studentid.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /verify student status/i }));

    expect(await screen.findByText(/name and student id did not match the photo/i)).toBeInTheDocument();
    expect(await screen.findByText(/please try again/i)).toBeInTheDocument();
  });

  it('accepts a valid ID scan even when the student types extra spaces or punctuation', async () => {
    const user = userEvent.setup();
    mockFetchResponses({
      status: 'email-sent',
      message: 'A confirmation link is ready in this demo.',
      flowId: 'flow-2',
      confirmationToken: 'confirmation-2',
    });
    render(<Home />);

    await user.type(screen.getByLabelText(/full name/i), 'Alice   Smith');
    await user.type(screen.getByLabelText(/student id number/i), 'A 123-4567');
    await user.type(screen.getByLabelText(/email address/i), 'alice@test.edu');

    const fileInput = screen.getByLabelText(/student id photo/i) as HTMLInputElement;
    const file = new File(['alice smith a1234567'], 'studentid.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /verify student status/i }));

    expect(await screen.findByText(/a confirmation link is ready in this demo/i)).toBeInTheDocument();
  });

  it('allows three failed attempts, then points the student to the organizers', async () => {
    const user = userEvent.setup();
    mockFetchResponses(
      {
        status: 'retry',
        message: 'Name and student ID did not match the photo. Please try again.',
        attemptsRemaining: 2,
        flowId: 'flow-1',
      },
      {
        status: 'retry',
        message: 'Name and student ID did not match the photo. Please try again.',
        attemptsRemaining: 1,
        flowId: 'flow-1',
      },
      {
        status: 'blocked',
        message: 'You have used all 3 tries. Contact the organizers for help.',
        attemptsRemaining: 0,
        flowId: 'flow-1',
      },
    );
    render(<Home />);

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const fullName = screen.getByLabelText(/full name/i);
      const studentId = screen.getByLabelText(/student id number/i);
      const email = screen.getByLabelText(/email address/i);
      await user.clear(fullName);
      await user.type(fullName, `Student ${attempt}`);
      await user.clear(studentId);
      await user.type(studentId, 'A1234567');
      await user.clear(email);
      await user.type(email, `student${attempt}@test.edu`);

      const fileInput = screen.getByLabelText(/student id photo/i) as HTMLInputElement;
      const file = new File(['id-photo'], 'studentid.png', { type: 'image/png' });
      await user.upload(fileInput, file);

      await user.click(screen.getByRole('button', { name: /verify student status/i }));
    }

    expect(await screen.findByText(/you have used all 3 tries/i)).toBeInTheDocument();
    expect(await screen.findByText(/contact the organizers/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /verify student status/i })).not.toBeInTheDocument();
  }, 15000);

  it('shows the email-sent confirmation screen when the photo matches and verifies the student after the link is clicked', async () => {
    const user = userEvent.setup();
    mockFetchResponses(
      {
        status: 'email-sent',
        message: 'A confirmation link is ready in this demo.',
        flowId: 'flow-1',
        confirmationToken: 'confirmation-1',
      },
      {
        status: 'verified',
        verifiedName: 'Jordan Lee',
      },
    );
    render(<Home />);

    await user.type(screen.getByLabelText(/full name/i), 'Jordan Lee');
    await user.type(screen.getByLabelText(/student id number/i), 'A1234567');
    await user.type(screen.getByLabelText(/email address/i), 'jordan@test.edu');

    const fileInput = screen.getByLabelText(/student id photo/i) as HTMLInputElement;
    const file = new File(['match-photo'], 'match-photo.png', { type: 'image/png' });
    await user.upload(fileInput, file);

    await user.click(screen.getByRole('button', { name: /verify student status/i }));

    expect(await screen.findByText(/a confirmation link is ready in this demo/i)).toBeInTheDocument();
    expect(screen.queryByText(/campus welcome event/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /open simulated confirmation link/i }));

    expect(await screen.findByText(/you are verified and can view events/i)).toBeInTheDocument();
    expect(await screen.findByText(/welcome, jordan lee/i)).toBeInTheDocument();
  });
});
