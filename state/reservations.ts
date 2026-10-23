import { randomBytes, randomUUID } from 'node:crypto';

const holdDuration = 10 * 60 * 1000;

type EventRecord = {
  id: string;
  title: string;
  date: string;
  time: string;
  place: string;
  priceCents: number;
  capacity: number;
};

type Reservation = {
  id: string;
  eventId: string;
  attendeeName: string;
  normalizedName: string;
  quantity: number;
  totalCents: number;
  createdAt: number;
  expiresAt: number;
  status: 'held' | 'expired' | 'paid';
  ticketNumbers?: string[];
};

type ReservationState = {
  reservations: Map<string, Reservation>;
};

type ServiceResult = {
  statusCode: number;
  body: Record<string, unknown>;
};

declare global {
  var carnegieReservationState: ReservationState | undefined;
}

const eventRecords: EventRecord[] = [
  {
    id: 'campus-play',
    title: 'The Importance of Being Earnest',
    date: 'November 6, 2026',
    time: '7:00 PM',
    place: 'University Theater',
    priceCents: 1800,
    capacity: 240,
  },
  {
    id: 'basketball',
    title: 'Carnegie vs. Westlake Basketball',
    date: 'November 14, 2026',
    time: '6:30 PM',
    place: 'Carnegie Arena',
    priceCents: 1200,
    capacity: 1200,
  },
  {
    id: 'fall-concert',
    title: 'Fall Student Concert',
    date: 'November 21, 2026',
    time: '8:00 PM',
    place: 'Campus Green',
    priceCents: 2500,
    capacity: 600,
  },
];

const state = globalThis.carnegieReservationState ?? { reservations: new Map<string, Reservation>() };
globalThis.carnegieReservationState = state;

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function expireReservations(now: number) {
  for (const reservation of state.reservations.values()) {
    if (reservation.status === 'held' && reservation.expiresAt <= now) {
      reservation.status = 'expired';
    }
  }
}

function eventAvailability(event: EventRecord) {
  let reserved = 0;
  for (const reservation of state.reservations.values()) {
    if (reservation.eventId === event.id && reservation.status === 'held') {
      reserved += reservation.quantity;
    } else if (reservation.eventId === event.id && reservation.status === 'paid') {
      reserved += reservation.quantity;
    }
  }
  return Math.max(0, event.capacity - reserved);
}

export function listReservationEvents(now = Date.now()) {
  expireReservations(now);
  return eventRecords.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.date,
    time: event.time,
    place: event.place,
    price: formatPrice(event.priceCents),
    priceCents: event.priceCents,
    ticketsLeft: eventAvailability(event),
  }));
}

function formatPrice(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function createReservation(input: unknown, now = Date.now()): ServiceResult {
  expireReservations(now);
  if (!input || typeof input !== 'object') {
    return { statusCode: 400, body: { status: 'error', message: 'Enter your name and ticket quantity.' } };
  }

  const body = input as Record<string, unknown>;
  const eventId = typeof body.eventId === 'string' ? body.eventId : '';
  const attendeeName = typeof body.attendeeName === 'string' ? body.attendeeName.trim() : '';
  const quantity = body.quantity;
  const event = eventRecords.find((item) => item.id === eventId);
  if (!event || attendeeName.length < 2 || attendeeName.length > 120 ||
      typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > 4) {
    return {
      statusCode: 400,
      body: { status: 'error', message: 'Enter a name and choose 1 to 4 whole tickets.' },
    };
  }

  const normalizedName = normalizeName(attendeeName);
  const previousPurchase = Array.from(state.reservations.values()).find((reservation) =>
    reservation.eventId === event.id &&
    reservation.normalizedName === normalizedName &&
    (reservation.status === 'paid' || reservation.status === 'held'),
  );
  if (previousPurchase) {
    return {
      statusCode: 409,
      body: { status: 'error', message: 'This name already has a purchase or an active hold for this event.' },
    };
  }

  const ticketsLeft = eventAvailability(event);
  if (quantity > ticketsLeft) {
    const message = ticketsLeft === 0
      ? 'This event just sold out.'
      : `Only ${ticketsLeft} tickets are left. Choose ${ticketsLeft} or fewer.`;
    return { statusCode: 409, body: { status: 'error', message, ticketsLeft } };
  }

  const reservation: Reservation = {
    id: randomUUID(),
    eventId: event.id,
    attendeeName,
    normalizedName,
    quantity,
    totalCents: event.priceCents * quantity,
    createdAt: now,
    expiresAt: now + holdDuration,
    status: 'held',
  };
  state.reservations.set(reservation.id, reservation);

  return {
    statusCode: 201,
    body: {
      status: 'held',
      reservationId: reservation.id,
      eventId: reservation.eventId,
      eventTitle: event.title,
      attendeeName: reservation.attendeeName,
      quantity: reservation.quantity,
      totalCents: reservation.totalCents,
      expiresAt: reservation.expiresAt,
    },
  };
}

function createTicketNumbers(eventId: string, quantity: number) {
  const existing = new Set(
    Array.from(state.reservations.values())
      .filter((reservation) => reservation.eventId === eventId)
      .flatMap((reservation) => reservation.ticketNumbers ?? []),
  );
  const ticketNumbers: string[] = [];
  while (ticketNumbers.length < quantity) {
    const ticketNumber = randomBytes(5).toString('hex');
    if (!existing.has(ticketNumber)) {
      existing.add(ticketNumber);
      ticketNumbers.push(ticketNumber);
    }
  }
  return ticketNumbers;
}

export function processSimulatedPayment(
  reservationId: unknown,
  outcome: unknown,
  now = Date.now(),
): ServiceResult {
  expireReservations(now);
  if (typeof reservationId !== 'string' || !['success', 'declined'].includes(String(outcome))) {
    return { statusCode: 400, body: { status: 'error', message: 'Choose a valid simulated payment result.' } };
  }

  const reservation = state.reservations.get(reservationId);
  if (!reservation) {
    return { statusCode: 404, body: { status: 'error', message: 'This ticket hold could not be found.' } };
  }
  if (reservation.status === 'expired') {
    return { statusCode: 409, body: { status: 'expired', message: 'Your ticket hold has ended. Choose tickets again.' } };
  }
  if (reservation.status === 'paid') {
    return {
      statusCode: 200,
      body: { status: 'paid', ticketNumbers: reservation.ticketNumbers, totalCents: reservation.totalCents },
    };
  }
  if (outcome === 'declined') {
    return {
      statusCode: 402,
      body: { status: 'declined', message: 'Payment was not approved. You can try again before your ticket hold ends.' },
    };
  }

  reservation.status = 'paid';
  reservation.ticketNumbers = createTicketNumbers(reservation.eventId, reservation.quantity);
  return {
    statusCode: 200,
    body: {
      status: 'paid',
      ticketNumbers: reservation.ticketNumbers,
      totalCents: reservation.totalCents,
    },
  };
}

export function clearReservationState() {
  state.reservations.clear();
}
