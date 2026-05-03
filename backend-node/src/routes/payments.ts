/**
 * Payment routes: initiate, status, simulate, webhook (PhonePe Standard PG v1).
 */
import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { db } from '../core/database';
import { requireAuth } from '../core/middleware';
import { validate, PaymentInitiateSchema } from '../core/schemas';
import { logActivity } from '../services/activity';
import { generateChecksum, verifyWebhookChecksum, verifyWebhookAuth, webhookAuthRequired } from '../services/phonepe';
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

  try {
    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId: merchantOrderId,
      merchantUserId: String(user['_id']),
      amount: amountPaise,
      redirectUrl: redirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: `${FRONTEND_URL.replace('3000', '8000')}/api/payments/webhook`,
      mobileNumber: (user['phone'] as string) ?? '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
    // For V1 Pay, endpoint used in checksum is "/pg/v1/pay"
    const checksum = generateChecksum(base64Payload, '/pg/v1/pay');

    const resp = await axios.post(PHONEPE_PAY_URL, { request: base64Payload }, {
      headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum },
      timeout: 10000,
      validateStatus: () => true,
    });

    if (resp.status === 200 && resp.data?.success) {
      checkoutUrl = resp.data.data?.instrumentResponse?.redirectInfo?.url ?? null;
    } else {
      apiError = `${resp.status}: ${JSON.stringify(resp.data).slice(0, 200)}`;
      console.warn('[PhonePe] pay init failed:', apiError);
    }
  } catch (e: any) {
    apiError = String(e.message);
    console.warn('[PhonePe] API exception:', apiError);
  }

  // Fallback to simulation only if real PhonePe fails entirely
  if (!checkoutUrl) {
    console.warn('[PhonePe] Falling back to simulation page');
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
    try {
      const merchantId = PHONEPE_MERCHANT_ID;
      const endpoint = `/pg/v1/status/${merchantId}/${txn['merchant_order_id']}`;
      const url = `${PHONEPE_STATUS_BASE}/${merchantId}/${txn['merchant_order_id']}`;
      
      const checksum = generateChecksum('', endpoint); // Status check uses empty payload

      const resp = await axios.get(url, {
        headers: { 'Content-Type': 'application/json', 'X-VERIFY': checksum, 'X-MERCHANT-ID': merchantId },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (resp.status === 200 && resp.data?.success) {
        const newState = resp.data.data?.state ?? '';
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
  const xVerify = req.headers['x-verify'] as string;
  
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any> = req.body ?? {};

    // Standard PG Checkout base64 response
    if (body['response'] && typeof body['response'] === 'string') {
      const base64Body = body['response'];
      
      // Verify signature
      if (xVerify && !verifyWebhookChecksum(base64Body, xVerify)) {
        console.warn('[PhonePe] Webhook rejected: invalid X-VERIFY checksum');
        res.status(401).json({ detail: 'Invalid webhook signature' });
        return;
      }
      
      try {
        const decoded = Buffer.from(base64Body, 'base64').toString('utf-8');
        body = JSON.parse(decoded);
      } catch { /* ignore */ }
    } else if (webhookAuthRequired() && !verifyWebhookAuth(req.headers.authorization ?? '')) {
      // Legacy basic auth fallback
      console.warn('[PhonePe] Webhook rejected: invalid Basic Auth signature');
      res.status(401).json({ detail: 'Invalid webhook signature' });
      return;
    }

    const payload: Record<string, unknown> = body['data'] ?? body['payload'] ?? body;
    const merchantOrderId: string =
      (payload['merchantTransactionId'] as string) ?? (payload['merchantOrderId'] as string) ?? '';
    const state = String(payload['state'] ?? payload['code'] ?? '').toUpperCase();

    if (!merchantOrderId) { res.json({ status: 'ignored' }); return; }

    const isSuccess = state === 'COMPLETED' || state === 'PAYMENT_SUCCESS';
    const isFailure = ['FAILED', 'PAYMENT_ERROR'].includes(state);

    if (isSuccess) {
      await db.transactions().updateOne(
        { merchant_order_id: merchantOrderId },
        { $set: { payment_state: 'COMPLETED', updated_at: new Date() } }
      );
      await db.appointments().updateOne(
        { transaction_id: merchantOrderId },
        { $set: { status: 'confirmed', payment_status: 'paid' } }
      );
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
