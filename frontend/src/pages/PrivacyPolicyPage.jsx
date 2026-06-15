import React from 'react';
import PolicyLayout from '../components/PolicyLayout';
import { PRIVACY_SECTIONS } from '../content/siteContent';

const PrivacyPolicyPage = () => (
  <PolicyLayout
    title="Privacy Policy"
    subtitle="How we handle your personal information"
    testId="privacy-page-title"
  >
    {PRIVACY_SECTIONS.map((section) => (
      <section key={section.heading}>
        <h2 className="font-heading text-base text-mc-text font-600 mb-2">{section.heading}</h2>
        <p>{section.body}</p>
      </section>
    ))}
  </PolicyLayout>
);

export default PrivacyPolicyPage;

