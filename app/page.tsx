'use client';

import { FormEvent, useRef, useState } from 'react';

type EventSummary = {
  id: string;
  title: string;
  date: string;
  time: string;
  place: string;
  price: string;
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

const emptyForm: FormState = { fullName: '', studentId: '', email: '', photo: null };

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setStatus('verified');
    } catch {
      setRequestError('We could not open the confirmation link. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const useDemoPhoto = () => {
    handleChange('photo', new File(['match-photo'], 'match-photo.png', { type: 'image/png' }));
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
            <p>You are verified and can view events.</p>
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
        </section>
      )}

      <footer className="page-footer">
        <span>Carnegie Tickets <i>·</i> Student access</span>
        <a href="mailto:tickets@example.edu">Contact organizers</a>
      </footer>
    </main>
  );
}
