import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import PublicForm from "./pages/PublicForm";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import KartePage from "./pages/Karte";
import KarteDetail from "./pages/KarteDetail";
import Goals from "./pages/Goals";
import GoalsYearlyPage from "./pages/GoalsYearly";
import GoalsMonthlyPage from "./pages/GoalsMonthly";
import PlatformLogin from "./pages/PlatformLogin";
import PlatformTenants from "./pages/PlatformTenants";
import PlatformTenantDetail from "./pages/PlatformTenantDetail";
import StaffPage from "./pages/Staff";
import { AuthGuard } from "./lib/auth-context";
import { PlatformAuthGuard } from "./lib/platform-auth-context";

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/form/:slug" component={PublicForm} />
        <Route path="/dashboard">
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        </Route>
        <Route path="/customers">
          <AuthGuard>
            <Customers />
          </AuthGuard>
        </Route>
        <Route path="/customers/:recordId">
          <AuthGuard>
            <CustomerDetail />
          </AuthGuard>
        </Route>
        <Route path="/karte">
          <AuthGuard>
            <KartePage />
          </AuthGuard>
        </Route>
        <Route path="/karte/:recordId">
          <AuthGuard>
            <KarteDetail />
          </AuthGuard>
        </Route>
        <Route path="/goals">
          <AuthGuard>
            <Goals />
          </AuthGuard>
        </Route>
        <Route path="/goals/yearly">
          <AuthGuard>
            <GoalsYearlyPage />
          </AuthGuard>
        </Route>
        <Route path="/goals/monthly">
          <AuthGuard>
            <GoalsMonthlyPage />
          </AuthGuard>
        </Route>
        <Route path="/staff">
          <AuthGuard>
            <StaffPage />
          </AuthGuard>
        </Route>
        <Route path="/platform/login" component={PlatformLogin} />
        <Route path="/platform/tenants">
          <PlatformAuthGuard>
            <PlatformTenants />
          </PlatformAuthGuard>
        </Route>
        <Route path="/platform/tenants/:id">
          <PlatformAuthGuard>
            <PlatformTenantDetail />
          </PlatformAuthGuard>
        </Route>
        <Route>
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
              <p className="text-muted-foreground">ページが見つかりません</p>
              <a href="/" className="mt-4 inline-block text-primary hover:underline">トップページへ戻る</a>
            </div>
          </div>
        </Route>
      </Switch>
    </>
  );
}

export default App;
