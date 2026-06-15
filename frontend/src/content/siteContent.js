/** Shared copy for About and policy pages — Dr. Madhumati Singh practice */

export const CONTACT = {
  phone: '8077441534',
  email: 'guptah.hg888@gmail.com',
  clinic: 'Arahant Mind Wellness, Sector 28, Noida, Uttar Pradesh',
  hours: 'Monday – Saturday, 9:00 AM – 8:00 PM (IST)',
};

export const ABOUT_CONTENT = {
  title: 'About Dr. Madhumati Singh',
  intro:
    'Dr. Madhumati Singh is a counselling psychologist and relationship expert with over 36 years of experience supporting individuals, couples, and families through life transitions, emotional challenges, and personal growth.',
  mission:
    'Our mission is to make compassionate, confidential mental-health support accessible—whether you prefer a video session from home or an in-person visit at our Noida clinic.',
  highlights: [
    'Clinical psychology, relationship counselling, and stress management',
    'Experience with anxiety, depression, addiction recovery support, and LGBTQ+ affirmative care',
    'Secure online booking with PhonePe payments and instant confirmation',
    '1:1 sessions tailored to your goals—typically 45 or 60 minutes',
  ],
  approach:
    'Every consultation begins with listening. Sessions are collaborative, non-judgmental, and focused on practical strategies you can apply in daily life. This platform is for scheduled consultations only; it is not an emergency or crisis hotline.',
};

export const TERMS_SECTIONS = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By creating an account or booking a consultation through Dr. Madhumati Singh’s website, you agree to these Terms & Conditions. If you do not agree, please do not use the booking service.',
  },
  {
    heading: '2. Nature of Service',
    body: 'Consultations are professional counselling and psychology sessions. They do not replace emergency medical care, psychiatric hospitalisation, or legal advice. If you are in immediate danger, contact local emergency services or a crisis helpline.',
  },
  {
    heading: '3. Booking & Appointments',
    body: 'Appointments are confirmed only after successful payment (where applicable) and system confirmation. You are responsible for joining on time with a stable internet connection (for online sessions) or arriving at the clinic address provided in your confirmation email.',
  },
  {
    heading: '4. Payments',
    body: 'Fees are displayed at checkout in your selected currency where supported; charges are processed securely via PhonePe. You will receive a digital receipt and booking confirmation by email.',
  },
  {
    heading: '5. User Accounts',
    body: 'You must provide accurate contact details. You are responsible for safeguarding your login credentials and for all activity under your account.',
  },
  {
    heading: '6. Conduct',
    body: 'Abusive, threatening, or harassing behaviour toward staff or during sessions may result in cancellation without refund and permanent restriction from the platform.',
  },
  {
    heading: '7. Limitation of Liability',
    body: 'To the fullest extent permitted by law, Dr. Madhumati Singh and this platform are not liable for indirect or consequential damages arising from use of the booking system or attendance at sessions.',
  },
  {
    heading: '8. Changes',
    body: 'We may update these terms from time to time. Continued use of the site after changes are posted constitutes acceptance of the revised terms.',
  },
];

export const REFUND_SECTIONS = [
  {
    heading: '1. Cancellation by You',
    body: 'You may cancel or reschedule at least 24 hours before the scheduled session time through your account dashboard or by contacting us. Cancellations made within 24 hours of the appointment may not be eligible for a refund.',
  },
  {
    heading: '2. Refund Eligibility',
    body: 'Refunds are considered when: (a) you cancel with at least 24 hours’ notice; (b) the consultant cancels or reschedules and you cannot attend the proposed alternative; or (c) a technical failure on our side prevents the session from occurring and it cannot be rescheduled promptly.',
  },
  {
    heading: '3. Non-Refundable Situations',
    body: 'No refund is issued for: late cancellation (under 24 hours), no-show without notice, partial attendance, or dissatisfaction with clinical outcomes where the session was delivered as booked.',
  },
  {
    heading: '4. Processing',
    body: 'Approved refunds are returned to the original payment method within 7–10 business days, subject to your bank or PhonePe processing times.',
  },
  {
    heading: '5. Disputes',
    body: 'For refund requests, email us with your booking reference and reason. We will respond within 3 business days.',
  },
];

export const PRIVACY_SECTIONS = [
  {
    heading: '1. Information We Collect',
    body: 'We collect information you provide when registering or booking: name, email, phone number, appointment details, and optional notes about your consultation reason. Payment data is handled by PhonePe; we do not store full card or UPI credentials.',
  },
  {
    heading: '2. How We Use Your Data',
    body: 'Your data is used to manage bookings, send confirmations and reminders, process payments, improve our services, and comply with legal obligations. Session notes and clinical records, if any, are maintained separately under professional confidentiality standards.',
  },
  {
    heading: '3. Confidentiality',
    body: 'Consultation content is confidential within the bounds of professional ethics and applicable law (including mandatory reporting where required). We do not sell your personal information to third parties.',
  },
  {
    heading: '4. Data Security',
    body: 'We use industry-standard measures including encrypted connections (HTTPS) and secure authentication. No system is 100% secure; please use a private device and network when sharing sensitive information.',
  },
  {
    heading: '5. Cookies & Analytics',
    body: 'The site may use essential cookies for login sessions. We do not use invasive third-party advertising trackers.',
  },
  {
    heading: '6. Your Rights',
    body: 'You may request access to or correction of your account data, or ask us to delete your account where no legal retention requirement applies. Contact us using the details below.',
  },
  {
    heading: '7. Contact',
    body: `Privacy enquiries: ${CONTACT.email} · ${CONTACT.phone}`,
  },
];

/** Service offerings — icons only (no per-service photos) */
export const SERVICES = [
  {
    id: 'standard',
    title: 'Standard Consultation',
    designation: 'Counselling Psychologist',
    duration: 'As scheduled',
    description: 'One-on-one session for emotional wellbeing, stress, or general guidance.',
    icon: 'heart',
  },
  {
    id: '45min',
    title: '45-Minute Session',
    designation: 'Relationship & Personal Growth',
    duration: '45 minutes',
    description: 'Focused session for couples, family dynamics, or targeted concerns.',
    icon: 'users',
  },
  {
    id: '60min',
    title: '60-Minute Session',
    designation: 'In-Depth Clinical Support',
    duration: '60 minutes',
    description: 'Extended session for complex concerns, de-addiction support, or deeper work.',
    icon: 'brain',
  },
];

export const POLICY_LINKS = [
  { label: 'Terms & Conditions', path: '/policies/terms' },
  { label: 'Refund Policy', path: '/policies/refund' },
  { label: 'Privacy Policy', path: '/policies/privacy' },
];

