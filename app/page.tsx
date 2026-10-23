'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';

type EventSummary = {
  id: string;
  title: string;
  date: string;
  time: string;
  place: string;
  price: string;
  priceCents: number;
  ticketsLeft: number;
};

type ApiReply = {
  status: 'retry' | 'blocked' | 'email-sent' | 'verified' | 'error';
  message?: string;
  flowId?: string;
  confirmationToken?: string;
  verifiedName?: string;
  events?: EventSummary[];
};

type FormState = {
  fullName: string;
  studentId: string;
  email: string;
  photo: File | null;
};

type Reservation = {
  reservationId: string;
  eventId: string;
  eventTitle: string;
  attendeeName: string;
  quantity: number;
  totalCents: number;
  expiresAt: number;
};

const emptyForm: FormState = { fullName: '', studentId: '', email: '', photo: null };
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export default function Home() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [status, setStatus] = useState<'form' | 'email-sent' | 'verified' | 'blocked'>('form');
  const [message, setMessage] = useState('Events are only shown to verified students.');
  const [flowId, setFlowId] = useState('');
  const [confirmationToken, setConfirmationToken] = useState('');
  const [verifiedName, setVerifiedName] = useState('');
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [reservationError, setReservationError] = useState('');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [ticketNumbers, setTicketNumbers] = useState<string[]>([]);
  const [holdExpired, setHoldExpired] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedEvent = events.find((event) => event.id === selectedEventId);

  useEffect(() => {
    if (!reservation || ticketNumbers.length > 0 || holdExpired) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      setCurrentTime(now);
      if (now >= reservation.expiresAt) setHoldExpired(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [reservation, ticketNumbers.length, holdExpired]);

  const handleChange = (field: keyof FormState, value: string | File | null) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || status === 'blocked') return;

    const selectedPhoto = form.photo ?? fileInputRef.current?.files?.[0] ?? null;
    if (!selectedPhoto) {
      setRequestError('Choose a student ID photo before continuing.');
      return;
    }

    setIsSubmitting(true);
    setRequestError('');
    const body = new FormData();
    body.set('action', 'verify');
    if (flowId) body.set('flowId', flowId);
    body.set('fullName', form.fullName);
    body.set('studentId', form.studentId);
    body.set('email', form.email);
    body.set('photo', selectedPhoto);

    try {
      const response = await fetch('/api/verification', { method: 'POST', body });
      const result = (await response.json()) as ApiReply;
      if (!response.ok || result.status === 'error') {
        setRequestError(result.message ?? 'We could not check those details. Please try again.');
        return;
      }

      if (result.flowId) setFlowId(result.flowId);
      if (result.message) setMessage(result.message);
      if (result.status === 'blocked') setStatus('blocked');
      if (result.status === 'email-sent') {
        setConfirmationToken(result.confirmationToken ?? '');
        setStatus('email-sent');
      }
    } catch {
      setRequestError('We could not check your details right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openConfirmation = async () => {
    setIsSubmitting(true);
    setRequestError('');
    try {
      const response = await fetch('/api/verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', flowId, confirmationToken }),
      });
      const result = (await response.json()) as ApiReply;
      if (!response.ok || result.status !== 'verified') {
        setRequestError(result.message ?? 'That confirmation link has expired. Start again to request a new one.');
        return;
      }

      setVerifiedName(result.verifiedName ?? form.fullName.trim());
      setEvents(result.events ?? []);
      setSelectedEventId(result.events?.[0]?.id ?? '');
      setStatus('verified');
    } catch {
      setRequestError('We could not open the confirmation link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReserve = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !selectedEvent) return;

    setIsSubmitting(true);
    setReservationError('');
    setPaymentMessage('');
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent.id, attendeeName, quantity }),
      });
      const result = await response.json() as {
        status: string;
        message?: string;
        reservationId?: string;
        eventId?: string;
        eventTitle?: string;
        attendeeName?: string;
        quantity?: number;
        totalCents?: number;
        expiresAt?: number;
      };
      if (!response.ok || result.status !== 'held' || !result.reservationId || !result.expiresAt) {
        setReservationError(result.message ?? 'We could not hold those tickets. Please check your choices and try again.');
        if (response.status === 409 && result.message?.includes('sold out')) {
          setEvents((current) => current.map((item) =>
            item.id === selectedEvent.id ? { ...item, ticketsLeft: 0 } : item,
          ));
        }
        return;
      }

      setReservation({
        reservationId: result.reservationId,
        eventId: result.eventId ?? selectedEvent.id,
        eventTitle: result.eventTitle ?? selectedEvent.title,
        attendeeName: result.attendeeName ?? attendeeName.trim(),
        quantity: result.quantity ?? quantity,
        totalCents: result.totalCents ?? selectedEvent.priceCents * quantity,
        expiresAt: result.expiresAt,
      });
      setHoldExpired(result.expiresAt <= Date.now());
      setCurrentTime(Date.now());
    } catch {
      setReservationError('We could not hold those tickets right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayment = async (outcome: 'success' | 'declined') => {
    if (!reservation || isSubmitting || holdExpired) return;

    setIsSubmitting(true);
    setPaymentMessage('');
    try {
      const response = await fetch('/api/reservations/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId: reservation.reservationId, outcome }),
      });
      const result = await response.json() as {
        status: string;
        message?: string;
        ticketNumbers?: string[];
      };
      if (result.status === 'paid' && response.ok && result.ticketNumbers) {
        setTicketNumbers(result.ticketNumbers);
      } else if (result.status === 'expired') {
        setHoldExpired(true);
        setPaymentMessage(result.message ?? 'Your ticket hold has ended. Choose tickets again.');
      } else {
        setPaymentMessage(result.message ?? 'Payment was not approved. You can try again before your ticket hold ends.');
      }
    } catch {
      setPaymentMessage('We could not complete the simulated payment. Please try again before your ticket hold ends.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChooseTicketsAgain = async () => {
    setIsSubmitting(true);
    setPaymentMessage('');
    try {
      const response = await fetch('/api/reservations');
      const result = await response.json() as { events?: EventSummary[]; message?: string };
      if (!response.ok || !result.events) {
        setPaymentMessage(result.message ?? 'We could not refresh event availability. Please try again.');
        return;
      }
      setEvents(result.events);
      setReservation(null);
      setHoldExpired(false);
    } catch {
      setPaymentMessage('We could not refresh event availability. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const useDemoPhoto = () => {
    const pngBytes = Uint8Array.from(
      atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWOoCJj2HwAFAAJeoZPDtAAAABR0RVh0Q29tbWVudFwwbWF0Y2gtcGhvdG/LyzHDAAAAAElFTkSuQmCC'),
      (character) => character.charCodeAt(0),
    ).buffer;
    handleChange('photo', new File([pngBytes], 'match-photo.png', { type: 'image/png' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="#top" aria-label="Carnegie Tickets home">
          <span className="wordmark-seal" aria-hidden="true">C</span>
          <span>Carnegie <strong>Tickets</strong></span>
        </a>
        <p className="masthead-label">Student access <span>Preview</span></p>
      </header>

      <div className="page-rule" />

      {status !== 'verified' && (
      <section className="verification-layout" id="top">
        <div className="intro-panel">
          <p className="section-index"><span>01</span> Student verification</p>
          <h1>Verify your<br />student status<span className="title-period">.</span></h1>
          <p className="intro-copy">A quick identity check keeps event details for verified students only.</p>
          <div className="privacy-note">
            <span className="privacy-mark" aria-hidden="true">+</span>
            <p>Your ID photo is checked for this preview and is not saved.</p>
          </div>
          <div className="help-block">
            <span>Need help?</span>
            <a href="mailto:tickets@example.edu">tickets@example.edu</a>
          </div>
        </div>

        <section className="form-panel" aria-labelledby="form-title">
          <div className="form-heading">
            <div>
              <p className="eyebrow">Student access</p>
              <h2 id="form-title">Your details</h2>
            </div>
            <span className="step-count">STEP 1 <i /> 2</span>
          </div>

          <div className={`notice ${status === 'email-sent' ? 'notice-success' : status === 'blocked' || requestError ? 'notice-error' : 'notice-info'}`} role="status" aria-live="polite">
            <span className="notice-dot" aria-hidden="true" />
            <p>{requestError || message}</p>
          </div>

          {status === 'email-sent' && (
            <div className="confirmation-panel">
              <p className="confirmation-kicker">Photo check complete</p>
              <p>In a live service, a link would be emailed to <strong>{form.email}</strong>. For this preview, open the simulated link below.</p>
              <button type="button" className="primary-button" onClick={openConfirmation} disabled={isSubmitting}>
                {isSubmitting ? 'Opening link...' : 'Open simulated confirmation link'}
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          )}

          {status === 'blocked' && (
            <div className="blocked-panel">
              <p>For help, email <a href="mailto:tickets@example.edu">tickets@example.edu</a>.</p>
            </div>
          )}

          {status === 'form' && (
            <form onSubmit={handleSubmit} className="verification-form">
              <label htmlFor="fullName">Full name</label>
              <input id="fullName" name="fullName" type="text" autoComplete="name" maxLength={120} required value={form.fullName} onChange={(event) => handleChange('fullName', event.target.value)} />

              <label htmlFor="studentId">Student ID number</label>
              <input id="studentId" name="studentId" type="text" autoComplete="off" maxLength={40} required value={form.studentId} onChange={(event) => handleChange('studentId', event.target.value)} />

              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" autoComplete="email" maxLength={254} required value={form.email} onChange={(event) => handleChange('email', event.target.value)} />

              <div className="photo-label-row">
                <label htmlFor="photo">Student ID photo</label>
                <span>PNG or JPG</span>
              </div>
              <input ref={fileInputRef} id="photo" name="photo" type="file" accept="image/png,image/jpeg" required={!form.photo} onChange={(event) => handleChange('photo', event.target.files?.[0] ?? null)} />
              {form.photo && <p className="selected-file">Selected: {form.photo.name}</p>}
              <button type="button" className="demo-photo-button" onClick={useDemoPhoto}>Use demo ID photo</button>
              <p className="preview-disclosure">Preview check only: the demo photo stands in for a real ID scan. This site does not read real ID images or send email.</p>

              <button type="submit" className="primary-button" disabled={isSubmitting}>
                {isSubmitting ? 'Checking details...' : 'Verify student status'}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}
        </section>
      </section>
      )}

      {status === 'verified' && (
        <section className="verified-panel" aria-labelledby="verified-title">
          <div className="verified-heading">
            <p className="eyebrow">Verification complete</p>
            <h2 id="verified-title">Welcome, {verifiedName}</h2>
            <p>You are verified and can view events. Choose an event and the number of tickets you want.</p>
          </div>
          <div className="event-list">
            {events.map((event) => (
              <article key={event.id} className="event-item">
                <div>
                  <p className="event-date">{event.date} <span>{event.time}</span></p>
                  <h3>{event.title}</h3>
                  <p className="event-place">{event.place}</p>
                </div>
                <div className="event-meta"><strong>{event.price}</strong><span>{event.ticketsLeft} tickets left</span></div>
              </article>
            ))}
          </div>
          {!reservation && ticketNumbers.length === 0 && (
            <form className="reservation-form" onSubmit={handleReserve}>
              <h3>Reserve event tickets</h3>
              <p>Choose an event and ticket quantity. You will not choose specific seats.</p>
              <label htmlFor="reservation-event">Choose an event</label>
              <select
                id="reservation-event"
                value={selectedEventId}
                onChange={(event) => setSelectedEventId(event.target.value)}
                required
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id} disabled={event.ticketsLeft === 0}>
                    {event.title}{event.ticketsLeft === 0 ? ' — Sold out' : ''}
                  </option>
                ))}
              </select>
              <label htmlFor="reservation-name">Name for this reservation</label>
              <input
                id="reservation-name"
                type="text"
                maxLength={120}
                autoComplete="name"
                value={attendeeName}
                onChange={(event) => setAttendeeName(event.target.value)}
                required
              />
              <label htmlFor="reservation-quantity">Number of tickets</label>
              <select
                id="reservation-quantity"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>{count}</option>
                ))}
              </select>
              {reservationError && <p className="reservation-message error-message" role="alert">{reservationError}</p>}
              <button type="submit" className="primary-button" disabled={isSubmitting || !selectedEvent || selectedEvent.ticketsLeft === 0}>
                {isSubmitting ? 'Holding tickets...' : 'Reserve tickets'}
                <span aria-hidden="true">→</span>
              </button>
            </form>
          )}

          {reservation && ticketNumbers.length === 0 && (
            <section className="checkout-panel" aria-labelledby="checkout-title">
              <h3 id="checkout-title">Complete your reservation</h3>
              <p>{reservation.quantity} ticket{reservation.quantity === 1 ? '' : 's'} for {reservation.eventTitle}</p>
              <p className="checkout-total">Total: {currency.format(reservation.totalCents / 100)}</p>
              <p>Your tickets are held for 10 minutes.</p>
              <p>Ticket purchases cannot be canceled or refunded.</p>
              {holdExpired ? (
                <>
                  <p className="reservation-message error-message" role="status">Your ticket hold has ended. Choose tickets again.</p>
                  {paymentMessage && <p className="reservation-message error-message" role="alert">{paymentMessage}</p>}
                  <button type="button" className="primary-button" onClick={handleChooseTicketsAgain} disabled={isSubmitting}>
                    Choose tickets again
                    <span aria-hidden="true">→</span>
                  </button>
                </>
              ) : (
                <>
                  <p>Hold ends in {Math.max(0, Math.ceil((reservation.expiresAt - currentTime) / 1000))} seconds.</p>
                  {paymentMessage && <p className="reservation-message error-message" role="alert">{paymentMessage}</p>}
                  <div className="payment-actions">
                    <button type="button" className="primary-button" disabled={isSubmitting} onClick={() => handlePayment('success')}>
                      {isSubmitting ? 'Processing...' : 'Simulate successful payment'}
                    </button>
                    <button type="button" className="secondary-button" disabled={isSubmitting} onClick={() => handlePayment('declined')}>
                      Simulate declined payment
                    </button>
                  </div>
                  <p className="preview-disclosure">Demo only: no real payment is taken.</p>
                </>
              )}
            </section>
          )}

          {ticketNumbers.length > 0 && reservation && (
            <section className="checkout-panel" aria-label="Purchase confirmation">
              <h3>Reservation complete</h3>
              <p>Your simulated payment was successful for {reservation.eventTitle}.</p>
              <p>Total paid: {currency.format(reservation.totalCents / 100)}</p>
              <h4>Your ticket numbers</h4>
              <ul className="ticket-number-list">
                {ticketNumbers.map((ticketNumber) => <li key={ticketNumber}>{ticketNumber}</li>)}
              </ul>
              <p>Your confirmation email has been sent. This is a demo; no email was sent.</p>
            </section>
          )}
        </section>
      )}

      <footer className="page-footer">
        <span>Carnegie Tickets <i>·</i> Student access</span>
        <a href="mailto:tickets@example.edu">Contact organizers</a>
      </footer>
    </main>
  );
}
