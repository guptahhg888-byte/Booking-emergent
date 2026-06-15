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
import { handlePaymentSuccessNotification, handlePaymentFailureNotification } from '../services/email';
import { getPhonepeToken, verifyWebhookAuth, webhookAuthRequired } from '../services/phonepe';
import { FRONTEND_URL, PHONEPE_ENV, PHONEPE_PAY_URL, PHONEPE_STATUS_BASE, PHONEPE_MERCHANT_ID } from '../core/config';

const router = Router();

const completeAppointmentPayment = async (txnId: string, amountPaise: number): Promise<void> => {
  await db.appointments().updateOne(
    { transaction_id: txnId },
    { $set: { status: 'confirmed', payment_status: 'paid' } }
  );
  const apptForEmail = await db.appointments().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
  if (apptForEmail) {
    handlePaymentSuccessNotification({
      userEmail: (apptForEmail['patient_email'] as string) ?? '',
      userName: (apptForEmail['patient_name'] as string) ?? '',
      userPhone: (apptForEmail['patient_phone'] as string) ?? '',
      doctorName: (apptForEmail['doctor_name'] as string) ?? '',
      serviceName: (apptForEmail['service_name'] as string) ?? null,
      appointmentDate: (apptForEmail['appointment_date'] as string) ?? '',
      appointmentTime: (apptForEmail['appointment_time'] as string) ?? '',
      durationMinutes: (apptForEmail['duration_minutes'] as number) ?? 30,
      consultationFee: amountPaise / 100,
      transactionId: txnId,
    }).catch((err) => console.error('[Email] Notification failed:', err));
  }
};

const completeWorkshopPayment = async (txn: Record<string, unknown>): Promise<void> => {
  const registrationId = txn['workshop_registration_id'] as string | undefined;
  if (!registrationId) return;
  await db.workshop_registrations().updateOne(
    { _id: new ObjectId(registrationId) },
    {
      $set: {
        payment_status: 'paid',
        transaction_id: txn['transaction_id'],
        show_meet_link: true,
        updated_at: new Date(),
      },
    }
  );
};

// ─── POST /payments/initiate ──────────────────────────────────────────────────

router.post('/initiate', requireAuth, validate(PaymentInitiateSchema), async (req: Request, res: Response) => {
  const user = req.user!;
  const { appointment_id, workshop_registration_id } = req.body;

  let paymentSource: Record<string, unknown> | null = null;
  let entityType: 'appointment' | 'workshop_registration' = 'appointment';
  let amountRupees = 2000;
  let paymentLabel = '';
  let doctorName = '';
  let eventDate = '';
  let eventTime = '';

  if (appointment_id) {
    try {
      paymentSource = await db.appointments().findOne({ _id: new ObjectId(appointment_id) }) as Record<string, unknown> | null;
    } catch {
      res.status(404).json({ detail: 'Appointment not found' }); return;
    }
    if (!paymentSource) { res.status(404).json({ detail: 'Appointment not found' }); return; }
    if (paymentSource['user_id'] !== user['_id']) { res.status(403).json({ detail: 'Access denied' }); return; }
    amountRupees = (paymentSource['consultation_fee'] as number) ?? 2000;
    doctorName = (paymentSource['doctor_name'] as string) ?? '';
    eventDate = (paymentSource['appointment_date'] as string) ?? '';
    eventTime = (paymentSource['appointment_time'] as string) ?? '';
    paymentLabel = `Consultation fee - ${doctorName}`;
  } else {
    entityType = 'workshop_registration';
    try {
      paymentSource = await db.workshop_registrations().findOne({ _id: new ObjectId(workshop_registration_id) }) as Record<string, unknown> | null;
    } catch {
      res.status(404).json({ detail: 'Workshop registration not found' }); return;
    }
    if (!paymentSource) { res.status(404).json({ detail: 'Workshop registration not found' }); return; }
    if (paymentSource['user_id'] !== user['_id']) { res.status(403).json({ detail: 'Access denied' }); return; }
    amountRupees = (paymentSource['price'] as number) ?? 0;
    doctorName = (paymentSource['doctor_name'] as string) ?? '';
    eventDate = (paymentSource['workshop_date'] as string) ?? '';
    eventTime = (paymentSource['start_time'] as string) ?? '';
    paymentLabel = `Workshop fee - ${paymentSource['title'] ?? doctorName}`;
  }

  const amountPaise = Math.round(amountRupees * 100);
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
          udf2: doctorName,
          udf3: String(paymentSource['_id']),
        },
        paymentFlow: {
          type: 'PG_CHECKOUT',
          message: paymentLabel,
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
    appointment_id: appointment_id ? String(paymentSource['_id']) : null,
    workshop_registration_id: workshop_registration_id ? String(paymentSource['_id']) : null,
    entity_type: entityType,
    user_id: user['_id'] as string,
    merchant_order_id: merchantOrderId,
    transaction_id: txnId,
    amount: amountPaise,
    payment_state: 'PENDING',
    checkout_url: checkoutUrl,
    doctor_name: doctorName,
    appointment_date: eventDate,
    appointment_time: eventTime,
    phonepe_env: PHONEPE_ENV,
    api_error: apiError,
    created_at: new Date(),
    updated_at: new Date(),
  });

  if (appointment_id) {
    await db.appointments().updateOne(
      { _id: new ObjectId(appointment_id) },
      { $set: { transaction_id: txnId } }
    );
  } else {
    await db.workshop_registrations().updateOne(
      { _id: new ObjectId(workshop_registration_id) },
      { $set: { transaction_id: txnId, updated_at: new Date() } }
    );
  }

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
              if (txn['entity_type'] === 'workshop_registration') {
                await completeWorkshopPayment({ ...txn, transaction_id: txnId });
              } else {
                await completeAppointmentPayment(txnId, (txn['amount'] as number) ?? 0);
              }
            } else {
              if (txn['entity_type'] === 'workshop_registration') {
                const registrationId = txn['workshop_registration_id'] as string | undefined;
                if (registrationId) {
                  await db.workshop_registrations().updateOne(
                    { _id: new ObjectId(registrationId) },
                    { $set: { payment_status: 'failed', show_meet_link: false, updated_at: new Date() } }
                  );
                }
              } else {
                await db.appointments().updateOne(
                  { transaction_id: txnId },
                  { $set: { status: 'cancelled', payment_status: 'failed' } }
                );
              }
              const failAppt = await db.appointments().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
              if (failAppt) {
                handlePaymentFailureNotification({
                  userEmail: (failAppt['patient_email'] as string) ?? '',
                  userName: (failAppt['patient_name'] as string) ?? '',
                  userPhone: (failAppt['patient_phone'] as string) ?? '',
                  doctorName: (failAppt['doctor_name'] as string) ?? '',
                  appointmentDate: (failAppt['appointment_date'] as string) ?? '',
                  appointmentTime: (failAppt['appointment_time'] as string) ?? '',
                  consultationFee: ((txn['amount'] as number) ?? 0) / 100,
                  transactionId: txnId,
                  paymentState: 'FAILED',
                }).catch((err) => console.error('[Email] Failure notification failed:', err));
              }
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
  if (txn['entity_type'] === 'workshop_registration') {
    await completeWorkshopPayment({ ...txn, transaction_id: txnId });
    await logActivity(
      txn['user_id'] as string,
      'Patient',
      'WORKSHOP_PAYMENT_SUCCESS',
      `Workshop registration confirmed for ${txn['doctor_name'] ?? ''}`
    );
  } else if (appt) {
    await logActivity(
      txn['user_id'] as string,
      'Patient',
      'PAYMENT_SUCCESS',
      `Appointment confirmed for ${appt['doctor_name'] ?? ''}`
    );
    await completeAppointmentPayment(txnId, (txn['amount'] as number) ?? 0);
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
  if (txn['entity_type'] === 'workshop_registration') {
    const registrationId = txn['workshop_registration_id'] as string | undefined;
    if (registrationId) {
      await db.workshop_registrations().updateOne(
        { _id: new ObjectId(registrationId) },
        { $set: { payment_status: 'failed', show_meet_link: false, updated_at: new Date() } }
      );
    }
  } else {
    await db.appointments().updateOne(
      { transaction_id: txnId },
      { $set: { status: 'cancelled', payment_status: 'failed' } }
    );
  }
  const failAppt = await db.appointments().findOne({ transaction_id: txnId }) as Record<string, unknown> | null;
  if (failAppt) {
    handlePaymentFailureNotification({
      userEmail: (failAppt['patient_email'] as string) ?? '',
      userName: (failAppt['patient_name'] as string) ?? '',
      userPhone: (failAppt['patient_phone'] as string) ?? '',
      doctorName: (failAppt['doctor_name'] as string) ?? '',
      appointmentDate: (failAppt['appointment_date'] as string) ?? '',
      appointmentTime: (failAppt['appointment_time'] as string) ?? '',
      consultationFee: ((txn['amount'] as number) ?? 0) / 100,
      transactionId: txnId,
      paymentState: 'FAILED',
    }).catch((err) => console.error('[Email] Failure notification failed:', err));
  }
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
      const whTxn = await db.transactions().findOne({ merchant_order_id: merchantOrderId }) as Record<string, unknown> | null;
      if (whTxn?.['entity_type'] === 'workshop_registration') {
        await completeWorkshopPayment({ ...whTxn, transaction_id: merchantOrderId });
      } else {
        await completeAppointmentPayment(merchantOrderId, (whTxn?.['amount'] as number) ?? 0);
      }
    } else if (isFailure) {
      await db.transactions().updateOne(
        { merchant_order_id: merchantOrderId },
        { $set: { payment_state: 'FAILED', updated_at: new Date() } }
      );
      const whFailTxn = await db.transactions().findOne({ merchant_order_id: merchantOrderId }) as Record<string, unknown> | null;
      if (whFailTxn?.['entity_type'] === 'workshop_registration') {
        const registrationId = whFailTxn['workshop_registration_id'] as string | undefined;
        if (registrationId) {
          await db.workshop_registrations().updateOne(
            { _id: new ObjectId(registrationId) },
            { $set: { payment_status: 'failed', show_meet_link: false, updated_at: new Date() } }
          );
        }
      } else {
        await db.appointments().updateOne(
          { transaction_id: merchantOrderId },
          { $set: { status: 'cancelled', payment_status: 'failed' } }
        );
      }
      const whFailAppt = await db.appointments().findOne({ transaction_id: merchantOrderId }) as Record<string, unknown> | null;
      if (whFailAppt) {
        handlePaymentFailureNotification({
          userEmail: (whFailAppt['patient_email'] as string) ?? '',
          userName: (whFailAppt['patient_name'] as string) ?? '',
          userPhone: (whFailAppt['patient_phone'] as string) ?? '',
          doctorName: (whFailAppt['doctor_name'] as string) ?? '',
          appointmentDate: (whFailAppt['appointment_date'] as string) ?? '',
          appointmentTime: (whFailAppt['appointment_time'] as string) ?? '',
          consultationFee: ((whFailTxn?.['amount'] as number) ?? 0) / 100,
          transactionId: merchantOrderId,
          paymentState: 'FAILED',
        }).catch((err) => console.error('[Email] Webhook failure notification failed:', err));
      }
    }
    res.json({ status: 'received' });
  } catch (e) {
    console.error('[PhonePe] Webhook error:', e);
    res.json({ status: 'error' });
  }
});

export default router;

