import React from 'react';
import PolicyLayout from '../components/PolicyLayout';
import { REFUND_SECTIONS } from '../content/siteContent';

const RefundPolicyPage = () => (
  <PolicyLayout
    title="Refund Policy"
    subtitle="Cancellation and refund guidelines"
    testId="refund-page-title"
  >
    {REFUND_SECTIONS.map((section) => (
      <section key={section.heading}>
        <h2 className="font-heading text-base text-mc-text font-600 mb-2">{section.heading}</h2>
        <p>{section.body}</p>
      </section>
    ))}
  </PolicyLayout>
);

export default RefundPolicyPage;

