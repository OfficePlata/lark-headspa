import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import Home from "./pages/Home";
import PublicForm from "./pages/PublicForm";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <>
      <Toaster position="top-center" richColors />
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/form/:slug" component={PublicForm} />
        <Route path="/dashboard" component={Dashboard} />
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
