import React from 'react';
import { Link } from 'react-router-dom';
import { Stethoscope, MapPin, Clock, Mail, Phone, ArrowRight } from 'lucide-react';
import { ABOUT_CONTENT, CONTACT } from '../content/siteContent';

const AboutPage = () => (
  <div className="min-h-[calc(100vh-64px)] bg-mc-bg font-body">
    <div className="bg-mc-primary py-16 px-4">
      <div className="max-w-4xl mx-auto text-center">
        <p className="text-sm uppercase tracking-[0.2em] font-medium text-emerald-300 mb-3">About Us</p>
        <h1 className="font-heading text-4xl lg:text-5xl text-white font-700 mb-4" data-testid="about-page-title">
          {ABOUT_CONTENT.title}
        </h1>
        <p className="text-white/80 text-lg leading-relaxed max-w-2xl mx-auto">{ABOUT_CONTENT.intro}</p>
      </div>
    </div>

    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
      <div className="bg-mc-surface border border-mc-border rounded-2xl p-8">
        <h2 className="font-heading text-xl text-mc-text font-600 mb-3">Our Mission</h2>
        <p className="text-mc-text-secondary text-sm leading-relaxed">{ABOUT_CONTENT.mission}</p>
      </div>

      <div className="bg-mc-surface border border-mc-border rounded-2xl p-8">
        <h2 className="font-heading text-xl text-mc-text font-600 mb-4">What We Offer</h2>
        <ul className="space-y-3">
          {ABOUT_CONTENT.highlights.map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-mc-text-secondary">
              <Stethoscope size={18} className="text-mc-primary flex-shrink-0 mt-0.5" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-mc-surface border border-mc-border rounded-2xl p-8">
        <h2 className="font-heading text-xl text-mc-text font-600 mb-3">Our Approach</h2>
        <p className="text-mc-text-secondary text-sm leading-relaxed">{ABOUT_CONTENT.approach}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-mc-primary/5 border border-mc-border rounded-2xl p-6 flex gap-4">
          <MapPin className="text-mc-primary flex-shrink-0" size={22} />
          <div>
            <p className="text-xs uppercase tracking-wider text-mc-text-secondary mb-1">Clinic</p>
            <p className="text-sm text-mc-text">{CONTACT.clinic}</p>
          </div>
        </div>
        <div className="bg-mc-primary/5 border border-mc-border rounded-2xl p-6 flex gap-4">
          <Clock className="text-mc-primary flex-shrink-0" size={22} />
          <div>
            <p className="text-xs uppercase tracking-wider text-mc-text-secondary mb-1">Hours</p>
            <p className="text-sm text-mc-text">{CONTACT.hours}</p>
          </div>
        </div>
        <div className="bg-mc-primary/5 border border-mc-border rounded-2xl p-6 flex gap-4">
          <Phone className="text-mc-primary flex-shrink-0" size={22} />
          <div>
            <p className="text-xs uppercase tracking-wider text-mc-text-secondary mb-1">Phone</p>
            <a href={`tel:${CONTACT.phone}`} className="text-sm text-mc-primary hover:underline">{CONTACT.phone}</a>
          </div>
        </div>
        <div className="bg-mc-primary/5 border border-mc-border rounded-2xl p-6 flex gap-4">
          <Mail className="text-mc-primary flex-shrink-0" size={22} />
          <div>
            <p className="text-xs uppercase tracking-wider text-mc-text-secondary mb-1">Email</p>
            <a href={`mailto:${CONTACT.email}`} className="text-sm text-mc-primary hover:underline break-all">{CONTACT.email}</a>
          </div>
        </div>
      </div>

      <div className="text-center pt-4">
        <Link to="/doctors" className="inline-flex items-center gap-2 btn-primary" data-testid="about-book-cta">
          Book a Consultation <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  </div>
);

export default AboutPage;

