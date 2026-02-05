# Z-Index Standards

This document defines the z-index standards for the CRDC Submission Portal to ensure consistent layering and avoid stacking context conflicts.

## Z-Index Scale

### Base Layer (0-99)

| Value | Use Case                 |
| ----- | ------------------------ |
| 0-99  | Local component stacking |

### UI Controls (100-999)

| Value | Use Case                      |
| ----- | ----------------------------- |
| 250   | Table loading overlay         |
| 300   | Column visibility popper      |
| 500   | Custom Backdrop               |
| 600   | Clear button for Select input |
| 700   | Dropdown menus                |
| 999   | Scroll button, timeline dots  |

### Material UI Defaults (1000-1500)

See [MUI z-index documentation](https://mui.com/material-ui/customization/z-index/)

| Value | Component       |
| ----- | --------------- |
| 1000  | Mobile Stepper  |
| 1050  | Fab, Speed Dial |
| 1100  | App Bar         |
| 1200  | Drawer          |
| 1300  | Modal           |
| 1400  | Snackbar        |
| 1500  | Tooltip         |

### Application-Specific

| Value | Use Case                            |
| ----- | ----------------------------------- |
| 1100  | Navbar                              |
| 1200  | Mobile header menu                  |
| 1400  | Alert notifications                 |
| 2000  | Full-screen loader (SuspenseLoader) |
