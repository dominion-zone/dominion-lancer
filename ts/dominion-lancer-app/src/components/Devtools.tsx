import { TanStackRouterDevtools } from "@tanstack/solid-router-devtools";
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools'

const Devtools = () => {
  return (
    <>
      <TanStackRouterDevtools />
      <SolidQueryDevtools/>
    </>
  );
};

export default Devtools;
