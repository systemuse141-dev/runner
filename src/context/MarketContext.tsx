import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { MarketAsset, MarketDataStatus } from '../types';
import { getMarkets } from '../api';
import { useVisibility } from '../lib/useVisibility';

interface MarketContextType {
  markets: MarketAsset[];
  selectedSymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  isLoading: boolean;
  dataStatus: MarketDataStatus;
  refreshMarkets: () => Promise<void>;
  lastUpdated: string;
  getAsset: (symbol: string) => MarketAsset | undefined;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [markets, setMarkets] = useState<MarketAsset[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [dataStatus, setDataStatus] = useState<MarketDataStatus>('LIVE');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const isVisible = useVisibility();

  const fetchMarketData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setIsLoading(true);
      const data = await getMarkets();
      setMarkets(data);
      setDataStatus('LIVE');
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.warn('Market fetch error:', err);
      setDataStatus('CACHED');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarketData(true);
  }, [fetchMarketData]);

  // Controlled polling: updates every 3 seconds only when window/tab is visible
  useEffect(() => {
    if (!isVisible) return;

    const interval = setInterval(() => {
      fetchMarketData(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [isVisible, fetchMarketData]);

  const getAsset = useCallback(
    (symbol: string) => {
      return markets.find(
        m => m.symbol === symbol || m.symbol === decodeURIComponent(symbol)
      );
    },
    [markets]
  );

  const refreshMarkets = useCallback(async () => {
    await fetchMarketData(false);
  }, [fetchMarketData]);

  return (
    <MarketContext.Provider
      value={{
        markets,
        selectedSymbol,
        setSelectedSymbol,
        isLoading,
        dataStatus,
        refreshMarkets,
        lastUpdated,
        getAsset,
      }}
    >
      {children}
    </MarketContext.Provider>
  );
};

export function useMarket() {
  const context = useContext(MarketContext);
  if (!context) {
    throw new Error('useMarket must be used within a MarketProvider');
  }
  return context;
}
