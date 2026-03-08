import { useQuery } from '@tanstack/react-query'
import { fetchNsePrices, fetchYahooPrices, fetchFxRates, type PriceMap } from '../services/priceService'

/** NSE live prices for an array of instruments (e.g. "RELIANCE", "TCS") */
export function useNsePrices(instruments: string[], enabled = true) {
  return useQuery<PriceMap>({
    queryKey: ['nse-prices', instruments.join(',')],
    queryFn:  () => fetchNsePrices(instruments),
    enabled:  enabled && instruments.length > 0,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/** Yahoo Finance prices for fully-qualified symbols (e.g. "GOLDBEES.NS", "BTC-GBP") */
export function useYahooPrices(symbols: string[], enabled = true) {
  return useQuery<PriceMap>({
    queryKey: ['yahoo-prices', symbols.join(',')],
    queryFn:  () => fetchYahooPrices(symbols),
    enabled:  enabled && symbols.length > 0,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/** FX rates: GBP/USD and USD/INR */
export function useFxRates(enabled = true) {
  return useQuery({
    queryKey: ['fx-rates'],
    queryFn:  fetchFxRates,
    enabled,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  })
}
