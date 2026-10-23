import { processSimulatedPayment } from '@/state/reservations';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { status: 'error', message: 'We could not read that payment choice. Please try again.' },
      { status: 400 },
    );
  }

  if (!body || typeof body !== 'object') {
    return Response.json(
      { status: 'error', message: 'Choose a valid simulated payment result.' },
      { status: 400 },
    );
  }

  const result = processSimulatedPayment(
    (body as Record<string, unknown>).reservationId,
    (body as Record<string, unknown>).outcome,
  );
  return Response.json(result.body, { status: result.statusCode });
}
