import { useParams, Navigate } from 'react-router-dom'
import ZerodhaOverviewPage from './ZerodhaOverviewPage'
import ZerodhaStocksPage  from './ZerodhaStocksPage'
import MutualFundsPage    from './MutualFundsPage'
import GoldPage           from './GoldPage'
import AionionOverviewPage from './AionionOverviewPage'
import AionionStocksPage  from './AionionStocksPage'
import AionionGoldPage    from './AionionGoldPage'
import FdPage             from './FdPage'
import EfPage             from './EfPage'
import CashPage           from './CashPage'
import BondsPage          from './BondsPage'
import ForeignStocksPage  from './ForeignStocksPage'
import CryptoPage         from './CryptoPage'
import AmcMfPage          from './AmcMfPage'
import AssetsOverviewPage  from './AssetsOverviewPage'

const PAGE_MAP: Record<string, React.ComponentType> = {
  'zerodha':        ZerodhaOverviewPage,
  'zerodha-stocks': ZerodhaStocksPage,
  'mutual-funds':   MutualFundsPage,
  'gold':           GoldPage,
  'aionion':        AionionOverviewPage,
  'aionion-stocks': AionionStocksPage,
  'aionion-gold':   AionionGoldPage,
  'fd':             FdPage,
  'ef':             EfPage,
  'cash':           CashPage,
  'bonds':          BondsPage,
  'foreign-stocks': ForeignStocksPage,
  'crypto':         CryptoPage,
  'amc-mf':         AmcMfPage,
  'overview':        AssetsOverviewPage,
}

export default function AssetsPage() {
  const { assetClass } = useParams<{ assetClass: string }>()
  if (!assetClass) return <Navigate to="/assets/overview" replace />

  const Page = PAGE_MAP[assetClass]
  if (!Page) return <Navigate to="/assets/zerodha-stocks" replace />

  return (
    <div className="animate-fade-in">
      <Page />
    </div>
  )
}
