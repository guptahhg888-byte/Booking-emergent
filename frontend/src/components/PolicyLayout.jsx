import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { POLICY_LINKS, CONTACT } from '../content/siteContent';

const PolicyLayout = ({ title, subtitle, children, testId }) => {
  const location = useLocation();

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg">
      <div className="bg-mc-primary py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] font-medium text-emerald-300 mb-2">Policies</p>
          <h1 className="font-heading text-3xl sm:text-4xl text-white font-700 mb-2" data-testid={testId}>{title}</h1>
          {subtitle && <p className="text-white/70 text-sm font-body">{subtitle}</p>}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <nav className="flex flex-wrap gap-2 mb-8" aria-label="Policy sections" data-testid="policy-subnav">
          {POLICY_LINKS.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`text-sm font-body px-4 py-2 rounded-full border transition-all ${
                location.pathname === link.path
                  ? 'bg-mc-primary text-white border-mc-primary'
                  : 'bg-mc-surface text-mc-text-secondary border-mc-border hover:border-mc-primary hover:text-mc-primary'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <article className="bg-mc-surface border border-mc-border rounded-2xl p-6 sm:p-8 space-y-6 font-body text-sm text-mc-text-secondary leading-relaxed">
          {children}
        </article>

        <p className="text-center text-xs text-mc-text-secondary mt-8 font-body">
          Questions?{' '}
          <a href={`mailto:${CONTACT.email}`} className="text-mc-primary hover:underline">{CONTACT.email}</a>
          {' · '}
          <a href={`tel:${CONTACT.phone}`} className="text-mc-primary hover:underline">{CONTACT.phone}</a>
        </p>
      </div>
    </div>
  );
};

export default PolicyLayout;

