import { Button, Dialog, DialogTitle, styled } from "@mui/material";
import { useSnackbar } from "notistack";
import React, { useState, useEffect, FC } from "react";
import { useNavigate } from "react-router-dom";

import CloseIcon from "../../assets/icons/close_icon.svg?url";
import { Logger, secondsToMinuteString } from "../../utils";
import { useAuthContext } from "../Contexts/AuthContext";

const InactivityWarningDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    width: "550px",
    height: "320px",
    borderRadius: "8px",
    border: "2px solid var(--secondary-one, #0B7F99)",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
  "& #customized-dialog-title": {
    margin: 0,
    paddingLeft: "30px",
    backgroundColor: "#6D89A2",
    color: "#FFFFFF",
    fontFamily: "Lato",
    fontSize: "20px",
    fontWeight: 600,
    letterSpacing: 0,
  },
});

const InactivityWarningContent = styled("div")({
  margin: "50px auto",
  color: "#000000",
  fontFamily: "'Nunito', 'Rubik', sans-serif",
  fontSize: "17px",
  fontWeight: 300,
  letterSpacing: 0,
  lineHeight: "24px",
  "& .buttonWrapper": {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  "& .buttonGroup": {
    color: "#FFFFFF",
    fontFamily: "Lato",
    fontSize: "11px",
    lineHeight: "22px",
    width: "150px",
    border: "1px solid #626262",
    marginTop: "30px",
    borderRadius: "4px",
    fontWeight: 500,
  },
  "& .extendButton": {
    backgroundColor: "#566672 !important",
  },
  "& .logOutButton": {
    marginLeft: "20px",
    backgroundColor: "#437BBE !important",
  },
});

const SessionTimeoutDialog = styled(Dialog)({
  "& .MuiDialog-paper": {
    width: "550px",
    height: "320px",
    borderRadius: "8px",
    border: "2px solid var(--secondary-one, #0B7F99)",
    background: "linear-gradient(0deg, #F2F6FA 0%, #F2F6FA 100%), #2E4D7B",
    boxShadow: "0px 4px 45px 0px rgba(0, 0, 0, 0.40)",
  },
  "& .closeIcon": {
    cursor: "pointer",
    textAlign: "end",
  },
});

const SessionTimeoutContent = styled("div")({
  justifyContent: "space-between",
  paddingRight: "33px",
  paddingLeft: "33px",
  paddingTop: "10px",
  fontFamily: "lato",
  textAlign: "center",
  "& .sessionTimeoutTitle": {
    fontSize: "25px",
    fontWeight: "bold",
    paddingBottom: "12px",
    color: "#566672",
  },
  "& .sessionTimeoutMessage": {
    fontSize: "17px",
    paddingBottom: "14px",
  },
  "& .buttonWrapper": {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  "& .buttonGroup": {
    color: "#FFFFFF",
    fontFamily: "Lato",
    fontSize: "11px",
    lineHeight: "22px",
    width: "90px",
    border: "1px solid #626262",
    marginTop: "30px",
    borderRadius: "4px",
    fontWeight: 500,
  },
  "& .closeButton": {
    backgroundColor: "#566672 !important",
  },
  "& .loginButton": {
    marginLeft: "20px",
    backgroundColor: "#437BBE !important",
  },
});

/**
 * The time (in seconds) at which the timeout warning banner should be displayed.
 */
const timeoutThresholdSeconds = 300;

/**
 * An inactivity dialog that handles session the TTL ping and timeout.
 *
 * @returns InactivityDialog component
 */
const InactivityDialog: FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { isLoggedIn, logout } = useAuthContext();

  const [warning, setWarning] = useState<boolean>(false);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(timeoutThresholdSeconds);

  const extendSession = async () => {
    try {
      const res = await fetch(`${window.origin}/api/authn/authenticated`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })
        .then((response) => response.json())
        .catch(() => {});

      if (res.status) {
        setWarning(false);
      }
    } catch (e) {
      Logger.error("Error in extending session", e);
    }
  };

  const handleExtendSession = () => {
    extendSession();
  };

  const handleSignOutNoBanner = async () => {
    const logoutStatus = await logout();
    if (logoutStatus) {
      navigate("/");
      setWarning(false);
    }
  };

  const handleSignOut = async () => {
    const logoutStatus = await logout();
    if (logoutStatus) {
      navigate("/");
      setWarning(false);
      enqueueSnackbar("You have been logged out.", { variant: "default" });
    }
  };

  const loadData = async () => {
    try {
      const res = await fetch(`${window.origin}/api/authn/session-ttl`);
      const data = await res.json();
      const { ttl } = data;
      if (ttl <= 0) {
        // If user did not select any option and timed out in BE.
        handleSignOutNoBanner();
        setTimedOut(true);
      } else if (ttl > 0 && ttl <= timeoutThresholdSeconds) {
        setTimeLeft(ttl);
        setWarning(true);
      }
    } catch (e) {
      Logger.error("Error in fetching session ttl", e);
    }
  };

  useEffect(() => {
    let ID: ReturnType<typeof setInterval>;
    if (isLoggedIn) {
      ID = setInterval(loadData, 10 * 1000);
    } else {
      clearInterval(ID);
    }

    return () => clearInterval(ID);
  }, [isLoggedIn]);

  return (
    <>
      <InactivityWarningDialog open={warning}>
        <DialogTitle id="customized-dialog-title">Session Timeout Warning</DialogTitle>
        <InactivityWarningContent>
          This session is about to expire due to inactivity.
          <br />
          You will be logged out in
          {` ${secondsToMinuteString(timeLeft)} `}
          minutes.
          <br />
          Please elect to extend this session or logout.
          <div className="buttonWrapper">
            <Button
              variant="contained"
              className="buttonGroup extendButton"
              onClick={handleExtendSession}
              disableElevation={false}
            >
              EXTEND SESSION
            </Button>
            <Button
              variant="contained"
              className="buttonGroup logOutButton"
              onClick={handleSignOut}
              disableElevation={false}
            >
              LOGOUT
            </Button>
          </div>
        </InactivityWarningContent>
      </InactivityWarningDialog>
      <SessionTimeoutDialog open={timedOut}>
        <DialogTitle>
          <div
            role="button"
            className="closeIcon"
            onClick={() => setTimedOut(false)}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setTimedOut(false);
              }
            }}
          >
            <img style={{ height: 10, marginBottom: 2 }} src={CloseIcon} alt="close icon" />
          </div>
        </DialogTitle>
        <SessionTimeoutContent>
          <div className="sessionTimeoutTitle">Your session has expired.</div>
          <br />
          <div className="sessionTimeoutMessage">Please login again to continue working.</div>
          <div className="buttonWrapper">
            <Button
              variant="contained"
              className="buttonGroup closeButton"
              onClick={() => setTimedOut(false)}
              disableElevation={false}
            >
              CLOSE
            </Button>
            <Button
              variant="contained"
              className="buttonGroup loginButton"
              onClick={() => {
                setTimedOut(false);
                navigate("login");
              }}
              disableElevation={false}
            >
              LOGIN
            </Button>
          </div>
        </SessionTimeoutContent>
      </SessionTimeoutDialog>
    </>
  );
};

export default InactivityDialog;
