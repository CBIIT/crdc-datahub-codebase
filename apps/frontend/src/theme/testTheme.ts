import { createTheme } from "@mui/material/styles";

const testTheme = createTheme({
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
        disableRipple: true,
        disableFocusRipple: true,
        disableTouchRipple: true,
      },
    },
    MuiTooltip: {
      defaultProps: {
        enterDelay: 0,
        leaveDelay: 0,
        TransitionProps: { timeout: 0 },
      },
    },
  },

  transitions: {
    create: () => "none",
    duration: {
      shortest: 0,
      shorter: 0,
      short: 0,
      standard: 0,
      complex: 0,
      enteringScreen: 0,
      leavingScreen: 0,
    },
  },
});

export default testTheme;
