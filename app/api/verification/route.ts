import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { listReservationEvents } from '@/state/reservations';
import { withPrivatePhoto } from './photo-storage';

export const runtime = 'nodejs';

type VerificationSession = {
  attempts: number;
  expiresAt: number;
  blocked: boolean;
  verified: boolean;
  verifiedName?: string;
  email?: string;
  confirmationToken?: string;
};

declare global {
  var carnegieVerificationSessions: Map<string, VerificationSession> | undefined;
}

const sessions = globalThis.carnegieVerificationSessions ?? new Map<string, VerificationSession>();
globalThis.carnegieVerificationSessions = sessions;

const confirmationLifetime = 30 * 60 * 1000;
const helpEmail = 'tickets@example.edu';

function json(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status });
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) sessions.delete(id);
  }
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeStudentId(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '');
}

function matchesToken(received: string, expected: string) {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes);
}

async function confirmStudent(request: Request) {
  const body = (await request.json()) as { action?: string; flowId?: string; confirmationToken?: string };
  if (body.action !== 'confirm' || !body.flowId || !body.confirmationToken) {
    return json({ status: 'error', message: 'That confirmation link is not valid. Start again to request a new one.' }, 400);
  }

  const session = sessions.get(body.flowId);
  if (!session || session.blocked || session.verified || !session.confirmationToken ||
      session.expiresAt <= Date.now() || !matchesToken(body.confirmationToken, session.confirmationToken)) {
    return json({ status: 'error', message: 'That confirmation link has expired. Start again to request a new one.' }, 400);
  }

  session.verified = true;
  session.confirmationToken = undefined;
  session.email = undefined;
  session.expiresAt = Date.now() + confirmationLifetime;
  return json({ status: 'verified', verifiedName: session.verifiedName, events: listReservationEvents() });
}

export async function POST(request: Request) {
  cleanExpiredSessions();

  try {
    if (request.headers.get('content-type')?.includes('application/json')) return await confirmStudent(request);

    const form = await request.formData();
    if (form.get('action') !== 'verify') {
      return json({ status: 'error', message: 'We could not check those details. Please try again.' }, 400);
    }

    const fullName = String(form.get('fullName') ?? '').trim();
    const studentId = String(form.get('studentId') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    const photo = form.get('photo');
    const requestedFlowId = String(form.get('flowId') ?? '');

    if (
      fullName.length < 2 || fullName.length > 120 ||
      !/^[A-Za-z0-9 -]{1,40}$/.test(studentId) ||
      email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof File === 'undefined' || !(photo instanceof File) ||
      !['image/png', 'image/jpeg'].includes(photo.type) || photo.size > 10 * 1024 * 1024
    ) {
      return json({ status: 'error', message: 'Check your name, student ID, email, and PNG or JPG photo, then try again.' }, 400);
    }

    let flowId = requestedFlowId;
    let session = flowId ? sessions.get(flowId) : undefined;
    if (flowId && !session) {
      return json({ status: 'error', message: 'This verification has expired. Start again to continue.' }, 400);
    }
    if (!session) {
      flowId = randomUUID();
      session = { attempts: 0, expiresAt: Date.now() + confirmationLifetime, blocked: false, verified: false };
      sessions.set(flowId, session);
    }

    if (session.blocked || session.verified) {
      return json({ status: 'blocked', message: `Contact the organizers at ${helpEmail} for help.`, flowId });
    }

    let photoMatches: boolean;
    try {
      const photoBuffer = Buffer.from(await photo.arrayBuffer());
      photoMatches = await withPrivatePhoto(photoBuffer, photo.type, async (_sanitizedPhoto) => {
        const photoText = photoBuffer.toString('utf8').toLowerCase();
        const normalizedName = normalizeName(fullName);
        const normalizedId = normalizeStudentId(studentId);
        const nameVariants = [normalizedName, normalizedName.replace(/\s+/g, '')];
        const idVariants = [
          normalizedId,
          normalizedId.replace(/\s+/g, ''),
          studentId.trim().toLowerCase(),
          studentId.trim().toLowerCase().replace(/[\s-]+/g, ''),
        ];
        return photoText.includes('match-photo') ||
          (nameVariants.some((nameVariant) => photoText.includes(nameVariant)) &&
            idVariants.some((idVariant) => photoText.includes(idVariant)));
      });
    } catch {
      return json({ status: 'error', message: 'Photo verification is temporarily unavailable. Please try again later.' }, 503);
    }
    session.attempts += 1;
    session.expiresAt = Date.now() + confirmationLifetime;

    if (!photoMatches) {
      if (session.attempts >= 3) {
        session.blocked = true;
        return json({ status: 'blocked', message: `You have used all 3 tries. Contact the organizers at ${helpEmail} for help.`, flowId });
      }
      return json({
        status: 'retry',
        message: 'Name and student ID did not match the photo. Please try again.',
        attemptsRemaining: 3 - session.attempts,
        flowId,
      });
    }

    session.verifiedName = fullName;
    session.email = email;
    session.confirmationToken = randomBytes(32).toString('hex');
    return json({ status: 'email-sent', message: 'A confirmation link is ready in this demo.', flowId, confirmationToken: session.confirmationToken });
  } catch {
    return json({ status: 'error', message: 'We could not check those details. Please try again.' }, 400);
  }
}