import { render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';
import {
  clearReservationState,
  createReservation,
  listReservationEvents,
  processSimulatedPayment,
} from '@/state/reservations';

const events = [
  {
    id: 'campus-play',
    title: 'The Importance of Being Earnest',
    date: 'November 6',
    time: '7:00 PM',
    place: 'University Theater',
    price: '$18.00',
    priceCents: 1800,
    ticketsLeft: 12,
  },
  {
    id: 'basketball',
    title: 'Carnegie vs. Westlake Basketball',
    date: 'November 14',
    time: '6:30 PM',
    place: 'Carnegie Arena',
    price: '$12.00',
    priceCents: 1200,
    ticketsLeft: 80,
  },
  {
    id: 'fall-concert',
    title: 'Fall Student Concert',
    date: 'November 21',
    time: '8:00 PM',
    place: 'Campus Green',
    price: '$25.00',
    priceCents: 2500,
    ticketsLeft: 150,
  },
];

const makeHold = () => ({
  reservationId: 'reservation-1',
  eventId: 'campus-play',
  attendeeName: 'Jamie Rivera',
  quantity: 2,
  totalCents: 3600,
  expiresAt: Date.now() + 10 * 60 * 1000,
});

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function setupFetch(options?: {
  reservations?: Array<{ body: unknown; status?: number }>;
  payments?: Array<{ body: unknown; status?: number }>;
}) {
  const reservations = [...(options?.reservations ?? [{ body: { status: 'held', ...makeHold() } }])];
  const payments = [...(options?.payments ?? [])];
  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input);
    if (path === '/api/verification') {
      if (init?.body instanceof FormData) {
        return jsonResponse({ status: 'email-sent', message: 'A confirmation link is ready in this demo.' });
      }
      return jsonResponse({ status: 'verified', verifiedName: 'Jamie Rivera', events });
    }
    if (path === '/api/reservations' && init?.method === 'POST') {
      const next = reservations.shift() ?? { body: { status: 'held', ...makeHold() } };
      return jsonResponse(next.body, next.status);
    }
    if (path === '/api/reservations' && !init?.method) {
      return jsonResponse({ events });
    }
    if (path.endsWith('/payment') && init?.method === 'POST') {
      const next = payments.shift() ?? {
        body: { status: 'paid', ticketNumbers: ['a1b2c3d4e5', 'f6a7b8c9d0'] },
      };
      return jsonResponse(next.body, next.status);
    }
    return jsonResponse({ message: 'Unexpected request.' }, 404);
  });
  Object.defineProperty(global, 'fetch', { configurable: true, value: fetchMock });
  return fetchMock;
}

async function openEvents(user: ReturnType<typeof userEvent.setup>) {
  render(<Home />);
  await user.type(screen.getByLabelText(/full name/i), 'Jamie Rivera');
  await user.type(screen.getByLabelText(/student id number/i), 'A1234567');
  await user.type(screen.getByLabelText(/email address/i), 'jamie@example.edu');
  await user.click(screen.getByRole('button', { name: /use demo id photo/i }));
  await user.click(screen.getByRole('button', { name: /verify student status/i }));
  await user.click(await screen.findByRole('button', { name: /open simulated confirmation link/i }));
}

afterEach(() => {
  jest.restoreAllMocks();
  Reflect.deleteProperty(global, 'fetch');
  jest.useRealTimers();
  clearReservationState();
});

describe('HW3 Story 7: Reserve event tickets for attendees', () => {
  it('shows college events and lets an attendee choose an event and 1–4 tickets', async () => {
    const user = userEvent.setup();
    const fetchMock = setupFetch();
    await openEvents(user);

    expect((await screen.findAllByText('The Importance of Being Earnest')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carnegie vs. Westlake Basketball').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Fall Student Concert').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.selectOptions(screen.getByLabelText(/number of tickets/i), '2');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));

    const reservationRequest = fetchMock.mock.calls.find(([path]) => path === '/api/reservations');
    expect(reservationRequest).toBeDefined();
    expect(JSON.parse(String(reservationRequest?.[1]?.body))).toMatchObject({
      eventId: 'campus-play',
      attendeeName: 'Jamie Rivera',
      quantity: 2,
    });
  });

  describe('Story 7 reservation rules', () => {
    it('rejects invalid quantities and explains when the requested number exceeds availability', () => {
      for (const quantity of [0, 5, -1, 1.5, '2']) {
        expect(createReservation({ eventId: 'campus-play', attendeeName: 'Jamie Rivera', quantity }).statusCode).toBe(400);
      }

      for (let index = 0; index < 59; index += 1) {
        expect(createReservation({
          eventId: 'campus-play',
          attendeeName: `Student ${index}`,
          quantity: 4,
        }).statusCode).toBe(201);
      }
      createReservation({ eventId: 'campus-play', attendeeName: 'Almost Full', quantity: 2 });
      const tooMany = createReservation({ eventId: 'campus-play', attendeeName: 'Last Student', quantity: 4 });

      expect(tooMany.statusCode).toBe(409);
      expect(tooMany.body).toMatchObject({
        message: 'Only 2 tickets are left. Choose 2 or fewer.',
        ticketsLeft: 2,
      });
    });

    it('prevents a second paid purchase when the name differs only by case or extra spaces', () => {
      const reservation = createReservation({
        eventId: 'campus-play',
        attendeeName: 'Jamie Rivera',
        quantity: 1,
      });
      const reservationId = String(reservation.body.reservationId);
      expect(processSimulatedPayment(reservationId, 'success').statusCode).toBe(200);

      const duplicate = createReservation({
        eventId: 'campus-play',
        attendeeName: '  JAMIE   RIVERA ',
        quantity: 1,
      });
      expect(duplicate.statusCode).toBe(409);
      expect(duplicate.body.message).toMatch(/already has a purchase/i);
    });

    it('releases a hold at 10 minutes and refuses payment after expiry', () => {
      const createdAt = 1_000;
      const reservation = createReservation({
        eventId: 'campus-play',
        attendeeName: 'Jamie Rivera',
        quantity: 2,
      }, createdAt);
      const reservationId = String(reservation.body.reservationId);

      expect(reservation.body).toMatchObject({ totalCents: 3600, expiresAt: 601_000 });
      expect(processSimulatedPayment(reservationId, 'success', 601_000)).toMatchObject({
        statusCode: 409,
        body: { status: 'expired' },
      });
      expect(listReservationEvents(601_000).find((event) => event.id === 'campus-play')?.ticketsLeft).toBe(240);
      expect(createReservation({
        eventId: 'campus-play',
        attendeeName: 'Jamie Rivera',
        quantity: 2,
      }, 601_000).statusCode).toBe(201);
    });

    it('keeps a declined payment retryable until the hold expires', () => {
      const reservation = createReservation({
        eventId: 'campus-play',
        attendeeName: 'Jamie Rivera',
        quantity: 2,
      });
      const reservationId = String(reservation.body.reservationId);

      expect(processSimulatedPayment(reservationId, 'declined').statusCode).toBe(402);
      expect(processSimulatedPayment(reservationId, 'success').statusCode).toBe(200);
    });

    it('creates one unique ticket number per ticket and does not duplicate tickets on repeated success', () => {
      const reservation = createReservation({
        eventId: 'campus-play',
        attendeeName: 'Jamie Rivera',
        quantity: 4,
      });
      const reservationId = String(reservation.body.reservationId);
      const firstPayment = processSimulatedPayment(reservationId, 'success');
      const repeatedPayment = processSimulatedPayment(reservationId, 'success');
      const ticketNumbers = firstPayment.body.ticketNumbers as string[];

      expect(ticketNumbers).toHaveLength(4);
      expect(new Set(ticketNumbers).size).toBe(4);
      expect(repeatedPayment.body.ticketNumbers).toEqual(ticketNumbers);
    });

    it('never holds more tickets than capacity when buyers request tickets concurrently', async () => {
      const attempts = Array.from({ length: 61 }, (_, index) =>
        Promise.resolve().then(() => createReservation({
          eventId: 'campus-play',
          attendeeName: `Concurrent Student ${index}`,
          quantity: 4,
        })),
      );
      const results = await Promise.all(attempts);

      expect(results.filter((result) => result.statusCode === 201)).toHaveLength(60);
      expect(results.filter((result) => result.statusCode === 409)).toHaveLength(1);
      expect(listReservationEvents().find((event) => event.id === 'campus-play')?.ticketsLeft).toBe(0);
    });
  });

  it('explains when the requested quantity is invalid or more than the tickets left', async () => {
    const user = userEvent.setup();
    setupFetch({
      reservations: [{
        body: { status: 'error', message: 'Only 2 tickets are left. Choose 2 or fewer.' },
        status: 409,
      }],
    });
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.selectOptions(screen.getByLabelText(/number of tickets/i), '4');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));

    expect(await screen.findByText(/only 2 tickets are left/i)).toBeInTheDocument();
  });

  it('uses the normalized attendee name to prevent a second purchase for the same event', async () => {
    const user = userEvent.setup();
    setupFetch({
      reservations: [{
        body: { status: 'error', message: 'This name already has a purchase for this event.' },
        status: 409,
      }],
    });
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), '  JAMIE   RIVERA  ');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));

    expect(await screen.findByText(/already has a purchase for this event/i)).toBeInTheDocument();
  });

  it('shows the 10-minute hold, total, and refund policy', async () => {
    const user = userEvent.setup();
    setupFetch();
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));

    expect(await screen.findByText(/\$36\.00/)).toBeInTheDocument();
    expect(screen.getByText(/held for 10 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be canceled or refunded/i)).toBeInTheDocument();
    expect(screen.getByText(/hold ends in/i).textContent).toMatch(/hold ends in (?:600|59[0-9]) seconds/i);
  });

  it('lets the attendee choose again after the hold expires', async () => {
    const user = userEvent.setup();
    setupFetch({
      reservations: [{
        body: {
          status: 'held',
          ...makeHold(),
          expiresAt: Date.now() + 100,
        },
      }],
    });
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));
    await user.click(await screen.findByRole('button', { name: /choose tickets again/i }));

    expect(screen.getByLabelText(/name for this reservation/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reserve tickets/i })).toBeInTheDocument();
  });

  it('allows a declined simulated payment to be retried while the hold is active', async () => {
    const user = userEvent.setup();
    const fetchMock = setupFetch({
      payments: [
        { body: { status: 'declined', message: 'Payment was not approved. You can try again.' }, status: 402 },
        { body: { status: 'paid', ticketNumbers: ['a1b2c3d4e5', 'f6a7b8c9d0'] } },
      ],
    });
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));
    await user.click(await screen.findByRole('button', { name: /simulate declined payment/i }));

    expect(await screen.findByText(/payment was not approved/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /simulate successful payment/i }));
    expect(await screen.findByText(/your confirmation email has been sent/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => String(path).endsWith('/payment'))).toHaveLength(2);
  });

  it('shows one unique ticket number per ticket and a simulated email confirmation', async () => {
    const user = userEvent.setup();
    setupFetch({
      payments: [{
        body: { status: 'paid', ticketNumbers: ['a1b2c3d4e5', 'f6a7b8c9d0'] },
      }],
    });
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.selectOptions(screen.getByLabelText(/number of tickets/i), '2');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));
    await user.click(await screen.findByRole('button', { name: /simulate successful payment/i }));

    const confirmation = await screen.findByRole('region', { name: /purchase confirmation/i });
    expect(within(confirmation).getByText('a1b2c3d4e5')).toBeInTheDocument();
    expect(within(confirmation).getByText('f6a7b8c9d0')).toBeInTheDocument();
    expect(within(confirmation).getByText(/your confirmation email has been sent/i)).toBeInTheDocument();
  });

  it('does not let concurrent buyers reserve more tickets than the event capacity', async () => {
    const user = userEvent.setup();
    const fetchMock = setupFetch({
      reservations: [
        { body: { status: 'held', ...makeHold() } },
        { body: { status: 'error', message: 'This event just sold out.' }, status: 409 },
      ],
    });
    await openEvents(user);
    await user.type(screen.getByLabelText(/name for this reservation/i), 'Jamie Rivera');
    await user.click(screen.getByRole('button', { name: /reserve tickets/i }));
    expect(await screen.findByText(/held for 10 minutes/i)).toBeInTheDocument();

    const secondBuyer = userEvent.setup();
    render(<Home />);
    await secondBuyer.type(screen.getByLabelText(/full name/i), 'Taylor Morgan');
    await secondBuyer.type(screen.getByLabelText(/student id number/i), 'B7654321');
    await secondBuyer.type(screen.getByLabelText(/email address/i), 'taylor@example.edu');
    await secondBuyer.click(screen.getByRole('button', { name: /use demo id photo/i }));
    await secondBuyer.click(screen.getByRole('button', { name: /verify student status/i }));
    await secondBuyer.click(await screen.findByRole('button', { name: /open simulated confirmation link/i }));
    await secondBuyer.type(screen.getByLabelText(/name for this reservation/i), 'Taylor Morgan');
    const reserveButtons = screen.getAllByRole('button', { name: /reserve tickets/i });
    await secondBuyer.click(reserveButtons[reserveButtons.length - 1]);

    expect(await screen.findByText(/this event just sold out/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/reservations')).toHaveLength(2);
  });
});
