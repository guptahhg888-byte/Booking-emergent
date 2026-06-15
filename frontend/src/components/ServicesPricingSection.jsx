import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Users, Brain, Clock, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import { useCurrency } from '../contexts/CurrencyContext';
import { SERVICES } from '../content/siteContent';

const ICONS = { heart: Heart, users: Users, brain: Brain };

const ServicesPricingSection = () => {
  const [doctor, setDoctor] = useState(null);
  const { convertFee } = useCurrency();

  useEffect(() => {
    api.get('/doctors').then((res) => {
      const list = res.data || [];
      if (list.length > 0) setDoctor(list[0]);
    }).catch(() => {});
  }, []);

  const priceFor = (serviceId) => {
    if (!doctor) return null;
    if (serviceId === '45min' && doctor.fee_45min != null) return doctor.fee_45min;
    if (serviceId === '60min' && doctor.fee_60min != null) return doctor.fee_60min;
    return doctor.consultation_fee;
  };

  const bookHref = doctor ? `/doctors/${doctor._id}` : '/doctors';

  return (
    <section className="py-24 bg-white" data-testid="services-pricing-section">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm uppercase tracking-[0.2em] font-medium text-mc-secondary mb-3">Services</p>
          <h2 className="font-heading text-4xl lg:text-5xl text-mc-text font-700">Consultation Fees</h2>
          <p className="text-mc-text-secondary text-sm mt-4 max-w-xl mx-auto">
            Transparent pricing for sessions with Dr. Madhumati Singh. Choose the format that fits your needs.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {SERVICES.map((service) => {
            const Icon = ICONS[service.icon] || Heart;
            const feeInr = priceFor(service.id);
            const fee = feeInr != null ? convertFee(feeInr) : null;

            return (
              <div
                key={service.id}
                className="bg-mc-surface border border-mc-border rounded-2xl p-8 flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                data-testid={`service-card-${service.id}`}
              >
                <div className="w-14 h-14 bg-mc-primary/10 rounded-2xl flex items-center justify-center text-mc-primary mb-5">
                  <Icon size={28} strokeWidth={1.5} />
                </div>
                <p className="text-xs font-medium text-mc-secondary uppercase tracking-wider mb-1">{service.designation}</p>
                <h3 className="font-heading text-xl text-mc-text font-600 mb-2">{service.title}</h3>
                <p className="text-mc-text-secondary text-sm leading-relaxed flex-1 mb-4">{service.description}</p>
                <div className="flex items-center gap-2 text-xs text-mc-text-secondary mb-4">
                  <Clock size={13} />
                  <span>{service.duration}</span>
                </div>
                {fee ? (
                  <div className="mb-5">
                    <p className="font-heading text-2xl text-mc-primary font-700">{fee.display}</p>
                    {fee.isInternational && (
                      <p className="text-[10px] text-mc-text-secondary mt-0.5">{fee.displayINR} INR</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-mc-text-secondary mb-5">See booking page for current fee</p>
                )}
                <Link
                  to={bookHref}
                  className="inline-flex items-center justify-center gap-2 btn-primary text-sm w-full"
                  data-testid={`service-book-${service.id}`}
                >
                  Book Now <ArrowRight size={16} />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ServicesPricingSection;

