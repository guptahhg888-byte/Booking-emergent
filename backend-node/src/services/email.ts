/**
 * Email confirmation + Google Calendar Meet link generation service.
 * Sends booking confirmation to user & consultant after successful payment.
 */
import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  GOOGLE_CALENDAR_EMAIL,
  SMTP_EMAIL,
  SMTP_PASSWORD,
  CONSULTANT_EMAIL,
  CC_EMAILS,
} from '../core/config';

// ─── Google OAuth2 client for Calendar ────────────────────────────────────────

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oauth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// ─── Create Google Meet event ─────────────────────────────────────────────────

interface MeetEventParams {
  userEmail: string;
  appointmentDate: string; // YYYY-MM-DD
  appointmentTime: string; // HH:MM or HH:MM AM/PM
  durationMinutes?: number;
}

function parseTimeToISO(date: string, time: string): Date {
  // Handle "HH:MM AM/PM" format
  let hours: number;
  let minutes: number;

  const ampmMatch = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    hours = parseInt(ampmMatch[1], 10);
    minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
  } else {
    // HH:MM 24-hour format
    const parts = time.split(':');
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
  }

  const dt = new Date(`${date}T00:00:00+05:30`);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
}

export async function createGoogleMeetEvent(params: MeetEventParams): Promise<string | null> {
  const { userEmail, appointmentDate, appointmentTime, durationMinutes = 30 } = params;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    console.warn('[Meet] Google OAuth credentials not configured, skipping Meet link generation');
    return null;
  }

  try {
    const startTime = parseTimeToISO(appointmentDate, appointmentTime);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

    const event = await calendar.events.insert({
      calendarId: GOOGLE_CALENDAR_EMAIL || 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: '1v1 with madhumati ma\'am',
        description: 'Consultation session booked via MediConsult platform.',
        start: {
          dateTime: startTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: 'Asia/Kolkata',
        },
        attendees: [
          { email: userEmail },
          { email: CONSULTANT_EMAIL },
          ...CC_EMAILS.map((email) => ({ email })),
        ],
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 30 },
            { method: 'popup', minutes: 10 },
          ],
        },
      },
    });

    const meetLink = event.data.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === 'video'
    )?.uri;

    console.info(`[Meet] Created event: ${event.data.htmlLink}, Meet: ${meetLink}`);
    return meetLink ?? null;
  } catch (error: any) {
    console.error('[Meet] Failed to create Google Meet event:', error.message);
    return null;
  }
}

// ─── Email transporter (Gmail SMTP with App Password) ────────────────────────

function createTransporter(): nodemailer.Transporter | null {
  if (!SMTP_EMAIL || !SMTP_PASSWORD) {
    console.warn('[Email] SMTP credentials not configured');
    return null;
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: SMTP_EMAIL,
      pass: SMTP_PASSWORD,
    },
  });
}

// ─── Send booking confirmation email ─────────────────────────────────────────

interface BookingEmailParams {
  userEmail: string;
  userName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes?: number;
  consultationFee: number;
  meetLink: string | null;
  transactionId: string;
}

export async function sendBookingConfirmationEmail(params: BookingEmailParams): Promise<boolean> {
  const {
    userEmail,
    userName,
    doctorName,
    appointmentDate,
    appointmentTime,
    durationMinutes,
    consultationFee,
    meetLink,
    transactionId,
  } = params;

  const transporter = createTransporter();
  if (!transporter) {
    console.warn('[Email] Transporter not available, skipping email');
    return false;
  }

  const meetSection = meetLink
    ? `<tr>
        <td style="padding: 8px 16px; font-weight: bold; color: #333;">Google Meet Link</td>
        <td style="padding: 8px 16px;"><a href="${meetLink}" style="color: #1a73e8; text-decoration: none; font-weight: bold;">${meetLink}</a></td>
      </tr>`
    : '';

  const htmlContent = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #f9fafb; padding: 24px; border-radius: 12px;">
    <div style="background: #1a73e8; color: white; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 22px;">Booking Confirmed ✓</h1>
      <p style="margin: 8px 0 0; opacity: 0.9;">Your consultation session has been scheduled</p>
    </div>
    
    <div style="background: white; padding: 24px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
      <p style="color: #333; font-size: 16px;">Hi <strong>${userName}</strong>,</p>
      <p style="color: #555; line-height: 1.6;">Your payment has been received and your consultation session is now confirmed. Here are the details:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; background: #f8f9fa; border-radius: 8px; overflow: hidden;">
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Session Title</td>
          <td style="padding: 8px 16px; color: #555;">1v1 with madhumati ma'am</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Consultant</td>
          <td style="padding: 8px 16px; color: #555;">${doctorName}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Date</td>
          <td style="padding: 8px 16px; color: #555;">${appointmentDate}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Time</td>
          <td style="padding: 8px 16px; color: #555;">${appointmentTime}</td>
        </tr>
        ${durationMinutes ? `<tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Duration</td>
          <td style="padding: 8px 16px; color: #555;">${durationMinutes} minutes</td>
        </tr>` : ''}
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Amount Paid</td>
          <td style="padding: 8px 16px; color: #555;">₹${consultationFee}</td>
        </tr>
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 8px 16px; font-weight: bold; color: #333;">Transaction ID</td>
          <td style="padding: 8px 16px; color: #555; font-family: monospace; font-size: 13px;">${transactionId}</td>
        </tr>
        ${meetSection}
      </table>

      ${meetLink ? `
      <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 16px; border-radius: 4px; margin: 16px 0;">
        <p style="margin: 0; color: #2e7d32; font-weight: bold;">Join your session via Google Meet:</p>
        <a href="${meetLink}" style="color: #1a73e8; font-size: 15px; word-break: break-all;">${meetLink}</a>
      </div>` : ''}

      <p style="color: #555; line-height: 1.6; margin-top: 20px;">Please join the meeting at the scheduled time. A calendar invite has also been sent to your email.</p>
      
      <hr style="border: none; border-top: 1px solid #e9ecef; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px; text-align: center;">This is an automated email from MediConsult. Please do not reply directly.</p>
    </div>
  </div>`;

  try {
    await transporter.sendMail({
      from: `"MediConsult Bookings" <${SMTP_EMAIL}>`,
      to: [userEmail, CONSULTANT_EMAIL],
      cc: CC_EMAILS,
      subject: `Booking Confirmed - 1v1 with madhumati ma'am | ${appointmentDate} at ${appointmentTime}`,
      html: htmlContent,
    });
    console.info(`[Email] Confirmation sent to ${userEmail} and ${CONSULTANT_EMAIL}`);
    return true;
  } catch (error: any) {
    console.error('[Email] Failed to send confirmation:', error.message);
    return false;
  }
}

// ─── Combined: create meet + send email ──────────────────────────────────────

export interface PaymentSuccessNotificationParams {
  userEmail: string;
  userName: string;
  doctorName: string;
  appointmentDate: string;
  appointmentTime: string;
  durationMinutes?: number;
  consultationFee: number;
  transactionId: string;
}

export async function handlePaymentSuccessNotification(params: PaymentSuccessNotificationParams): Promise<void> {
  const {
    userEmail,
    userName,
    doctorName,
    appointmentDate,
    appointmentTime,
    durationMinutes,
    consultationFee,
    transactionId,
  } = params;

  // Step 1: Create Google Meet event
  const meetLink = await createGoogleMeetEvent({
    userEmail,
    appointmentDate,
    appointmentTime,
    durationMinutes,
  });

  // Step 2: Send confirmation email
  await sendBookingConfirmationEmail({
    userEmail,
    userName,
    doctorName,
    appointmentDate,
    appointmentTime,
    durationMinutes,
    consultationFee,
    meetLink,
    transactionId,
  });

  // Step 3: Store meet link in appointment record
  if (meetLink) {
    const { db } = await import('../core/database');
    await db.appointments().updateOne(
      { transaction_id: transactionId },
      { $set: { meet_link: meetLink, updated_at: new Date() } }
    );
  }
}
