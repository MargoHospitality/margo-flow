import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Auth from "./pages/Auth";
import Backoffice from "./pages/Backoffice";
import BackofficeArrivalDetail from "./pages/BackofficeArrivalDetail";
import BackofficeArrivals from "./pages/BackofficeArrivals";
import BackofficeHome from "./pages/BackofficeHome";
import BackofficePayments from "./pages/BackofficePayments";
import BackofficeReviews from "./pages/BackofficeReviews";
import Confirmation from "./pages/Confirmation";
import PaymentCheckoutStatus from "./pages/PaymentCheckoutStatus";
import Token from "./pages/Token";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/backoffice" element={<BackofficeHome />} />
          <Route path="/backoffice/arrivals/:reservationId" element={<BackofficeArrivalDetail />} />
          <Route path="/backoffice/transport" element={<Backoffice />} />
          <Route path="/backoffice/payments" element={<BackofficePayments />} />
          <Route path="/backoffice/reviews" element={<BackofficeReviews />} />
          <Route path="/payment/checkout-status" element={<PaymentCheckoutStatus />} />
          <Route path="/confirmation/:token" element={<Confirmation />} />
          <Route path="/token/:token" element={<Token />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
