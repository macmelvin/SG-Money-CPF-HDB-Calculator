import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./calculators/Home";
import SalaryCalculator from "./calculators/SalaryCalculator";
import HdbSaleCalculator from "./calculators/HdbSaleCalculator";
import AccruedInterestCalculator from "./calculators/AccruedInterestCalculator";
import RetirementCalculator from "./calculators/RetirementCalculator";
import CarCostCalculator from "./calculators/CarCostCalculator";
import "./App.css";

// HashRouter is used so the app works both as a static PWA build and inside
// the Capacitor Android WebView (which serves from a local file/asset root
// where a plain BrowserRouter would break deep links on refresh).
function App() {
  return (
    <HashRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/salary-calculator" element={<SalaryCalculator />} />
          <Route path="/hdb-sale-proceeds" element={<HdbSaleCalculator />} />
          <Route path="/cpf-accrued-interest" element={<AccruedInterestCalculator />} />
          <Route path="/retirement-calculator" element={<RetirementCalculator />} />
          <Route path="/car-cost-calculator" element={<CarCostCalculator />} />
        </Routes>
      </div>
    </HashRouter>
  );
}

export default App;
