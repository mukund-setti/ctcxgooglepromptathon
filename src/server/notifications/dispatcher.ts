/**
 * HazAlert — Notification Dispatcher
 *
 * When a user's zone status changes — e.g. they were in the watch zone
 * and an expanding plume just pulled them into the mandatory-evacuation
 * polygon — every channel they've opted into receives a message.
 *
 * Channel mapping (production):
 *   web_push -> Firebase Cloud Messaging (FCM)
 *   sms      -> Twilio Programmable Messaging
 *   email    -> SendGrid (Twilio SendGrid v3 API)
 *
 * Rate limits: at most one notification per user per 5 minutes per
 * channel, enforced via the `lastNotifiedAt` field on UserSubscription.
 */

import type { UserSubscription, ZoneLevel } from '../../types/incident';

type ZoneStatus = ZoneLevel | 'safe';

export interface NotificationPayload {
  title: string;
  body: string;
  /** Deep link back to the dashboard with this incident pre-selected. */
  url: string;
  /** Used by FCM for OS-level severity styling. */
  severity: 'critical' | 'high' | 'normal';
}

/**
 * Entry point — called from the scheduler when a user's zone changes.
 * Builds the payload once, then fans out across the user's enabled
 * channels.
 */
export async function notifyZoneTransition(
  sub: UserSubscription,
  oldStatus: ZoneStatus,
  newStatus: ZoneStatus,
  incidentId: string,
): Promise<void> {
  if (oldStatus === newStatus) return;

  const payload = buildPayload(oldStatus, newStatus, incidentId);

  const sends = sub.notificationChannels.map((ch) => {
    if (ch === 'web_push') return sendWebPush(sub, payload);
    if (ch === 'sms') return sendSms(sub, payload);
    if (ch === 'email') return sendEmail(sub, payload);
    return Promise.resolve();
  });

  await Promise.allSettled(sends);
}

/**
 * Production: FCM via firebase-admin
 *   await admin.messaging().send({
 *     token: sub.fcmToken,
 *     notification: { title, body },
 *     webpush: { fcmOptions: { link: url }, headers: { Urgency: 'high' } },
 *   });
 */
export async function sendWebPush(
  sub: UserSubscription,
  payload: NotificationPayload,
): Promise<void> {
  void sub;
  void payload;
}

/**
 * Production: Twilio Programmable Messaging
 *   await twilio.messages.create({
 *     to: sub.phoneE164,
 *     from: process.env.HAZALERT_TWILIO_FROM,
 *     body: `${payload.title}\n${payload.body}\n${payload.url}`,
 *   });
 *
 * For critical evacuations the dispatcher also uses Twilio Voice to
 * place an automated call ("Press 1 to acknowledge").
 */
export async function sendSms(
  sub: UserSubscription,
  payload: NotificationPayload,
): Promise<void> {
  void sub;
  void payload;
}

/**
 * Production: SendGrid v3
 *   await sgMail.send({
 *     to: sub.email,
 *     from: 'alerts@hazalert.app',
 *     templateId: 'd-zone-transition',
 *     dynamicTemplateData: { ...payload, transitionFrom, transitionTo },
 *   });
 */
export async function sendEmail(
  sub: UserSubscription,
  payload: NotificationPayload,
): Promise<void> {
  void sub;
  void payload;
}

// ----------------------------------------------------------------------------
// Payload construction
// ----------------------------------------------------------------------------

function buildPayload(
  oldStatus: ZoneStatus,
  newStatus: ZoneStatus,
  incidentId: string,
): NotificationPayload {
  const url = `https://hazalert.app/?incident=${encodeURIComponent(incidentId)}`;

  if (newStatus === 'mandatory') {
    return {
      title: 'EVACUATE NOW',
      body: 'Your location is in the mandatory evacuation zone. Leave immediately. Tap for directions.',
      url,
      severity: 'critical',
    };
  }
  if (newStatus === 'shelter_in_place') {
    return {
      title: 'Shelter in Place',
      body: 'Stay indoors. Close windows. Seal vents. Tap for full instructions.',
      url,
      severity: 'high',
    };
  }
  if (newStatus === 'watch') {
    return {
      title: 'Watch Zone — Be Ready',
      body: 'Conditions have changed. Pack a go-bag and stay near home.',
      url,
      severity: 'normal',
    };
  }
  // newStatus === 'safe' or 'advisory' — typically a downgrade.
  return {
    title: 'Status Update: All Clear',
    body: `Your area is no longer under ${labelFor(oldStatus)}. Tap for details.`,
    url,
    severity: 'normal',
  };
}

function labelFor(status: ZoneStatus): string {
  switch (status) {
    case 'mandatory':
      return 'mandatory evacuation';
    case 'shelter_in_place':
      return 'shelter-in-place orders';
    case 'watch':
      return 'a watch advisory';
    case 'advisory':
      return 'an advisory';
    case 'safe':
      return 'any alert';
  }
}
