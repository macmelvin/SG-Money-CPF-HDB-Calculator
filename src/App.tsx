import { HashRouter, BrowserRouter, Routes, Route } from "react-router-dom";
import type { ReactNode } from "react";
import Home from "./calculators/Home";
import SalaryCalculator from "./calculators/SalaryCalculator";
import HdbSaleCalculator from "./calculators/HdbSaleCalculator";
import AccruedInterestCalculator from "./calculators/AccruedInterestCalculator";
import RetirementCalculator from "./calculators/RetirementCalculator";
import CarCostCalculator from "./calculators/CarCostCalculator";
import PropertyListings from "./calculators/PropertyListings";
import BackupRestore from "./calculators/BackupRestore";
import GeoArbitrageCalculator from "./calculators/GeoArbitrageCalculator";
import "./App.css";

// Two build targets need two different routers:
//
// - Web/PWA build (`npm run build`): uses BrowserRouter so each calculator gets
//   a real, clean, indexable URL (sgmoney.sg/hdb-sale-proceeds) instead of a
//   hash fragment. This matters for SEO — Google treats hash-routed SPAs as a
//   single page, which defeats the "one calculator = one search result" goal.
// - Capacitor/Android build (`npm run build:capacitor`): uses HashRouter,
//   because the app is served from a local file/asset root inside the WebView
//   where there's no server to fall back to index.html on a deep link/refresh
//   — a plain BrowserRouter would break navigation there.
//
// The target is selected via VITE_BUILD_TARGET at build time (see package.json).
const isCapacitorBuild = import.meta.env.VITE_BUILD_TARGET === "capacitor";
const Router = isCapacitorBuild ? HashRouter : BrowserRouter;

function AppRouter({ children }: { children: ReactNode }) {
  return <Router>{children}</Router>;
}

function App() {
  return (
    <AppRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/salary-calculator" element={<SalaryCalculator />} />
          <Route path="/hdb-sale-proceeds" element={<HdbSaleCalculator />} />
          <Route path="/cpf-accrued-interest" element={<AccruedInterestCalculator />} />
          <Route path="/retirement-calculator" element={<RetirementCalculator />} />
          <Route path="/geo-arbitrage" element={<GeoArbitrageCalculator />} />
          <Route path="/car-cost-calculator" element={<CarCostCalculator />} />
          <Route path="/property-listings" element={<PropertyListings />} />
          <Route path="/backup" element={<BackupRestore />} />
        </Routes>
      </div>
    </AppRouter>
  );
}

export default App;
