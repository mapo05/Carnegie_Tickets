import { createReservation, listReservationEvents } from '@/state/reservations';

export const runtime = 'nodejs';

export async function GET() {
  return Response.json({ events: listReservationEvents() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: 'error', message: 'We could not read that request. Check your details and try again.' },
      { status: 400 },
    );
  }

  const result = createReservation(body);
  return Response.json(result.body, { status: result.statusCode });
}
