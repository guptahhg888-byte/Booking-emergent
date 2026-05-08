import React, { createContext, useState, useContext, useEffect } from 'react';

// Country-based pricing config
// feeMultiplier: multiplier applied to base INR fee for country-specific pricing
// rate: exchange rate from INR to local currency (for display)
export const COUNTRY_CONFIG = {
  IN: { currency: 'INR', symbol: '₹',   rate: 1,       feeMultiplier: 1.0,   flag: '🇮🇳', name: 'India' },
  US: { currency: 'USD', symbol: '$',   rate: 0.012,   feeMultiplier: 2.5,   flag: '🇺🇸', name: 'USA' },
  GB: { currency: 'GBP', symbol: '£',   rate: 0.0095,  feeMultiplier: 2.5,   flag: '🇬🇧', name: 'UK' },
  DE: { currency: 'EUR', symbol: '€',   rate: 0.011,   feeMultiplier: 2.25,  flag: '🇩🇪', name: 'Germany' },
  FR: { currency: 'EUR', symbol: '€',   rate: 0.011,   feeMultiplier: 2.25,  flag: '🇫🇷', name: 'France' },
  AE: { currency: 'AED', symbol: 'د.إ', rate: 0.044,   feeMultiplier: 2.0,   flag: '🇦🇪', name: 'UAE' },
  AU: { currency: 'AUD', symbol: 'A$',  rate: 0.018,   feeMultiplier: 2.25,  flag: '🇦🇺', name: 'Australia' },
  CA: { currency: 'CAD', symbol: 'C$',  rate: 0.016,   feeMultiplier: 2.25,  flag: '🇨🇦', name: 'Canada' },
  SG: { currency: 'SGD', symbol: 'S$',  rate: 0.016,   feeMultiplier: 2.25,  flag: '🇸🇬', name: 'Singapore' },
  NZ: { currency: 'NZD', symbol: 'NZ$', rate: 0.020,   feeMultiplier: 2.0,   flag: '🇳🇿', name: 'New Zealand' },
  JP: { currency: 'JPY', symbol: '¥',   rate: 1.80,    feeMultiplier: 2.0,   flag: '🇯🇵', name: 'Japan' },
  KR: { currency: 'KRW', symbol: '₩',   rate: 16.2,    feeMultiplier: 1.75,  flag: '🇰🇷', name: 'South Korea' },
  MY: { currency: 'MYR', symbol: 'RM',  rate: 0.055,   feeMultiplier: 1.25,  flag: '🇲🇾', name: 'Malaysia' },
  PK: { currency: 'PKR', symbol: '₨',   rate: 3.35,    feeMultiplier: 1.25,  flag: '🇵🇰', name: 'Pakistan' },
  BD: { currency: 'BDT', symbol: '৳',   rate: 1.31,    feeMultiplier: 1.25,  flag: '🇧🇩', name: 'Bangladesh' },
  LK: { currency: 'LKR', symbol: 'Rs',  rate: 3.60,    feeMultiplier: 1.25,  flag: '🇱🇰', name: 'Sri Lanka' },
  SA: { currency: 'SAR', symbol: 'SR',  rate: 0.045,   feeMultiplier: 2.0,   flag: '🇸🇦', name: 'Saudi Arabia' },
  QA: { currency: 'QAR', symbol: 'QR',  rate: 0.044,   feeMultiplier: 2.0,   flag: '🇶🇦', name: 'Qatar' },
};

const DEFAULT_CONFIG = { currency: 'USD', symbol: '$', rate: 0.012, feeMultiplier: 2.5, flag: '🌐', name: 'International' };

const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const [detectedCode, setDetectedCode] = useState('IN');
  const [countryCode, setCountryCode] = useState('IN');
  const [config, setConfig] = useState(COUNTRY_CONFIG['IN']);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    fetch('https://ipapi.co/json/')
      .then(res => res.json())
      .then(data => {
        const code = data.country_code || 'IN';
        const cfg = COUNTRY_CONFIG[code] || DEFAULT_CONFIG;
        setDetectedCode(code);
        setCountryCode(code);
        setConfig(cfg);
      })
      .catch(() => {
        setDetectedCode('IN');
        setCountryCode('IN');
        setConfig(COUNTRY_CONFIG['IN']);
      })
      .finally(() => setDetecting(false));
  }, []);

  /** Switch country — restricted to admin/CRM usage */
  const switchCountry = (code) => {
    const cfg = COUNTRY_CONFIG[code] || DEFAULT_CONFIG;
    setCountryCode(code);
    setConfig(cfg);
  };

  /**
   * Get country-adjusted fee: applies feeMultiplier to the base INR fee.
   * Returns the actual INR amount to be charged for this country.
   */
  const getCountryFee = (baseINR) => {
    if (!baseINR && baseINR !== 0) return 0;
    return Math.round(baseINR * (config.feeMultiplier || 1));
  };

  /**
   * Convert an INR base fee to display format using country-based pricing.
   * Applies feeMultiplier first, then converts to local currency for display.
   * Returns: { display, displayINR, local, inr, chargeINR, isInternational, currency, multiplier }
   */
  const convertFee = (baseINR) => {
    if (!baseINR && baseINR !== 0) return { display: '—', local: 0, inr: 0, chargeINR: 0, isInternational: false };
    const isInternational = countryCode !== 'IN';
    const chargeINR = Math.round(baseINR * (config.feeMultiplier || 1));

    if (!isInternational) {
      return {
        display: `₹${chargeINR.toLocaleString('en-IN')}`,
        displayINR: `₹${chargeINR.toLocaleString('en-IN')}`,
        local: chargeINR,
        inr: baseINR,
        chargeINR,
        isInternational: false,
      };
    }
    const local = chargeINR * config.rate;
    const decimals = config.currency === 'JPY' || config.currency === 'KRW' ? 0 : 2;
    return {
      display: `${config.symbol}${local.toFixed(decimals)}`,
      displayINR: `₹${chargeINR.toLocaleString('en-IN')}`,
      local: parseFloat(local.toFixed(decimals)),
      inr: baseINR,
      chargeINR,
      isInternational: true,
      currency: config.currency,
      multiplier: config.feeMultiplier,
    };
  };

  return (
    <CurrencyContext.Provider value={{
      countryCode,
      detectedCode,
      config,
      detecting,
      convertFee,
      getCountryFee,
      switchCountry,
      COUNTRY_CONFIG,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
