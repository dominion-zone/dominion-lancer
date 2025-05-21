import {
  createRouter as createTanstackSolidRouter,
  Link,
} from "@tanstack/solid-router";
import { routeTree } from "./routeTree.gen";

export function createRouter() {
  const router = createTanstackSolidRouter({
    defaultErrorComponent: (err) => <main>{err.error.stack}</main>,
    defaultNotFoundComponent: () => {
      return (
        <main>
          <p>Not found!</p>
          <Link to="/" search={(s) => ({ network: s.network, user: s.user })}>
            Go home
          </Link>
        </main>
      );
    },
    routeTree,
    defaultPreload: "intent",
    defaultStaleTime: 5000,
    scrollRestoration: true,
    defaultOnCatch: (err) => {
      console.error(err);
    },
  });
  return router;
}

export const router = createRouter();

// Register things for typesafety
declare module "@tanstack/solid-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
