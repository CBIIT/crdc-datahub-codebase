import { useQuery } from "@apollo/client";
import { FC, memo } from "react";
import { Outlet } from "react-router-dom";

import MaintenancePage from "../../content/status/MaintenancePage";
import { IS_MAINTENANCE_MODE, IsMaintenanceModeResponse } from "../../graphql/isMaintenanceMode";
import { Logger } from "../../utils";

export type MaintenanceGateProps = {
  children?: React.ReactNode;
};

/**
 * Provides a rendering gateway for toggling maintenance mode.
 * If the application is in maintenance mode, it will replace the current route with the maintenance page.
 * Otherwise, it will render the children or the Outlet component.
 *
 * @returns The maintenance gate component.
 */
const MaintenanceGate: FC<MaintenanceGateProps> = ({ children }) => {
  const { data } = useQuery<IsMaintenanceModeResponse>(IS_MAINTENANCE_MODE, {
    fetchPolicy: "cache-and-network",
    onError: (error) => {
      Logger.error("Unable to fetch maintenance mode. Assuming disabled.", error);
    },
  });

  if (data?.isMaintenanceMode === true) {
    return <MaintenancePage />;
  }

  return children || <Outlet />;
};

export default memo<MaintenanceGateProps>(MaintenanceGate);
