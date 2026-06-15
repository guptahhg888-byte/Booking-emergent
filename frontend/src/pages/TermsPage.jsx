import React from 'react';
import PolicyLayout from '../components/PolicyLayout';
import { TERMS_SECTIONS } from '../content/siteContent';

const TermsPage = () => (
  <PolicyLayout
    title="Terms & Conditions"
    subtitle="Last updated: May 2025"
    testId="terms-page-title"
  >
    {TERMS_SECTIONS.map((section) => (
      <section key={section.heading}>
        <h2 className="font-heading text-base text-mc-text font-600 mb-2">{section.heading}</h2>
        <p>{section.body}</p>
      </section>
    ))}
  </PolicyLayout>
);

export default TermsPage;

