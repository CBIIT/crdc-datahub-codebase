import React, { FC, useMemo } from "react";
import {
  MemoryRouterProps,
  createMemoryRouter,
  RouterProvider,
  RouteObject,
} from "react-router-dom";

/**
 * A MemoryRouter wrapper that includes React Router v7 future flags
 * to prevent deprecation warnings in tests.
 *
 * This component provides the same API as MemoryRouter but uses createMemoryRouter
 * under the hood to enable future flags.
 */
export const TestRouter: FC<MemoryRouterProps> = ({
  children,
  initialEntries = ["/"],
  initialIndex,
}) => {
  const router = useMemo(() => {
    const routes: RouteObject[] = [
      {
        path: "*",
        element: children,
      },
    ];

    return createMemoryRouter(routes, {
      initialEntries,
      initialIndex,
      future: {
        v7_relativeSplatPath: true,
      },
    });
  }, [children, initialEntries, initialIndex]);

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
};
