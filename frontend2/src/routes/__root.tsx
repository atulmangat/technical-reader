import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { IAuthContext } from "@/context/AuthContext";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
// import { TanStackRouterDevtools } from '@tanstack/router-devtools'

export interface IRouterContext {
  auth: IAuthContext;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<IRouterContext>()({
  component: () => (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
      <Toaster />
      {/* <TanStackRouterDevtools /> */}
    </div>
  ),
});
