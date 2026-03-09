import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import {
  Dialog,
  DialogContent,
  DialogContentText,
  Button,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  DialogActions,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import React, { useEffect, useState } from "react";

import text from "./OverlayText";

const theme = createTheme({
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          width: "770px",
          height: "620px",
          borderRadius: "5px !important",
          backgroundColor: "#ffffff !important",
          padding: "0px 20px 0px 20px !important",
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontSize: "14px !important",
          color: "#000000",
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: "15px 15px 15px 0 !important",
          fontSize: "22px !important",
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          color: "#000045",
          "& p": {
            fontSize: "14px",
            margin: "0px 0px 10px !important",
          },
          padding: "20px 0px 0px 0px !important",
          "& ul": {
            marginTop: "0px",
            paddingTop: "0px",
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          width: "133px",
          height: "35px",
          backgroundColor: "#337ab7 !important",
          color: "#fff",
          textTransform: "capitalize !important" as "capitalize",
          boxShadow: "none !important",
          "&:hover": {
            backgroundColor: "#2e6da4 !important",
          },
        },
      },
    },
    MuiList: {
      styleOverrides: {
        root: {
          marginTop: "-15px !important",
          fontSize: "14px",
        },
        padding: {
          paddingTop: "0px !important",
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          fontSize: "14px",
          padding: "2px 0px 0px 25px !important",
        },
        gutters: {
          paddingTop: "4px",
          paddingRight: "8px",
          paddingBottom: "4px",
          paddingLeft: "35px",
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          marginBottom: "auto",
          fontSize: "12px",
          color: "black",
          width: "10px",
          minWidth: "2px",
          paddingTop: "10px",
          marginRight: "4px",
        },
      },
    },
    MuiDialogContentText: {
      styleOverrides: {
        root: {
          color: "#000000",
          marginBottom: "10px",
          "& p.lastChild": {
            marginBottom: "0px",
          },
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: "#00000047",
        },
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: {
          height: "75px",
          justifyContent: "right !important",
          padding: "30px 10px 25px 0px !important",
        },
      },
    },
  },
});

const OverlayWindow = () => {
  const [open, setOpen] = useState(false);

  const handleClose = () => {
    setOpen(false);
    sessionStorage.setItem("overlayLoad", "true");
  };

  useEffect(() => {
    if (!sessionStorage.length) {
      setOpen(true);
    }
  }, [open]);

  const content = text.content.map((item, index) => {
    const textKey = `key_${index}`;
    return (
      <DialogContentText key={textKey} id="alert-dialog-description">
        {item}
      </DialogContentText>
    );
  });
  const list = text.list.map((item, index) => {
    const listKey = `key_${index}`;
    return (
      <ListItem key={listKey}>
        <ListItemIcon>
          <FiberManualRecordIcon style={{ fontSize: 8 }} />
        </ListItemIcon>
        <ListItemText>{item}</ListItemText>
      </ListItem>
    );
  });

  return (
    <ThemeProvider theme={theme}>
      <Dialog
        open={open}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        data-testid="system-use-warning-dialog"
        maxWidth="md"
      >
        <DialogTitle id="alert-dialog-title">Warning</DialogTitle>
        <Divider />
        <DialogContent>
          {content}
          <List>{list}</List>
        </DialogContent>
        <Divider />
        <DialogActions>
          <Button onClick={handleClose} variant="contained">
            Continue
          </Button>
        </DialogActions>
      </Dialog>
    </ThemeProvider>
  );
};

export default OverlayWindow;
