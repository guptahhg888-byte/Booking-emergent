import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Stethoscope, Calendar, CreditCard, Star, ArrowRight, CheckCircle, Users, Award, Clock } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';

const LandingPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { convertFee } = useCurrency();
  const [featuredDoctors, setFeaturedDoctors] = useState([]);

  useEffect(() => {
    api.get('/doctors').then(res => setFeaturedDoctors(res.data.slice(0, 3))).catch(() => {});
  }, []);

  return (
    <div className="font-body">
      {/* Hero */}
      <section
        className="relative min-h-[92vh] flex items-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #2C5545 0%, #3D6E5C 50%, #8A9A86 100%)' }}
        data-testid="hero-section"
      >
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "url('https://images.pexels.com/photos/33812025/pexels-photo-33812025.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940')", backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 grid lg:grid-cols-2 gap-16 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
              <span className="text-white/90 text-sm font-medium">500+ Consultations Completed</span>
            </div>
            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-700 text-white leading-none mb-6">
              Expert Care,<br />
              <span className="text-emerald-300">When You</span><br />
              Need It Most
            </h1>
            <p className="text-white/80 text-lg leading-relaxed mb-10 max-w-md">
              Connect with India's top specialists. Book consultations in minutes, receive expert medical advice, and pay securely — all in one place.
            </p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => navigate('/doctors')}
                className="flex items-center gap-2 bg-white text-mc-primary font-medium rounded-full px-8 py-4 hover:bg-mc-bg transition-all hover:-translate-y-0.5 shadow-lg"
                data-testid="hero-book-now-btn"
              >
                Book a Consultation <ArrowRight size={18} />
              </button>
              {!user && (
                <button
                  onClick={() => navigate('/register')}
                  className="flex items-center gap-2 border-2 border-white/40 text-white font-medium rounded-full px-8 py-4 hover:bg-white/10 transition-all"
                  data-testid="hero-get-started-btn"
                >
                  Get Started Free
                </button>
              )}
            </div>
          </div>

          {/* Stats Card */}
          <div className="hidden lg:grid grid-cols-2 gap-4 animate-fade-in">
            {[
              { icon: <Award size={28} />, value: '36+', label: 'Year Experience' },
              { icon: <Users size={28} />, value: '10K+', label: 'Happy Patients' },
              { icon: <Stethoscope size={28} />, value: '20+', label: 'Specializations' },
              { icon: <Star size={28} />, value: '4.8/5', label: 'Average Rating' },
            ].map((s, i) => (
              <div key={i} className="bg-white/10 backdrop-blur rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-all" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="text-emerald-300 mb-3">{s.icon}</div>
                <div className="text-3xl font-heading font-700 text-white">{s.value}</div>
                <div className="text-white/70 text-sm mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-mc-bg" data-testid="how-it-works-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm uppercase tracking-[0.2em] font-medium text-mc-secondary mb-3">Simple Process</p>
            <h2 className="font-heading text-4xl lg:text-5xl text-mc-text font-700">How Our Website Works</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: <Stethoscope size={32} />, title: 'Find Your Doctor', desc: 'Browse our network of verified specialists. Search by name or specialty to find the right expert for your needs.' },
              { step: '02', icon: <Calendar size={32} />, title: 'Book an Appointment', desc: 'Choose a convenient date and time slot. Our real-time availability system ensures instant confirmation.' },
              { step: '03', icon: <CreditCard size={32} />, title: 'Consult & Pay Securely', desc: 'Get expert medical advice and complete your payment securely via PhonePe. Instant digital receipt provided.' },
            ].map((s, i) => (
              <div key={i} className="relative group">
                <div className="bg-mc-surface border border-mc-border rounded-2xl p-8 hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="text-mc-border font-heading text-7xl font-700 absolute -top-4 right-6 select-none">{s.step}</div>
                  <div className="w-14 h-14 bg-mc-primary/10 rounded-2xl flex items-center justify-center text-mc-primary mb-6 group-hover:bg-mc-primary group-hover:text-white transition-all">
                    {s.icon}
                  </div>
                  <h3 className="font-heading text-xl text-mc-text font-600 mb-3">{s.title}</h3>
                  <p className="text-mc-text-secondary text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Doctors */}
      {featuredDoctors.length > 0 && (
        <section className="py-24 bg-white" data-testid="featured-doctors-section">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-16">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] font-medium text-mc-secondary mb-3">Our Specialists</p>
                <h2 className="font-heading text-4xl lg:text-5xl text-mc-text font-700">Meet Our Doctors</h2>
              </div>
              <Link to="/doctors" className="hidden md:flex items-center gap-2 text-mc-primary font-medium hover:gap-3 transition-all" data-testid="view-all-doctors-link">
                View All <ArrowRight size={18} />
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {featuredDoctors.map((doc, i) => (
                <div key={doc._id} className="group bg-mc-surface border border-mc-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300" style={{ animationDelay: `${i * 0.15}s` }} data-testid={`doctor-card-${doc._id}`}>
                  <div className="relative h-52 overflow-hidden bg-mc-bg">
                    <img src={doc.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=2C5545&color=fff&size=200`}
                      alt={doc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute bottom-3 left-3 bg-mc-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                      {doc.specialization}
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-heading text-lg text-mc-text font-600">{doc.name}</h3>
                    <p className="text-mc-text-secondary text-sm mt-1">{doc.qualification}</p>
                    <div className="flex items-center gap-4 mt-3 text-sm text-mc-text-secondary">
                      <span className="flex items-center gap-1"><Clock size={13} />{doc.experience_years} yrs exp</span>
                      <span className="flex items-center gap-1"><Star size={13} className="text-amber-400 fill-amber-400" />{doc.rating}</span>
                    </div>
                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-mc-border">
                      {(() => {
                        const fee = convertFee(doc.consultation_fee);
                        return (
                          <div>
                            <span className="font-heading text-mc-primary font-600">{fee.display}</span>
                            {fee.isInternational && (
                              <p className="text-[10px] text-mc-text-secondary mt-0.5">₹{doc.consultation_fee?.toLocaleString()} + {fee.markupPct}% intl.</p>
                            )}
                          </div>
                        );
                      })()}
                      <Link to={`/doctors/${doc._id}`} className="btn-primary text-sm px-4 py-2" data-testid={`book-doctor-${doc._id}`}>
                        Book Now
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      <section className="py-24 bg-mc-bg" data-testid="features-section">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] font-medium text-mc-secondary mb-3">Why Us</p>
              <h2 className="font-heading text-4xl lg:text-5xl text-mc-text font-700 mb-6">Healthcare Made Simple & Trustworthy</h2>
              <p className="text-mc-text-secondary leading-relaxed mb-8">We combine technology with compassionate care to give you access to the best medical professionals from the comfort of your home.</p>
              <div className="space-y-4">
                {['All doctors verified with credentials & licences', 'Secure PhonePe payments with instant confirmation', 'Book appointments 24/7, get confirmations instantly', 'Detailed appointment history & health records'].map((f, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <CheckCircle size={20} className="text-mc-primary flex-shrink-0" />
                    <span className="text-mc-text-secondary text-sm">{f}</span>
                  </div>
                ))}
              </div>
              <Link to="/doctors" className="inline-flex items-center gap-2 btn-primary mt-8" data-testid="features-cta-btn">
                Find a Doctor <ArrowRight size={16} />
              </Link>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/7579831/pexels-photo-7579831.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                alt="Doctor consultation"
                className="rounded-2xl shadow-2xl w-full h-[420px] object-cover"
              />
              <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl p-4 shadow-xl border border-mc-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                    <CheckCircle size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-heading font-600 text-mc-text">Appointment Confirmed!</p>
                    <p className="text-xs text-mc-text-secondary">Payment received securely</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-mc-primary" data-testid="cta-section">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="font-heading text-4xl lg:text-5xl text-white font-700 mb-4">Ready to Consult a Specialist?</h2>
          <p className="text-white/80 text-lg mb-10">Join thousands of patients who trust MediConsult for their healthcare needs.</p>
          <div className="flex flex-wrap justify-center gap-4">
            {!user && (
              <Link to="/register" className="bg-white text-mc-primary font-medium rounded-full px-8 py-4 hover:bg-mc-bg transition-all hover:-translate-y-0.5 shadow-lg" data-testid="cta-register-btn">
                Create Free Account
              </Link>
            )}
            <Link to="/doctors" className="border-2 border-white/40 text-white font-medium rounded-full px-8 py-4 hover:bg-white/10 transition-all" data-testid="cta-find-doctor-btn">
              Browse Doctors
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-mc-text py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-mc-primary rounded-lg flex items-center justify-center">
                <Stethoscope size={16} className="text-white" />
              </div>
              <span className="font-heading text-lg text-white">MediConsult</span>
            </div>
            <p className="text-white/50 text-sm font-body">© 2025 MediConsult. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-white/50 font-body">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
