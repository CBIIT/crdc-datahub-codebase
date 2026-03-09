import { useQuery } from "@apollo/client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  styled,
  Typography,
  Unstable_Grid2 as Grid2,
} from "@mui/material";
import { cloneDeep, flatMap, isEqual, uniq } from "lodash";
import { useSnackbar } from "notistack";
import { FC, memo, useEffect, useMemo, useRef } from "react";
import { useFormContext } from "react-hook-form";

import { useLocalStorage } from "@/hooks/useLocalStorage";

import {
  EditUserInput,
  RetrievePBACDefaultsResp,
  RetrievePBACDefaultsInput,
  RETRIEVE_PBAC_DEFAULTS,
  GetTooltipsResp,
  GetTooltipsInput,
  GET_TOOLTIPS,
} from "../../graphql";
import { ColumnizedPBACGroups, columnizePBACGroups, Logger } from "../../utils";
import StyledTooltip from "../StyledFormComponents/StyledTooltip";

const StyledBox = styled(Box)({
  width: "957px",
  transform: "translateX(-50%)",
  marginLeft: "50%",
  marginTop: "63px",
});

const StyledAccordion = styled(Accordion)({
  width: "100%",
});

const StyledAccordionSummary = styled(AccordionSummary)({
  borderBottom: "1px solid #6B7294",
  minHeight: "unset !important",
  "& .MuiAccordionSummary-content": {
    margin: "9px 0",
  },
  "& .MuiAccordionSummary-content.Mui-expanded": {
    margin: "9px 0",
  },
  "& .MuiAccordionSummary-expandIconWrapper": {
    color: "#356AAD",
  },
});

const StyledAccordionHeader = styled(Typography)<{ component: React.ElementType }>({
  fontWeight: 700,
  fontSize: "16px",
  lineHeight: "19px",
  color: "#356AAD",
});

const StyledGroupTitle = styled(Typography)({
  fontWeight: 600,
  fontSize: "13px",
  lineHeight: "20px",
  color: "#187A90",
  textTransform: "uppercase",
  marginBottom: "7.5px",
  marginTop: "13.5px",
  userSelect: "none",
});

const StyledFormControlLabel = styled(FormControlLabel)({
  whiteSpace: "nowrap",
  userSelect: "none",
  "& .MuiTypography-root": {
    fontWeight: 400,
    fontSize: "16px",
    color: "#083A50 !important",
  },
  "& .MuiCheckbox-root": {
    paddingTop: "5.5px",
    paddingBottom: "5.5px",
    color: "#005EA2 !important",
  },
  "& .MuiTypography-root.Mui-disabled, & .MuiCheckbox-root.Mui-disabled": {
    opacity: 0.6,
    cursor: "not-allowed !important",
  },
});

const StyledNotice = styled(Typography)({
  marginTop: "29.5px",
  textAlign: "center",
  width: "100%",
  color: "#6B7294",
  userSelect: "none",
});

export type PermissionPanelProps = {
  /**
   * A flag indicating whether the panel is explicitly read-only.
   *
   * Defaults to false.
   */
  readOnly?: boolean;
};

/**
 * Provides a panel for managing permissions and notifications for a user role.
 *
 * @returns The PermissionPanel component.
 */
const PermissionPanel: FC<PermissionPanelProps> = ({ readOnly = false }) => {
  const { enqueueSnackbar } = useSnackbar();
  const { setValue, watch } = useFormContext<EditUserInput>();

  const [storedTooltips, setStoredTooltips] = useLocalStorage<GetTooltipsResp["getTooltips"]>(
    "profile-tooltips",
    []
  );

  const { data, loading } = useQuery<RetrievePBACDefaultsResp, RetrievePBACDefaultsInput>(
    RETRIEVE_PBAC_DEFAULTS,
    {
      variables: { roles: ["All"] },
      context: { clientName: "backend" },
      fetchPolicy: "cache-first",
      onError: (error) => {
        Logger.error("Failed to retrieve PBAC defaults", { error });
        enqueueSnackbar("Failed to retrieve PBAC defaults", { variant: "error" });
      },
    }
  );

  useQuery<GetTooltipsResp, GetTooltipsInput>(GET_TOOLTIPS, {
    context: { clientName: "backend" },
    fetchPolicy: "cache-first",
    onCompleted: (data) => {
      if (!data?.getTooltips) {
        return;
      }

      setStoredTooltips(data.getTooltips.map((t) => ({ key: t.key, value: t.value })));
    },
    onError: (error) => {
      Logger.error("Failed to retrieve PBAC tooltips", { error });
      enqueueSnackbar("Failed to retrieve PBAC tooltips", { variant: "error" });
    },
    skip: storedTooltips?.length > 0,
  });

  const selectedRole = watch("role");
  const permissionsValue = watch("permissions");
  const notificationsValue = watch("notifications");
  const roleRef = useRef<UserRole>(selectedRole);

  const [permissionCount, permissionColumns] = useMemo<
    [number, ColumnizedPBACGroups<AuthPermissions>]
  >(() => {
    if (!data?.retrievePBACDefaults && loading) {
      return [0, []];
    }

    const defaults = data?.retrievePBACDefaults?.find((pbac) => pbac.role === selectedRole);
    if (!defaults || !defaults?.permissions) {
      Logger.error("Role not found in PBAC defaults", { role: selectedRole, data });
      return [0, []];
    }

    const clonedPermissions = cloneDeep(defaults.permissions);
    const checkedPermissions = clonedPermissions?.filter((p) => permissionsValue?.includes(p._id));
    const inheritedPermissions = uniq(flatMap(checkedPermissions, (p) => p.inherited || []));

    const remappedPermissions: PBACDefault<AuthPermissions>[] = clonedPermissions.map((p) => ({
      ...p,
      // NOTE: Inherited permissions are explicitly checked here to handle the initial loading state
      // when the permission may not have been checked yet.
      checked: permissionsValue?.includes(p._id) || inheritedPermissions.includes(p._id),
      disabled: p.disabled || inheritedPermissions.includes(p._id),
    }));

    return [
      remappedPermissions.filter((p) => p.checked).length,
      columnizePBACGroups(remappedPermissions, 3),
    ];
  }, [data, permissionsValue]);

  const [notificationCount, notificationColumns] = useMemo<
    [number, ColumnizedPBACGroups<AuthNotifications>]
  >(() => {
    if (!data?.retrievePBACDefaults && loading) {
      return [0, []];
    }

    const defaults = data?.retrievePBACDefaults?.find((pbac) => pbac.role === selectedRole);
    if (!defaults || !defaults?.notifications) {
      Logger.error("Role not found in PBAC defaults", { role: selectedRole, data });
      return [0, []];
    }

    const clonedNotifications = cloneDeep(defaults.notifications);
    const checkedNotifications = clonedNotifications?.filter(
      (p) => notificationsValue?.includes(p._id)
    );
    const inheritedNotifications = uniq(flatMap(checkedNotifications, (p) => p.inherited || []));

    const remappedNotifications: PBACDefault<AuthNotifications>[] = clonedNotifications.map(
      (n) => ({
        ...n,
        // NOTE: Inherited notifications are explicitly checked here to handle the initial loading state
        // when the notification may not have been checked yet.
        checked: notificationsValue?.includes(n._id) || inheritedNotifications.includes(n._id),
        disabled: n.disabled || inheritedNotifications.includes(n._id),
      })
    );

    return [
      remappedNotifications.filter((p) => p.checked).length,
      columnizePBACGroups(remappedNotifications, 3),
    ];
  }, [data, notificationsValue]);

  const handlePermissionChange = (_id: AuthPermissions) => {
    if (permissionsValue.includes(_id)) {
      setValue(
        "permissions",
        permissionsValue.filter((p) => p !== _id)
      );
    } else {
      setValue("permissions", [...permissionsValue, _id]);
    }
  };

  const handleNotificationChange = (_id: AuthNotifications) => {
    if (notificationsValue.includes(_id)) {
      setValue(
        "notifications",
        notificationsValue.filter((n) => n !== _id)
      );
    } else {
      setValue("notifications", [...notificationsValue, _id]);
    }
  };

  const handleRoleChange = (selectedRole: UserRole) => {
    if (selectedRole === roleRef.current) {
      return;
    }

    const defaults = data?.retrievePBACDefaults?.find((pbac) => pbac.role === selectedRole);
    setValue("permissions", defaults?.permissions?.filter((p) => p.checked).map((p) => p._id));
    setValue("notifications", defaults?.notifications?.filter((n) => n.checked).map((n) => n._id));
    roleRef.current = selectedRole;
  };

  useEffect(() => {
    handleRoleChange(selectedRole);
  }, [selectedRole]);

  useEffect(() => {
    if (readOnly) {
      return;
    }

    const checkedPermissions = data?.retrievePBACDefaults
      ?.find((pbac) => pbac.role === selectedRole)
      ?.permissions?.filter((p) => permissionsValue.includes(p._id));

    // Find any inherited permissions that are not already checked and add them to the new value
    const uncheckedInheritedPermissions =
      uniq(flatMap(checkedPermissions, (p) => p.inherited || [])).filter(
        (p) => !permissionsValue.includes(p)
      ) || [];

    if (uncheckedInheritedPermissions.length) {
      setValue("permissions", [...permissionsValue, ...uncheckedInheritedPermissions]);
    }
  }, [permissionsValue]);

  useEffect(() => {
    if (readOnly) {
      return;
    }

    const checkedNotifications = data?.retrievePBACDefaults
      ?.find((pbac) => pbac.role === selectedRole)
      ?.notifications?.filter((n) => notificationsValue.includes(n._id));

    // Find any inherited notifications that are not already checked and add them to the new value
    const uncheckedInheritedNotifications =
      uniq(flatMap(checkedNotifications, (n) => n.inherited || [])).filter(
        (n) => !notificationsValue.includes(n)
      ) || [];

    if (uncheckedInheritedNotifications.length) {
      setValue("notifications", [...notificationsValue, ...uncheckedInheritedNotifications]);
    }
  }, [notificationsValue]);

  const getTooltip = (_id: string) => {
    if (!_id || !storedTooltips?.length) {
      return null;
    }

    const baseKey = _id.split(":", 2)?.join(":");
    return storedTooltips.find((t) => t.key === baseKey)?.value || null;
  };

  return (
    <StyledBox>
      <StyledAccordion elevation={0} data-testid="permissions-accordion">
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <StyledAccordionHeader component="span">
            Permissions <span data-testid="permissions-count">({permissionCount})</span>
          </StyledAccordionHeader>
        </StyledAccordionSummary>
        <AccordionDetails>
          <Grid2 container spacing={2}>
            {permissionColumns.map((column, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Grid2 xs={4} key={index} data-testid={`permissions-column-${index}`}>
                {column.map(({ name, data }) => (
                  <div key={name} data-testid={`permissions-group-${name}`}>
                    <StyledGroupTitle>{name}</StyledGroupTitle>
                    <FormGroup>
                      {data.map(({ _id, checked, disabled, name }) => (
                        <StyledFormControlLabel
                          key={_id}
                          label={
                            <StyledTooltip
                              key={_id}
                              title={getTooltip(_id)}
                              placement="top"
                              data-testid="permission-tooltip"
                              disableInteractive
                              arrow
                            >
                              <span data-testid={`permission-${_id}-label`}>{name}</span>
                            </StyledTooltip>
                          }
                          onChange={() => handlePermissionChange(_id)}
                          control={<Checkbox name={_id} checked={checked} />}
                          data-testid={`permission-${_id}`}
                          disabled={readOnly || disabled}
                        />
                      ))}
                    </FormGroup>
                  </div>
                ))}
              </Grid2>
            ))}
            {permissionColumns.length === 0 && (
              <StyledNotice variant="body1" data-testid="no-permissions-notice">
                No permission options found for this role.
              </StyledNotice>
            )}
          </Grid2>
        </AccordionDetails>
      </StyledAccordion>
      <StyledAccordion elevation={0} data-testid="notifications-accordion">
        <StyledAccordionSummary expandIcon={<ExpandMoreIcon />}>
          <StyledAccordionHeader component="span">
            Email Notifications <span data-testid="notifications-count">({notificationCount})</span>
          </StyledAccordionHeader>
        </StyledAccordionSummary>
        <AccordionDetails>
          <Grid2 container spacing={2}>
            {notificationColumns.map((column, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <Grid2 xs={4} key={index} data-testid={`notifications-column-${index}`}>
                {column.map(({ name, data }) => (
                  <div key={name} data-testid={`notifications-group-${name}`}>
                    <StyledGroupTitle>{name}</StyledGroupTitle>
                    <FormGroup>
                      {data.map(({ _id, checked, disabled, name }) => (
                        <StyledFormControlLabel
                          key={_id}
                          label={
                            <StyledTooltip
                              key={_id}
                              title={getTooltip(_id)}
                              placement="top"
                              data-testid="notification-tooltip"
                              disableInteractive
                              arrow
                            >
                              <span data-testid={`notification-${_id}-label`}>{name}</span>
                            </StyledTooltip>
                          }
                          onChange={() => handleNotificationChange(_id)}
                          control={<Checkbox name={_id} checked={checked} />}
                          data-testid={`notification-${_id}`}
                          disabled={readOnly || disabled}
                        />
                      ))}
                    </FormGroup>
                  </div>
                ))}
              </Grid2>
            ))}
            {notificationColumns.length === 0 && (
              <StyledNotice variant="body1" data-testid="no-notifications-notice">
                No notification options found for this role.
              </StyledNotice>
            )}
          </Grid2>
        </AccordionDetails>
      </StyledAccordion>
    </StyledBox>
  );
};

export default memo<PermissionPanelProps>(PermissionPanel, isEqual);
