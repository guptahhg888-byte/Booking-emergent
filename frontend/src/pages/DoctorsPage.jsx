import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Star, Clock, ChevronRight, Filter, Globe } from 'lucide-react';
import api from '../utils/api';
import { useCurrency } from '../contexts/CurrencyContext';

const DoctorsPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { convertFee, countryCode, config, detecting } = useCurrency();

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDoctors(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchDoctors = async (q) => {
    setLoading(true);
    try {
      const params = q ? { search: q } : {};
      const res = await api.get('/doctors', { params });
      setDoctors(res.data);
    } catch (err) {
      console.error('Failed to load doctors', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] bg-mc-bg">
      {/* Header */}
      <div className="bg-mc-primary py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm uppercase tracking-[0.2em] font-medium text-emerald-300 mb-3">Our Network</p>
          <h1 className="font-heading text-4xl lg:text-5xl text-white font-700 mb-4">Find Your Specialist</h1>
          <p className="text-white/70 mb-8">Browse our network of verified medical professionals</p>

          {/* Search */}
          <div className="max-w-2xl mx-auto relative">
            <Search size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-mc-text-secondary" />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or specialization..."
              className="w-full pl-14 pr-6 py-4 rounded-2xl border border-mc-border text-mc-text font-body text-sm bg-white focus:outline-none focus:ring-2 focus:ring-mc-secondary/30 shadow-lg"
              data-testid="doctor-search-input"
            />
          </div>
        </div>
      </div>

      {/* Doctors Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="w-10 h-10 border-4 border-mc-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : doctors.length === 0 ? (
          <div className="text-center py-20">
            <Filter size={48} className="mx-auto text-mc-border mb-4" />
            <h3 className="font-heading text-xl text-mc-text mb-2">No doctors found</h3>
            <p className="text-mc-text-secondary text-sm">Try adjusting your search terms</p>
            <button onClick={() => setSearch('')} className="mt-4 btn-primary text-sm px-6 py-2.5">Clear Search</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-mc-text-secondary text-sm font-body">
                Showing <span className="font-medium text-mc-text">{doctors.length}</span> doctors
              </p>
              {!detecting && countryCode !== 'IN' && (
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs px-3 py-1.5 rounded-full font-body">
                  <Globe size={12} />
                  Prices shown in {config.currency} ({config.flag} {countryCode})
                </div>
              )}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {doctors.map((doc, i) => (
                <div
                  key={doc._id}
                  className="bg-mc-surface border border-mc-border rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group"
                  style={{ animation: `fade-in 0.5s ease-out ${i * 0.05}s forwards`, opacity: 0 }}
                  data-testid={`doctor-card-${doc._id}`}
                >
                  <div className="h-48 overflow-hidden relative bg-mc-bg">
                    <img
                      src={doc.image_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(doc.name)}&background=2C5545&color=fff&size=200`}
                      alt={doc.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-1">
                      <Star size={12} className="text-amber-400 fill-amber-400" />
                      <span className="text-xs font-medium text-mc-text">{doc.rating}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="inline-block bg-mc-primary/10 text-mc-primary text-xs font-medium px-2.5 py-1 rounded-full mb-2">
                      {doc.specialization}
                    </div>
                    <h3 className="font-heading text-base text-mc-text font-600 leading-tight">{doc.name}</h3>
                    <p className="text-mc-text-secondary text-xs mt-1 truncate">{doc.qualification}</p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-mc-text-secondary">
                      <span className="flex items-center gap-1"><Clock size={11} />{doc.experience_years} yrs</span>
                      <span className="text-mc-border">•</span>
                      <span>{doc.total_reviews} reviews</span>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-mc-border">
                      <div>
                        <p className="text-xs text-mc-text-secondary">Consult Fee</p>
                        {(() => {
                          const servicePrices = doc.services?.map(service => Number(service.price)).filter(price => !Number.isNaN(price)) || [];
                          const basePrice = servicePrices.length ? Math.min(...servicePrices) : doc.consultation_fee;
                          const fee = convertFee(basePrice);
                          return (
                            <>
                              <p className="font-heading text-mc-primary font-600">{servicePrices.length ? `From ${fee.display}` : fee.display}</p>
                              {fee.isInternational && (
                                <p className="text-[10px] text-mc-text-secondary mt-0.5">{fee.displayINR} INR</p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <Link
                        to={`/doctors/${doc._id}`}
                        className="flex items-center gap-1 bg-mc-primary text-white text-xs font-medium rounded-full px-4 py-2 hover:bg-mc-primary-hover transition-all hover:-translate-y-0.5"
                        data-testid={`book-doctor-${doc._id}`}
                      >
                        Book <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DoctorsPage;
