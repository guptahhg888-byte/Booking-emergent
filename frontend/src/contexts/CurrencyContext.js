import React, { createContext, useState, useContext, useEffect } from 'react';

// Exchange rates relative to 1 INR (approx values)
// markup: additional % charged for international users
export const COUNTRY_CONFIG = {
  IN: { currency: 'INR', symbol: '₹',   rate: 1,       markup: 0,    flag: '🇮🇳', name: 'India' },
  US: { currency: 'USD', symbol: '$',   rate: 0.012,   markup: 0.20, flag: '🇺🇸', name: 'USA' },
  GB: { currency: 'GBP', symbol: '£',   rate: 0.0095,  markup: 0.20, flag: '🇬🇧', name: 'UK' },
  DE: { currency: 'EUR', symbol: '€',   rate: 0.011,   markup: 0.20, flag: '🇩🇪', name: 'Germany' },
  FR: { currency: 'EUR', symbol: '€',   rate: 0.011,   markup: 0.20, flag: '🇫🇷', name: 'France' },
  AE: { currency: 'AED', symbol: 'د.إ', rate: 0.044,   markup: 0.15, flag: '🇦🇪', name: 'UAE' },
  AU: { currency: 'AUD', symbol: 'A$',  rate: 0.018,   markup: 0.15, flag: '🇦🇺', name: 'Australia' },
  CA: { currency: 'CAD', symbol: 'C$',  rate: 0.016,   markup: 0.15, flag: '🇨🇦', name: 'Canada' },
  SG: { currency: 'SGD', symbol: 'S$',  rate: 0.016,   markup: 0.15, flag: '🇸🇬', name: 'Singapore' },
  NZ: { currency: 'NZD', symbol: 'NZ$', rate: 0.020,   markup: 0.15, flag: '🇳🇿', name: 'New Zealand' },
  JP: { currency: 'JPY', symbol: '¥',   rate: 1.80,    markup: 0.15, flag: '🇯🇵', name: 'Japan' },
  KR: { currency: 'KRW', symbol: '₩',   rate: 16.2,    markup: 0.15, flag: '🇰🇷', name: 'South Korea' },
  MY: { currency: 'MYR', symbol: 'RM',  rate: 0.055,   markup: 0.10, flag: '🇲🇾', name: 'Malaysia' },
  PK: { currency: 'PKR', symbol: '₨',   rate: 3.35,    markup: 0.10, flag: '🇵🇰', name: 'Pakistan' },
  BD: { currency: 'BDT', symbol: '৳',   rate: 1.31,    markup: 0.10, flag: '🇧🇩', name: 'Bangladesh' },
  LK: { currency: 'LKR', symbol: 'Rs',  rate: 3.60,    markup: 0.10, flag: '🇱🇰', name: 'Sri Lanka' },
  SA: { currency: 'SAR', symbol: 'SR',  rate: 0.045,   markup: 0.15, flag: '🇸🇦', name: 'Saudi Arabia' },
  QA: { currency: 'QAR', symbol: 'QR',  rate: 0.044,   markup: 0.15, flag: '🇶🇦', name: 'Qatar' },
};

const DEFAULT_CONFIG = { currency: 'USD', symbol: '$', rate: 0.012, markup: 0.20, flag: '🌐', name: 'International' };

const CurrencyContext = createContext(null);

export const CurrencyProvider = ({ children }) => {
  const [detectedCode, setDetectedCode] = useState('IN');
  const [countryCode, setCountryCode] = useState('IN');  // may be overridden by user
  const [config, setConfig] = useState(COUNTRY_CONFIG['IN']);
  const [detecting, setDetecting] = useState(true);

  useEffect(() => {
    // Try to detect location via IP — silent, no user permission needed
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

  /** Allow user to manually switch currency */
  const switchCountry = (code) => {
    const cfg = COUNTRY_CONFIG[code] || DEFAULT_CONFIG;
    setCountryCode(code);
    setConfig(cfg);
  };

  /**
   * Convert an INR amount to the user's selected currency.
   * Returns: { display, local, inr, isInternational, currency, markupPct }
   */
  const convertFee = (inrAmount) => {
    if (!inrAmount && inrAmount !== 0) return { display: '—', local: 0, inr: 0, isInternational: false };
    const isInternational = countryCode !== 'IN';
    if (!isInternational) {
      return {
        display: `₹${Number(inrAmount).toLocaleString('en-IN')}`,
        local: inrAmount,
        inr: inrAmount,
        isInternational: false,
      };
    }
    const local = inrAmount * config.rate * (1 + config.markup);
    const decimals = config.currency === 'JPY' || config.currency === 'KRW' ? 0 : 2;
    return {
      display: `${config.symbol}${local.toFixed(decimals)}`,
      local: parseFloat(local.toFixed(decimals)),
      inr: inrAmount,
      isInternational: true,
      currency: config.currency,
      markupPct: Math.round(config.markup * 100),
    };
  };

  return (
    <CurrencyContext.Provider value={{
      countryCode,
      detectedCode,
      config,
      detecting,
      convertFee,
      switchCountry,
      COUNTRY_CONFIG,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
