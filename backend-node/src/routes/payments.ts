/**
 * Payment routes: initiate, status, simulate, webhook (PhonePe v2).
 * Equivalent of Python's routes/payments.py
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { db } from '../core/database';
import { requireAuth } from '../core/middleware';
import { validate, PaymentInitiateSchema } from '../core/schemas';
import { logActivity } from '../services/activity';
import { handlePaymentSuccessNotification } from '../services/email';
import { getPhonepeToken, verifyWebhookAuth, webhookAuthRequired } from '../services/phonepe';
import { FRONTEND_URL, PHONEPE_ENV, PHONEPE_PAY_URL, PHONEPE_STATUS_BASE, PHONEPE_MERCHANT_ID } from '../core/config';

const router = Router();

// ─── POST /payments/initiate ──────────────────────────────────────────────────

router.post('/initiate', requireAuth, validate(PaymentInitiateSchema), async (req: Request, res: Response) => {
  const user = req.user!;
  const { appointment_id } = req.body;

  let appt: Record<string, unknown> | null = null;
  try {
    appt = await db.appointments().findOne({ _id: new ObjectId(appointment_id) }) as Record<string, unknown> | null;
  } catch {
    res.status(404).json({ detail: 'Appointment not found' }); return;
  }
  if (!appt) { res.status(404).json({ detail: 'Appointment not found' }); return; }
  if (appt['user_id'] !== user['_id']) { res.status(403).json({ detail: 'Access denied' }); return; }

  const amountPaise = Math.round(((appt['consultation_fee'] as number) ?? 2000) * 100);
  const merchantOrderId = `MC${uuidv4().replace(/-/g, '').slice(0, 14).toUpperCase()}`;
  const txnId = merchantOrderId;
  const redirectUrl = `${FRONTEND_URL}/payment/status?txnId=${txnId}`;

  let checkoutUrl: string | null = null;
  let apiError: string | null = null;

  const accessToken = await getPhonepeToken();
  if (accessToken) {
    try {
      const payload = {
        merchantId: PHONEPE_MERCHANT_ID,
        merchantOrderId,
        amount: amountPaise,
        expireAfter: 1200,
        metaInfo: {
          udf1: user['_id'],
          udf2: appt['doctor_name'] ?? '',
          udf3: String(appt['_id']),
        },
        paymentFlow: {
          type: 'PG_CHECKOUT',
          message: `Consultation fee - ${appt['doctor_name'] ?? ''}`,
          merchantUrls: { redirectUrl },
        },
      };
      const resp = await axios.post(PHONEPE_PAY_URL, payload, {
        headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${accessToken}` },
        timeout: 10000,
        validateStatus: () => true,
      });
      if (resp.status === 200 || resp.status === 201) {
        checkoutUrl = resp.data?.redirectUrl ?? resp.data?.data?.redirectUrl ?? null;
      } else {
        apiError = `${resp.status}: ${JSON.stringify(resp.data).slice(0, 200)}`;
        console.warn('[PhonePe] pay init failed:', apiError);
      }
    } catch (e: any) {
      apiError = String(e.message);
      console.warn('[PhonePe] API exception:', e);
    }
  }

  if (!checkoutUrl) {
    checkoutUrl = `${FRONTEND_URL}/payment/simulate/${txnId}`;
  }

  await db.transactions().insertOne({
    appointment_id: String(appt['_id']),
    user_id: user['_id'] as string,
    merchant_order_id: merchantOrderId,
    transaction_id: txnId,
    amount: amountPaise,
    payment_state: 'PENDING',
    checkout_url: checkoutUrl,
    doctor_name: (appt['doctor_name'] as string) ?? '',
    appointment_date: (appt['appointment_date'] as string) ?? '',
    appointment_time: (appt['appointment_time'] as string) ?? '',
    phonepe_env: PHONEPE_ENV,
    api_error: apiError,
    created_at: new Date(),
    updated_at: new Date(),
  });

  await db.appointments().updateOne(
    { _id: new ObjectId(appointment_id) },
    { $set: { transaction_id: txnId } }
  );

  res.json({
    checkout_url: checkoutUrl,
    transaction_id: txnId,
    merchant_order_id: merchantOrderId,
    is_simulation: checkoutUrl.includes('/simulate/'),
  });
});

// ─── GET /payments/status/:txnId ─────────────────────────────────────────────

router.get('/status/:txnId', async (req: Request, res: Response) => {
  const { txnId } = req.params;
  const txn = await db.transactions().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
  if (!txn) { res.status(404).json({ detail: 'Transaction not found' }); return; }

  const safeT: Record<string, unknown> = { ...txn, _id: String(txn['_id']) };

  if (txn['payment_state'] === 'PENDING') {
    const accessToken = await getPhonepeToken();
    if (accessToken) {
      try {
        const merchantId = PHONEPE_MERCHANT_ID || txn['merchant_order_id']; 
        const url = `${PHONEPE_STATUS_BASE}/${txn['merchant_order_id']}/status?details=false&errorContext=true`;
        const resp = await axios.get(url, {
          headers: { 'Content-Type': 'application/json', Authorization: `O-Bearer ${accessToken}` },
          timeout: 10000,
          validateStatus: () => true,
        });
        if (resp.status === 200) {
          const newState: string = resp.data?.state ?? resp.data?.data?.state ?? '';
          if (['COMPLETED', 'FAILED'].includes(newState)) {
            await db.transactions().updateOne(
              { transaction_id: txnId },
              { $set: { payment_state: newState, updated_at: new Date() } }
            );
            safeT['payment_state'] = newState;
            if (newState === 'COMPLETED') {
              await db.appointments().updateOne(
                { transaction_id: txnId },
                { $set: { status: 'confirmed', payment_status: 'paid' } }
              );
              // Send confirmation email + create Google Meet
              const apptForEmail = await db.appointments().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
              if (apptForEmail) {
                handlePaymentSuccessNotification({
                  userEmail: (apptForEmail['patient_email'] as string) ?? '',
                  userName: (apptForEmail['patient_name'] as string) ?? '',
                  doctorName: (apptForEmail['doctor_name'] as string) ?? '',
                  appointmentDate: (apptForEmail['appointment_date'] as string) ?? '',
                  appointmentTime: (apptForEmail['appointment_time'] as string) ?? '',
                  durationMinutes: (apptForEmail['duration_minutes'] as number) ?? 30,
                  consultationFee: ((txn['amount'] as number) ?? 0) / 100,
                  transactionId: txnId,
                }).catch((err) => console.error('[Email] Notification failed:', err));
              }
            } else {
              await db.appointments().updateOne(
                { transaction_id: txnId },
                { $set: { status: 'cancelled', payment_status: 'failed' } }
              );
            }
          }
        }
      } catch (e) {
        console.warn('[PhonePe] status check failed:', e);
      }
    }
  }
  res.json(safeT);
});

// ─── POST /payments/simulate/:txnId/success ───────────────────────────────────

router.post('/simulate/:txnId/success', async (req: Request, res: Response) => {
  const { txnId } = req.params;
  const txn = await db.transactions().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
  if (!txn) { res.status(404).json({ detail: 'Transaction not found' }); return; }

  const provRef = `SIM${uuidv4().slice(0, 8).toUpperCase()}`;
  await db.transactions().updateOne(
    { transaction_id: txnId },
    {
      $set: {
        payment_state: 'COMPLETED',
        payment_mode: 'UPI_SIMULATE',
        provider_reference_id: provRef,
        updated_at: new Date(),
      },
    }
  );
  const appt = await db.appointments().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
  if (appt) {
    await db.appointments().updateOne(
      { transaction_id: txnId },
      { $set: { status: 'confirmed', payment_status: 'paid' } }
    );
    await logActivity(
      txn['user_id'] as string,
      'Patient',
      'PAYMENT_SUCCESS',
      `Appointment confirmed for ${appt['doctor_name'] ?? ''}`
    );
    // Send confirmation email + create Google Meet
    handlePaymentSuccessNotification({
      userEmail: (appt['patient_email'] as string) ?? '',
      userName: (appt['patient_name'] as string) ?? '',
      doctorName: (appt['doctor_name'] as string) ?? '',
      appointmentDate: (appt['appointment_date'] as string) ?? '',
      appointmentTime: (appt['appointment_time'] as string) ?? '',
      durationMinutes: (appt['duration_minutes'] as number) ?? 30,
      consultationFee: ((txn['amount'] as number) ?? 0) / 100,
      transactionId: txnId,
    }).catch((err) => console.error('[Email] Notification failed:', err));
  }
  res.json({ message: 'Payment simulated successfully', transaction_id: txnId, provider_reference_id: provRef });
});

// ─── POST /payments/simulate/:txnId/failure ───────────────────────────────────

router.post('/simulate/:txnId/failure', async (req: Request, res: Response) => {
  const { txnId } = req.params;
  const txn = await db.transactions().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
  if (!txn) { res.status(404).json({ detail: 'Transaction not found' }); return; }

  await db.transactions().updateOne(
    { transaction_id: txnId },
    { $set: { payment_state: 'FAILED', updated_at: new Date() } }
  );
  await db.appointments().updateOne(
    { transaction_id: txnId },
    { $set: { status: 'cancelled', payment_status: 'failed' } }
  );
  res.json({ message: 'Payment failed', transaction_id: txnId });
});

// ─── POST /payments/webhook ───────────────────────────────────────────────────

router.post('/webhook', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization ?? '';
  if (webhookAuthRequired() && !verifyWebhookAuth(authHeader)) {
    console.warn('[PhonePe] Webhook rejected: invalid Authorization signature');
    res.status(401).json({ detail: 'Invalid webhook signature' });
    return;
  }
  if (!webhookAuthRequired()) {
    console.warn('[PhonePe] Webhook auth DISABLED (dev mode). Set PHONEPE_WEBHOOK_USERNAME/PASSWORD before production.');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any> = req.body ?? {};

    // Legacy base64-wrapped payload support
    if (body['response'] && typeof body['response'] === 'string') {
      try {
        const decoded = Buffer.from(body['response'], 'base64').toString('utf-8');
        body = JSON.parse(decoded);
      } catch { /* ignore */ }
    }

    const event: string = body['event'] ?? '';
    const payload: Record<string, unknown> = body['payload'] ?? body['data'] ?? {};
    const merchantOrderId: string =
      (payload['merchantOrderId'] as string) ?? (payload['merchantTransactionId'] as string) ?? '';
    const state = String(payload['state'] ?? '').toUpperCase();

    if (!merchantOrderId) { res.json({ status: 'ignored' }); return; }

    const isSuccess =
      state === 'COMPLETED' ||
      event.toLowerCase().includes('completed') ||
      event.toLowerCase().includes('success');
    const isFailure =
      ['FAILED', 'CANCELLED'].includes(state) ||
      event.toLowerCase().includes('failed') ||
      event.toLowerCase().includes('cancel');

    if (isSuccess) {
      await db.transactions().updateOne(
        { merchant_order_id: merchantOrderId },
        { $set: { payment_state: 'COMPLETED', updated_at: new Date() } }
      );
      await db.appointments().updateOne(
        { transaction_id: merchantOrderId },
        { $set: { status: 'confirmed', payment_status: 'paid' } }
      );
      // Send confirmation email + create Google Meet
      const whAppt = await db.appointments().findOne({ transaction_id: merchantOrderId }) as Record<string, unknown> | null;
      const whTxn = await db.transactions().findOne({ merchant_order_id: merchantOrderId }) as Record<string, unknown> | null;
      if (whAppt) {
        handlePaymentSuccessNotification({
          userEmail: (whAppt['patient_email'] as string) ?? '',
          userName: (whAppt['patient_name'] as string) ?? '',
          doctorName: (whAppt['doctor_name'] as string) ?? '',
          appointmentDate: (whAppt['appointment_date'] as string) ?? '',
          appointmentTime: (whAppt['appointment_time'] as string) ?? '',
          durationMinutes: (whAppt['duration_minutes'] as number) ?? 30,
          consultationFee: ((whTxn?.['amount'] as number) ?? 0) / 100,
          transactionId: merchantOrderId,
        }).catch((err) => console.error('[Email] Webhook notification failed:', err));
      }
    } else if (isFailure) {
      await db.transactions().updateOne(
        { merchant_order_id: merchantOrderId },
        { $set: { payment_state: 'FAILED', updated_at: new Date() } }
      );
      await db.appointments().updateOne(
        { transaction_id: merchantOrderId },
        { $set: { status: 'cancelled', payment_status: 'failed' } }
      );
    }
    res.json({ status: 'received' });
  } catch (e) {
    console.error('[PhonePe] Webhook error:', e);
    res.json({ status: 'error' });
  }
});

export default router;
